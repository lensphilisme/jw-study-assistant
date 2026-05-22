import { useState, useCallback, useEffect } from 'react';
import { Linking, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  YStack,
  XStack,
  SizableText,
  H2,
  Card,
  Button,
  ScrollView,
  BlinkToggleGroup,
  Spinner,
  Separator,
  Badge,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  BookMarked,
  Gem,
  Mic,
  Music,
  Users,
  Heart,
  Video,
  ArrowRight,
} from '@blinkdotnew/mobile-ui';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { translate } from '@/services/i18nService';
import { useAppStore } from '@/store/appStore';
import {
  absoluteWolUrl,
  fetchWolText,
  refsFromHtml as extractWolRefs,
  type WolReference,
  type WolReferenceToken,
} from '@/services/wolReferenceService';
import { normalizeAppLanguage, structureHtmlPart } from '@/services/sourceGatewayService';
import { usePremiumTheme } from '@/hooks/usePremiumTheme';

// ─── Types ───────────────────────────────────────────────────────────────────
interface MeetingPart {
  id: string;
  section: 'treasures' | 'ministry' | 'living' | 'opening' | 'closing' | 'other';
  title: string;
  time?: string;
  bibleRef?: string;
  questions?: string[];
  references?: WolReference[];
  hasVideo?: boolean;
  icon: string;
  detailHtml?: string;
  tokens?: WolReferenceToken[];
  media?: Array<{ type: 'image' | 'video' | 'audio'; url: string; title?: string; alt?: string }>;
  workbookUrl?: string;
  video?: {
    title: string;
    pub: string;
    issue: string;
    track: string;
    langwritten: string;
  };
  images?: Array<{ url: string; alt?: string }>;
}

interface WatchtowerArticle {
  id: string;
  title: string;
  studyWeek: string;
  docId: string;
  isCurrent: boolean;
}

// ─── ISO Week Helpers ─────────────────────────────────────────────────────────
function getISOWeek(date: Date): { year: number; week: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { year: d.getUTCFullYear(), week };
}

function getWeekLabel(year: number, week: number, symbol: string): string {
  // Get Monday of given ISO week
  const simple = new Date(year, 0, 1 + (week - 1) * 7);
  const dow = simple.getDay();
  const monday = new Date(simple);
  monday.setDate(simple.getDate() - (dow <= 1 ? dow - 1 : dow - 1));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const getLocaleId = (sym: string) => sym === 'ht' ? 'fr-HT' : sym;
  const fmt = (d: Date) =>
    d.toLocaleDateString(getLocaleId(symbol), { month: 'short', day: 'numeric' });
  return `${fmt(monday)} – ${fmt(sunday)}`;
}

function offsetWeek(year: number, week: number, delta: number): { year: number; week: number } {
  const maxWeek = 52; // simplified
  let w = week + delta;
  let y = year;
  if (w > maxWeek) { w = w - maxWeek; y++; }
  if (w < 1) { w = maxWeek + w; y--; }
  return { year: y, week: w };
}

// ─── HTML Parsers ─────────────────────────────────────────────────────────────
function stripTags(html: string): string {
  return decodeHtml(html.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
}

function decodeHtml(value: string): string {
  return value
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/�/g, '-');
}

function absoluteWol(href: string): string {
  if (!href) return '';
  if (/^https?:\/\//i.test(href)) return href;
  return `https://wol.jw.org${href.startsWith('/') ? href : `/${href}`}`;
}

function sectionFromHeading(text: string): MeetingPart['section'] {
  if (/treasures|trésors|trezo|tresoros|pawòl bondye/i.test(text)) return 'treasures';
  if (/field ministry|minist(è|e)re|minist(e|è)rio|predikasyon/i.test(text)) return 'ministry';
  if (/living as christians|vie chrétienne|lavi nou|vida cristiana/i.test(text)) return 'living';
  if (/opening|ouverture|ouvèti|apertura/i.test(text)) return 'opening';
  if (/concluding|closing|conclusion|fèmti/i.test(text)) return 'closing';
  return 'other';
}

function imagesFromHtml(html: string): Array<{ url: string; alt?: string }> {
  const images: Array<{ url: string; alt?: string }> = [];
  const re = /<img\b[^>]*src="([^"]+)"[^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    const tag = match[0];
    const src = match[1];
    if (!src || /thumbnail|sprite|icon/i.test(src)) continue;
    images.push({
      url: absoluteWolUrl(src),
      alt: /alt="([^"]*)"/i.exec(tag)?.[1],
    });
  }
  return images;
}

function videoFromHtml(html: string): MeetingPart['video'] | undefined {
  const re = /<a\b([^>]*)>([\s\S]*?)<\/a>\s*([\s\S]{0,220})/gi;
  let anchor: RegExpExecArray | null;
  while ((anchor = re.exec(html)) !== null) {
    const attrs = decodeHtml(anchor[1]);
    const labelHtml = anchor[2];
    const afterLabel = anchor[3];
    const href = decodeHtml(/href="([^"]+)"/i.exec(attrs)?.[1] ?? '');
    const dataVideo = decodeHtml(/data-video="([^"]+)"/i.exec(attrs)?.[1] ?? '');
    const finder = dataVideo || href;
    if (!/(data-video|lank=.*VIDEO|\/finder\?|video)/i.test(`${attrs} ${finder} ${labelHtml}`)) continue;

    let pub = /[?&]pub=([^&]+)/.exec(finder)?.[1] ?? '';
    let issue = /[?&]issue=([^&]+)/.exec(finder)?.[1] ?? '';
    let track = /[?&]track=([^&]+)/.exec(finder)?.[1] ?? '';
    let langwritten = /[?&](?:langwritten|wtlocale)=([^&]+)/.exec(finder)?.[1] ?? '';

    const lank = /[?&]lank=([^&]+)/.exec(finder)?.[1] ?? '';
    const lankMatch = /^pub-([a-z0-9]+)_(\d{6})_(\d+)_VIDEO/i.exec(lank);
    if (lankMatch) {
      pub = pub || lankMatch[1];
      issue = issue || lankMatch[2];
      track = track || lankMatch[3];
    }

    if (!pub || !track) continue;
    return {
      title: stripTags(`${labelHtml} ${afterLabel}`).replace(/\s+Then ask.*$/i, '').trim(),
      pub,
      issue,
      track,
      langwritten: langwritten || '',
    };
  }
  return undefined;
}

function parseMeetingArticleParts(html: string, workbookUrl: string): MeetingPart[] {
  const parts: MeetingPart[] = [];
  let section: MeetingPart['section'] = 'other';
  const iconMap: Record<MeetingPart['section'], string> = {
    treasures: '💎',
    ministry: '📋',
    living: '❤',
    opening: '🎵',
    closing: '🙏',
    other: '📖',
  };

  const headingRe = /<(h2|h3)\b([^>]*)>([\s\S]*?)<\/\1>/gi;
  const headings: Array<{ tag: string; index: number; end: number; text: string; html: string }> = [];
  let match: RegExpExecArray | null;
  while ((match = headingRe.exec(html)) !== null) {
    headings.push({
      tag: match[1].toLowerCase(),
      index: match.index,
      end: headingRe.lastIndex,
      text: stripTags(match[3]),
      html: match[0],
    });
  }

  headings.forEach((heading, i) => {
    if (heading.tag === 'h2') {
      section = sectionFromHeading(heading.text);
      return;
    }
    if (!heading.text || /watchtower study|other meeting publications/i.test(heading.text)) return;
    const next = headings.slice(i + 1).find((item) => item.tag === 'h2' || item.tag === 'h3');
    const detailHtml = normalizePartHtml(html.slice(heading.end, next?.index ?? html.length));
    const cleanTitle = heading.text.replace(/\s+/g, ' ').trim();
    const structured = structureHtmlPart(cleanTitle, `${heading.html}${detailHtml}`);
    const time = /\((\d+\s*min\.?)\)/i.exec(`${cleanTitle} ${structured.text}`)?.[1]?.replace('.', '');
    const references = extractWolRefs(`${heading.html}${detailHtml}`);
    const bibleRef = references.find((ref) => ref.kind === 'bible' && /\d+:\d+/.test(ref.text))?.text;
    const video = videoFromHtml(detailHtml);
    const tokenImages = structured.media
      .filter((item) => item.type === 'image')
      .map((item) => ({ url: item.url, alt: item.alt }));
    const images = tokenImages.length ? tokenImages : imagesFromHtml(detailHtml);
    parts.push({
      id: `part-${parts.length}`,
      section,
      title: cleanTitle.replace(/\s*\(\d+\s*min\.?\)\s*/i, ''),
      time,
      bibleRef,
      questions: structured.questions.length ? structured.questions : undefined,
      references: references.length ? references : undefined,
      hasVideo: Boolean(video),
      icon: iconMap[section],
      detailHtml,
      tokens: structured.tokens,
      media: structured.media,
      workbookUrl,
      video,
      images,
    });
  });

  return parts;
}

function findMidweekArticleUrl(hubHtml: string, lang: { symbol: string; wolRegion: string; wolLangParam: string }): string | null {
  const re = new RegExp(`href="([^"]*/${lang.symbol}/wol/d/${lang.wolRegion}/${lang.wolLangParam}/\\d+)"[^>]*class="[^"]*pub-mwb`, 'i');
  const href = re.exec(hubHtml)?.[1] ?? /href="([^"]+\/wol\/d\/[^"]+)"[^>]*class="[^"]*pub-mwb/i.exec(hubHtml)?.[1];
  return href ? absoluteWol(href) : null;
}

function normalizePartHtml(html: string): string {
  return html
    .replace(/<div\b[^>]*class="[^"]*(?:resultFooter|nav|pubNav)[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '')
    .replace(/<span\b[^>]*class="[^"]*(?:placeholder|hidden)[^"]*"[^>]*>[\s\S]*?<\/span>/gi, '')
    .replace(/(?:<br\s*\/?>\s*){3,}/gi, '<br><br>');
}

function parseMeetingParts(html: string): MeetingPart[] {
  const parts: MeetingPart[] = [];
  let section: MeetingPart['section'] = 'other';
  let idx = 0;

  // Section detection patterns
  const sectionMap: [RegExp, MeetingPart['section']][] = [
    [/treasures from god/i, 'treasures'],
    [/apply yourself/i, 'ministry'],
    [/living as christians/i, 'living'],
    [/opening song|opening prayer/i, 'opening'],
    [/closing song|closing prayer/i, 'closing'],
  ];

  const iconMap: Record<MeetingPart['section'], string> = {
    treasures: '💎',
    ministry: '📋',
    living: '❤️',
    opening: '🎵',
    closing: '🙏',
    other: '📖',
  };

  // Match headings
  const headingRe = /<h[23][^>]*>([\s\S]*?)<\/h[23]>/gi;
  let match;
  while ((match = headingRe.exec(html)) !== null) {
    const text = stripTags(match[1]);
    if (!text || text.length < 4) continue;

    for (const [re, sec] of sectionMap) {
      if (re.test(text)) { section = sec; break; }
    }

    // Try to extract time "(10 min)" pattern
    const timeM = text.match(/\((\d+\s*min)\)/i);
    const time = timeM ? timeM[1] : undefined;

    // Bible reference patterns: "Matthew 6:9-13", "Genesis 1:1"
    const bibleM = text.match(/([1-3]?\s*[A-Z][a-z]+\.?\s+\d+:\d+[\d,\s–-]*)/);
    const bibleRef = bibleM ? bibleM[1].trim() : undefined;

    // Publication refs like "jr 21 ¶12", "mwb22.03 ¶4"
    const refRe = /\b([a-z]{1,5}\d{0,4}(?:\.\d+)?\s+¶?\d+)\b/gi;
    const refs: WolReference[] = [];
    let refM;
    while ((refM = refRe.exec(text)) !== null) {
      refs.push({ text: refM[1], href: '', kind: 'publication' });
    }

    parts.push({
      id: `part-${idx++}`,
      section,
      title: text.replace(/\(\d+\s*min\)/i, '').trim(),
      time,
      bibleRef,
      references: refs.filter((ref) => ref.href).length ? refs.filter((ref) => ref.href) : undefined,
      hasVideo: /video|video clip/i.test(text),
      icon: iconMap[section],
    });
  }

  // Fallback: if no headings parsed, produce a generic structure
  if (parts.length === 0) {
    const fallback: MeetingPart['section'][] = ['opening', 'treasures', 'ministry', 'living', 'closing'];
    const titles = [
      'Opening Song & Prayer',
      'Treasures From God\'s Word',
      'Apply Yourself to the Field Ministry',
      'Living as Christians',
      'Closing Song & Prayer',
    ];
    titles.forEach((t, i) => {
      parts.push({
        id: `fallback-${i}`,
        section: fallback[i],
        title: t,
        icon: iconMap[fallback[i]],
      });
    });
  }

  return parts;
}

function parseWatchtowerArticles(data: any, currentWeek: number): WatchtowerArticle[] {
  const articles: WatchtowerArticle[] = [];
  try {
    const items = data?.items ?? data?.data ?? data?.results ?? [];
    items.forEach((item: any, i: number) => {
      articles.push({
        id: String(i),
        title: item.title ?? item.name ?? `Article ${i + 1}`,
        studyWeek: item.studyWeek ?? item.dateRange ?? '',
        docId: item.docId ?? item.id ?? String(i),
        isCurrent: i === 0, // simplified; first article = current
      });
    });
  } catch {}
  return articles;
}

function parseWatchtowerFromHub(html: string, lang: { symbol: string; wolRegion: string; wolLangParam: string }): WatchtowerArticle[] {
  const section = /<h2[^>]*>\s*Watchtower Study\s*<\/h2>([\s\S]*?)(?:<h2|<\/div>\s*<div id="regionFooter")/i.exec(html)?.[1] ?? html;
  const href = new RegExp(`href="([^"]*/${lang.symbol}/wol/d/${lang.wolRegion}/${lang.wolLangParam}/\\d+)"[^>]*class="[^"]*pub-w`, 'i').exec(section)?.[1]
    ?? /href="([^"]+\/wol\/d\/[^"]+)"[^>]*class="[^"]*pub-w/i.exec(section)?.[1]
    ?? '';
  if (!href) return [];
  const docId = /\/(\d+)(?:[#?"]|$)/.exec(href)?.[1] ?? '';
  const card = section.slice(Math.max(0, section.indexOf(href) - 500), section.indexOf(href) + 2500);
  const title = stripTags(/cardLine1[^>]*>([\s\S]*?)<\/div>/i.exec(card)?.[1] ?? '') || 'Watchtower Study';
  const studyWeek = stripTags(/cardLine2[^>]*>([\s\S]*?)<\/div>/i.exec(card)?.[1] ?? '');
  return docId ? [{ id: docId, title, studyWeek, docId, isCurrent: true }] : [];
}

// ─── Section Header ───────────────────────────────────────────────────────────
const SECTION_LABELS: Record<MeetingPart['section'], { key: string; color: string }> = {
  opening: { key: 'opening', color: '#7B6B9E' },
  treasures: { key: 'treasures_title', color: '#C4A840' },
  ministry: { key: 'ministry_title', color: '#5B7E6B' },
  living: { key: 'living_title', color: '#7B4B4B' },
  closing: { key: 'closing', color: '#7B6B9E' },
  other: { key: 'other', color: '#6B7280' },
};

function PartCard({ part, onPress, displaySymbol }: { part: MeetingPart; onPress: () => void; displaySymbol: string }) {
  const colors = usePremiumTheme();
  const sc = SECTION_LABELS[part.section];
  return (
    <Card
      backgroundColor={colors.surface}
      borderRadius="$7"
      padding="$4"
      borderWidth={1}
      borderColor={colors.border}
      borderLeftWidth={3}
      borderLeftColor={sc.color}
      pressStyle={{ opacity: 0.8 }}
      onPress={onPress}
    >
      <XStack gap="$3" alignItems="flex-start">
        <YStack
          width={40}
          height={40}
          borderRadius={20}
          backgroundColor={`${sc.color}20`}
          justifyContent="center"
          alignItems="center"
          flexShrink={0}
        >
          <SizableText fontSize={18}>{part.icon}</SizableText>
        </YStack>
        <YStack flex={1} gap="$1">
          <XStack justifyContent="space-between" alignItems="flex-start">
            <SizableText
              size="$4"
              color={colors.text}
              fontWeight="900"
              flex={1}
              numberOfLines={2}
              lineHeight={20}
            >
              {part.title}
            </SizableText>
            {part.time && (
              <YStack
                backgroundColor={colors.surface2}
                paddingHorizontal="$2"
                paddingVertical="$1"
                borderRadius="$2"
                marginLeft="$2"
                flexShrink={0}
              >
                <SizableText size="$1" color={colors.textMuted} fontWeight="700">
                  {part.time}
                </SizableText>
              </YStack>
            )}
          </XStack>
          {part.bibleRef && (
            <SizableText size="$3" color={colors.primary}>
              📖 {part.bibleRef}
            </SizableText>
          )}
          {part.references && part.references.length > 0 && (
            <XStack gap="$1" flexWrap="wrap">
              {part.references.slice(0, 3).map((ref, i) => (
                <YStack
                  key={i}
                  backgroundColor={colors.surface2}
                  paddingHorizontal="$2"
                  paddingVertical={2}
                  borderRadius="$2"
                >
                  <SizableText size="$1" color={colors.textMuted}>
                    {ref.text}
                  </SizableText>
                </YStack>
              ))}
            </XStack>
          )}
          {part.hasVideo && (
            <XStack alignItems="center" gap="$1">
              <SizableText size="$1" color={colors.gold}>
                {translate(displaySymbol, 'video_ai_warning')}
              </SizableText>
            </XStack>
          )}
        </YStack>
        <YStack alignItems="center" justifyContent="center" paddingTop="$1">
          <SizableText size="$4" color="#5B7E6B">›</SizableText>
        </YStack>
      </XStack>
      <XStack paddingTop="$2" gap="$2">
        <Button
          size="$2"
          backgroundColor={colors.glow}
          color={colors.primary}
          borderRadius="$3"
          onPress={onPress}
          fontSize={11}
        >
          {translate(displaySymbol, 'prepare')}
        </Button>
      </XStack>
    </Card>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function MeetingsScreen() {
  const router = useRouter();
  const colors = usePremiumTheme();
  const language = useAppStore((s) => s.language);
  const appLanguage = useAppStore((s) => s.appLanguage);
  const contentLanguage = useAppStore((s) => s.contentLanguage);
  const displaySymbol = appLanguage?.symbol || language?.symbol || 'en';

  const today = new Date();
  const current = getISOWeek(today);

  const [year, setYear] = useState(current.year);
  const [week, setWeek] = useState(current.week);
  const [activeTab, setActiveTab] = useState<'midweek' | 'weekend'>('midweek');

  const [meetingData, setMeetingData] = useState<MeetingPart[]>([]);
  const [watchtowerData, setWatchtowerData] = useState<WatchtowerArticle[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Language helper ──────────────────────────────────────────────────────
  const getLang = useCallback(async () => {
    try {
      const selected = normalizeAppLanguage(contentLanguage || language);
      if (selected) return selected;
      const raw = await AsyncStorage.getItem('selected_language');
      if (!raw) return normalizeAppLanguage(null);
      const parsed = JSON.parse(raw);
      return normalizeAppLanguage(parsed);
    } catch {
      return normalizeAppLanguage(null);
    }
  }, [contentLanguage, language]);

  // ── Fetch Midweek ────────────────────────────────────────────────────────
  const fetchMidweek = useCallback(async () => {
    setLoading(true);
    setError(null);
    setMeetingData([]);
    try {
      const lang = await getLang();
      const url = `https://wol.jw.org/${lang.symbol}/wol/meetings/${lang.wolRegion}/${lang.wolLangParam}/${year}/${week}`;
      const { text: html } = await fetchWolText(url);
      const articleUrl = findMidweekArticleUrl(html, lang);
      const parts = articleUrl
        ? parseMeetingArticleParts((await fetchWolText(articleUrl)).text, articleUrl)
        : parseMeetingParts(html);
      if (!parts.length) throw new Error('No meeting parts found');
      setMeetingData(parts);
    } catch (err: any) {
      setError(err?.message ?? 'unknown');
      // Show fallback structure
      setMeetingData([
        { id: 'f0', section: 'opening', title: 'Opening Song & Prayer', icon: '🎵' },
        { id: 'f1', section: 'treasures', title: 'Treasures From God\'s Word (10 min)', time: '10 min', icon: '💎' },
        { id: 'f2', section: 'treasures', title: 'Spiritual Gems (10 min)', time: '10 min', icon: '💡' },
        { id: 'f3', section: 'treasures', title: 'Bible Reading (4 min)', time: '4 min', icon: '📖' },
        { id: 'f4', section: 'ministry', title: 'Apply Yourself to the Field Ministry', icon: '📋' },
        { id: 'f5', section: 'living', title: 'Living as Christians', icon: '❤️' },
        { id: 'f6', section: 'living', title: 'Congregation Bible Study', icon: '📚' },
        { id: 'f7', section: 'closing', title: 'Closing Song & Prayer', icon: '🙏' },
      ]);
    } finally {
      setLoading(false);
    }
  }, [year, week, getLang]);

  // ── Fetch Weekend Watchtower ─────────────────────────────────────────────
  const fetchWeekend = useCallback(async () => {
    setLoading(true);
    setError(null);
    setWatchtowerData([]);
    try {
      const lang = await getLang();
      const url = `https://wol.jw.org/${lang.symbol}/wol/meetings/${lang.wolRegion}/${lang.wolLangParam}/${year}/${week}`;
      const { text: html } = await fetchWolText(url);
      const articles = parseWatchtowerFromHub(html, lang);
      if (!articles.length) throw new Error('No Watchtower article found');
      setWatchtowerData(articles);
    } catch (err: any) {
      setError(err?.message ?? 'unknown');
    } finally {
      setLoading(false);
    }
  }, [week, getLang]);

  // ── Load on tab / week change ────────────────────────────────────────────
  useEffect(() => {
    if (activeTab === 'midweek') fetchMidweek();
    else fetchWeekend();
  }, [activeTab, year, week]);

  // ── Week navigation ──────────────────────────────────────────────────────
  const handlePrevWeek = () => {
    const { year: y, week: w } = offsetWeek(year, week, -1);
    setYear(y); setWeek(w);
  };
  const handleNextWeek = () => {
    const { year: y, week: w } = offsetWeek(year, week, 1);
    setYear(y); setWeek(w);
  };

  const isCurrentWeek = year === current.year && week === current.week;
  const weekLabel = getWeekLabel(year, week, displaySymbol);

  // ── Navigate to part detail ──────────────────────────────────────────────
  const handlePartPress = useCallback(
    async (part: MeetingPart) => {
      const partKey = `meeting_part_${Date.now()}`;
      try {
        await AsyncStorage.setItem(partKey, JSON.stringify(part));
      } catch {
        // Continue with smaller URL params if web storage is unavailable.
      }
      try {
        const params = new URLSearchParams({
          partKey,
          partData: JSON.stringify({
            ...part,
            detailHtml: undefined,
            tokens: undefined,
            media: undefined,
          }),
          partTitle: part.title,
          questions: JSON.stringify(part.questions ?? []),
          references: JSON.stringify(part.references ?? []),
          timeMinutes: String(parseInt(part.time ?? '5', 10) || 5),
        });
        router.push(`/meeting-prep?${params.toString()}` as any);
      } catch {}
    },
    [router]
  );

  // ── Error state UI ───────────────────────────────────────────────────────
  const ErrorState = () => (
    <YStack padding="$5" alignItems="center" gap="$4">
      <Card
        backgroundColor={colors.surface}
        borderRadius="$7"
        padding="$5"
        borderWidth={1}
        borderColor={colors.border}
        alignItems="center"
        gap="$3"
        width="100%"
      >
        <AlertCircle size={36} color="#EF4444" />
        <SizableText size="$5" color={colors.text} fontWeight="900" textAlign="center">
          {translate(displaySymbol, 'could_not_load_schedule')}
        </SizableText>
        <SizableText size="$3" color={colors.textMuted} textAlign="center" lineHeight={20}>
          {translate(displaySymbol, 'check_connection_wol_hint')}
        </SizableText>
        <XStack gap="$2" flexWrap="wrap" justifyContent="center">
          <Button
            size="$3"
            backgroundColor={colors.surface2}
            color={colors.text}
            borderRadius="$3"
            onPress={() => (activeTab === 'midweek' ? fetchMidweek() : fetchWeekend())}
            icon={<RefreshCw size={14} color={colors.textMuted} />}
          >
            Try Again
          </Button>
          <Button
            size="$3"
            backgroundColor={colors.primaryDeep}
            color="white"
            borderRadius="$3"
            onPress={() => Linking.openURL('https://wol.jw.org')}
            icon={<ExternalLink size={14} color="white" />}
          >
            Open JW.org
          </Button>
        </XStack>
      </Card>
    </YStack>
  );

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <YStack flex={1}>
        {/* ── Header ── */}
        <XStack
          paddingHorizontal="$5"
          paddingTop="$4"
          paddingBottom="$3"
          alignItems="center"
          gap="$2"
        >
          <BookOpen size={22} color={colors.primary} />
          <H2 color={colors.text} fontWeight="900" fontSize={28}>
            {translate(displaySymbol, 'meeting_preparation')}
          </H2>
        </XStack>

        {/* ── Week Selector ── */}
        <XStack
          paddingHorizontal="$5"
          paddingBottom="$3"
          alignItems="center"
          justifyContent="space-between"
        >
          <Button
            size="$3"
            backgroundColor={colors.surface}
            color={colors.textMuted}
            borderRadius="$3"
            onPress={handlePrevWeek}
            icon={<ChevronLeft size={16} color={colors.textMuted} />}
            width={44}
            height={44}
          />
          <YStack alignItems="center" gap="$1" flex={1}>
            <XStack alignItems="center" gap="$2">
              <SizableText size="$4" color={colors.text} fontWeight="900">
                {weekLabel}
              </SizableText>
              {isCurrentWeek && (
                <YStack
                  backgroundColor="#1A2E24"
                  paddingHorizontal="$2"
                  paddingVertical={2}
                  borderRadius="$2"
                >
                  <SizableText size="$1" color="#5B7E6B" fontWeight="700">
                    THIS WEEK
                  </SizableText>
                </YStack>
              )}
            </XStack>
            <SizableText size="$2" color={colors.textMuted}>
              Week {week}, {year}
            </SizableText>
          </YStack>
          <Button
            size="$3"
            backgroundColor={colors.surface}
            color={colors.textMuted}
            borderRadius="$3"
            onPress={handleNextWeek}
            icon={<ChevronRight size={16} color={colors.textMuted} />}
            width={44}
            height={44}
          />
        </XStack>

        {/* ── Tab Toggle ── */}
        <YStack paddingHorizontal="$5" paddingBottom="$3">
          <BlinkToggleGroup
            options={[
              { value: 'midweek', label: 'Midweek Meeting' },
              { value: 'weekend', label: 'Weekend Watchtower' },
            ]}
            value={activeTab}
            onValueChange={(v) => v && setActiveTab(v as 'midweek' | 'weekend')}
          />
        </YStack>

        <Separator borderColor={colors.border} />

        {/* ── Content ── */}
        <YStack flex={1}>
          {loading && (
            <YStack flex={1} justifyContent="center" alignItems="center" gap="$3">
              <Spinner size="large" color={colors.primary} />
              <SizableText size="$3" color={colors.textMuted}>
                Loading {activeTab === 'midweek' ? 'meeting schedule' : 'Watchtower articles'}…
              </SizableText>
            </YStack>
          )}

          {/* ── Midweek Meeting ── */}
          {!loading && activeTab === 'midweek' && (
            <ScrollView flex={1} showsVerticalScrollIndicator={false}>
              <YStack padding="$5" gap="$4">
                {error && meetingData.length === 0 ? (
                  <ErrorState />
                ) : (
                  <>
                    {error && (
                      <XStack
                        backgroundColor="#2A1A1A"
                        borderRadius="$3"
                        padding="$3"
                        borderWidth={1}
                        borderColor="#5A2020"
                        gap="$2"
                        alignItems="center"
                      >
                        <AlertCircle size={14} color="#EF8080" />
                        <SizableText size="$2" color="#EF8080" flex={1}>
                          Could not load live schedule. Showing default structure.
                        </SizableText>
                      </XStack>
                    )}

                    {/* Group parts by section */}
                    {(['opening', 'treasures', 'ministry', 'living', 'closing', 'other'] as const).map(
                      (sec) => {
                        const sectionParts = meetingData.filter((p) => p.section === sec);
                        if (!sectionParts.length) return null;
                        const { key, color } = SECTION_LABELS[sec];
                        return (
                          <YStack key={sec} gap="$2">
                            <YStack
                              backgroundColor={`${color}15`}
                              paddingHorizontal="$3"
                              paddingVertical="$2"
                              borderRadius="$3"
                              borderLeftWidth={3}
                              borderLeftColor={color}
                            >
                              <SizableText size="$2" color={color} fontWeight="800" letterSpacing={0.5}>
                                {translate(displaySymbol, key)}
                              </SizableText>
                            </YStack>
                            {sectionParts.map((part) => (
                              <PartCard
                                key={part.id}
                                part={part}
                                onPress={() => handlePartPress(part)}
                                displaySymbol={displaySymbol}
                              />
                            ))}
                          </YStack>
                        );
                      }
                    )}

                    <Button
                      backgroundColor="transparent"
                      color="#5B7E6B"
                      borderWidth={1}
                      borderColor="#2D5A40"
                      borderRadius="$3"
                      size="$3"
                      onPress={() =>
                        Linking.openURL(`https://wol.jw.org/en/wol/meetings/r1/lp-e/${year}/${week}`)
                      }
                      icon={<ExternalLink size={14} color="#5B7E6B" />}
                    >
                      View Full Schedule on WOL
                    </Button>
                  </>
                )}
              </YStack>
            </ScrollView>
          )}

          {/* ── Weekend Watchtower ── */}
          {!loading && activeTab === 'weekend' && (
            <ScrollView flex={1} showsVerticalScrollIndicator={false}>
              <YStack padding="$5" gap="$4">
                {error && watchtowerData.length === 0 ? (
                  <ErrorState />
                ) : watchtowerData.length === 0 ? (
                  <YStack alignItems="center" gap="$3" paddingTop="$8">
                    <SizableText fontSize={48}>📰</SizableText>
                    <SizableText size="$4" color="#9CA3AF" textAlign="center" maxWidth={260}>
                      Watchtower articles could not be loaded. Try refreshing or opening JW.org.
                    </SizableText>
                    <Button
                      size="$3"
                      backgroundColor="#5B7E6B"
                      color="white"
                      borderRadius="$3"
                      onPress={() => Linking.openURL('https://www.jw.org/en/library/magazines/watchtower-study/')}
                      icon={<ExternalLink size={14} color="white" />}
                    >
                      Open Watchtower Library
                    </Button>
                  </YStack>
                ) : (
                  <>
                    <YStack gap="$2">
                      <SizableText size="$2" color="#9CA3AF" fontWeight="700" letterSpacing={1}>
                        WATCHTOWER STUDY ARTICLES
                      </SizableText>
                      {watchtowerData.map((article) => (
                        <Card
                          key={article.id}
                          backgroundColor={article.isCurrent ? '#1A2E24' : '#2C2C2E'}
                          borderRadius="$4"
                          padding="$4"
                          borderWidth={1}
                          borderColor={article.isCurrent ? '#2D5A40' : '#3A3A3C'}
                          pressStyle={{ opacity: 0.8 }}
                          onPress={() => {
                            try {
                              router.push({
                                pathname: '/watchtower-study' as any,
                                params: { docId: article.docId },
                              });
                            } catch {}
                          }}
                        >
                          <XStack gap="$3" alignItems="center">
                            <YStack
                              width={44}
                              height={44}
                              borderRadius={22}
                              backgroundColor={article.isCurrent ? '#2D5A40' : '#3A3A3C'}
                              justifyContent="center"
                              alignItems="center"
                              flexShrink={0}
                            >
                              <SizableText fontSize={20}>📰</SizableText>
                            </YStack>
                            <YStack flex={1} gap="$1">
                              {article.studyWeek ? (
                                <XStack alignItems="center" gap="$1">
                                  {article.isCurrent && (
                                    <YStack
                                      backgroundColor="#2D5A40"
                                      paddingHorizontal="$2"
                                      paddingVertical={2}
                                      borderRadius="$2"
                                    >
                                      <SizableText size="$1" color="#5B7E6B" fontWeight="700">
                                        THIS WEEK
                                      </SizableText>
                                    </YStack>
                                  )}
                                  <SizableText size="$2" color="#9CA3AF">
                                    {article.studyWeek}
                                  </SizableText>
                                </XStack>
                              ) : null}
                              <SizableText
                                size="$4"
                                color="#F2F2F7"
                                fontWeight="700"
                                numberOfLines={2}
                                lineHeight={20}
                              >
                                {article.title}
                              </SizableText>
                            </YStack>
                            <SizableText size="$5" color="#5B7E6B">›</SizableText>
                          </XStack>
                        </Card>
                      ))}
                    </YStack>

                    <Button
                      backgroundColor="transparent"
                      color="#5B7E6B"
                      borderWidth={1}
                      borderColor="#2D5A40"
                      borderRadius="$3"
                      size="$3"
                      onPress={() =>
                        Linking.openURL('https://www.jw.org/en/library/magazines/watchtower-study/')
                      }
                      icon={<ExternalLink size={14} color="#5B7E6B" />}
                    >
                      View All Issues on JW.org
                    </Button>
                  </>
                )}
              </YStack>
            </ScrollView>
          )}
        </YStack>
      </YStack>
    </SafeAreaView>
  );
}
