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
  Bible,
  Mic,
  Music,
  Users,
  Heart,
  Video,
  ChevronRightIcon,
  ArrowRight,
} from '@blinkdotnew/mobile-ui';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Types ───────────────────────────────────────────────────────────────────
interface MeetingPart {
  id: string;
  section: 'treasures' | 'ministry' | 'living' | 'opening' | 'closing' | 'other';
  title: string;
  time?: string;
  bibleRef?: string;
  questions?: string[];
  references?: string[];
  hasVideo?: boolean;
  icon: string;
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

function getWeekLabel(year: number, week: number): string {
  // Get Monday of given ISO week
  const simple = new Date(year, 0, 1 + (week - 1) * 7);
  const dow = simple.getDay();
  const monday = new Date(simple);
  monday.setDate(simple.getDate() - (dow <= 1 ? dow - 1 : dow - 1));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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
  return html.replace(/<[^>]+>/g, '').trim();
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
    const refs: string[] = [];
    let refM;
    while ((refM = refRe.exec(text)) !== null) refs.push(refM[1]);

    parts.push({
      id: `part-${idx++}`,
      section,
      title: text.replace(/\(\d+\s*min\)/i, '').trim(),
      time,
      bibleRef,
      references: refs.length ? refs : undefined,
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

// ─── Section Header ───────────────────────────────────────────────────────────
const SECTION_LABELS: Record<MeetingPart['section'], { label: string; color: string }> = {
  opening: { label: 'OPENING', color: '#7B6B9E' },
  treasures: { label: 'TREASURES FROM GOD\'S WORD', color: '#C4A840' },
  ministry: { label: 'APPLY YOURSELF TO THE FIELD MINISTRY', color: '#5B7E6B' },
  living: { label: 'LIVING AS CHRISTIANS', color: '#7B4B4B' },
  closing: { label: 'CLOSING', color: '#7B6B9E' },
  other: { label: 'OTHER', color: '#6B7280' },
};

function PartCard({ part, onPress }: { part: MeetingPart; onPress: () => void }) {
  const sc = SECTION_LABELS[part.section];
  return (
    <Card
      backgroundColor="#2C2C2E"
      borderRadius="$4"
      padding="$4"
      borderWidth={1}
      borderColor="#3A3A3C"
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
              color="#F2F2F7"
              fontWeight="700"
              flex={1}
              numberOfLines={2}
              lineHeight={20}
            >
              {part.title}
            </SizableText>
            {part.time && (
              <YStack
                backgroundColor="#3A3A3C"
                paddingHorizontal="$2"
                paddingVertical="$1"
                borderRadius="$2"
                marginLeft="$2"
                flexShrink={0}
              >
                <SizableText size="$1" color="#9CA3AF" fontWeight="600">
                  {part.time}
                </SizableText>
              </YStack>
            )}
          </XStack>
          {part.bibleRef && (
            <SizableText size="$3" color="#7B9E5B">
              📖 {part.bibleRef}
            </SizableText>
          )}
          {part.references && part.references.length > 0 && (
            <XStack gap="$1" flexWrap="wrap">
              {part.references.slice(0, 3).map((ref, i) => (
                <YStack
                  key={i}
                  backgroundColor="#3A3A3C"
                  paddingHorizontal="$2"
                  paddingVertical={2}
                  borderRadius="$2"
                >
                  <SizableText size="$1" color="#6B7280">
                    {ref}
                  </SizableText>
                </YStack>
              ))}
            </XStack>
          )}
          {part.hasVideo && (
            <XStack alignItems="center" gap="$1">
              <SizableText size="$1" color="#EF8C4B">
                🎬 Video — AI cannot answer video-only questions
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
          backgroundColor="#3A3A3C"
          color="#5B7E6B"
          borderRadius="$3"
          onPress={onPress}
          fontSize={11}
        >
          Prepare
        </Button>
      </XStack>
    </Card>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function MeetingsScreen() {
  const router = useRouter();

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
      const raw = await AsyncStorage.getItem('selected_language');
      if (!raw) return { symbol: 'en', wolRegion: 'r1', wolLang: 'lp-e' };
      const parsed = JSON.parse(raw);
      return {
        symbol: parsed?.symbol ?? 'en',
        wolRegion: parsed?.wolRegion ?? 'r1',
        wolLang: parsed?.wolLang ?? 'lp-e',
      };
    } catch {
      return { symbol: 'en', wolRegion: 'r1', wolLang: 'lp-e' };
    }
  }, []);

  // ── Fetch Midweek ────────────────────────────────────────────────────────
  const fetchMidweek = useCallback(async () => {
    setLoading(true);
    setError(null);
    setMeetingData([]);
    try {
      const lang = await getLang();
      const url = `https://wol.jw.org/${lang.symbol}/wol/meetings/${lang.wolRegion}/${lang.wolLang}/${year}/${week}`;
      const resp = await fetch(url, {
        signal: AbortSignal.timeout(12000),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const html = await resp.text();
      const parts = parseMeetingParts(html);
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
      const now = new Date();
      const issueCode = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
      const url = `https://b.jw-cdn.org/apis/pub-media/v1/get-publication?pub=w&issue=${issueCode}&langwritten=${lang.symbol}&txtCMS=1`;
      const resp = await fetch(url, { signal: AbortSignal.timeout(12000) });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const json = await resp.json();
      const articles = parseWatchtowerArticles(json, week);
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
  const weekLabel = getWeekLabel(year, week);

  // ── Navigate to part detail ──────────────────────────────────────────────
  const handlePartPress = useCallback(
    (part: MeetingPart) => {
      try {
        router.push({
          pathname: '/meeting-prep' as any,
          params: { partData: JSON.stringify(part) },
        });
      } catch {}
    },
    [router]
  );

  // ── Error state UI ───────────────────────────────────────────────────────
  const ErrorState = () => (
    <YStack padding="$5" alignItems="center" gap="$4">
      <Card
        backgroundColor="#2C2C2E"
        borderRadius="$4"
        padding="$5"
        borderWidth={1}
        borderColor="#3A3A3C"
        alignItems="center"
        gap="$3"
        width="100%"
      >
        <AlertCircle size={36} color="#EF4444" />
        <SizableText size="$5" color="#F2F2F7" fontWeight="700" textAlign="center">
          Could Not Load Schedule
        </SizableText>
        <SizableText size="$3" color="#9CA3AF" textAlign="center" lineHeight={20}>
          Check your connection. Meeting schedules are available on WOL (Watchtower Online Library).
        </SizableText>
        <XStack gap="$2" flexWrap="wrap" justifyContent="center">
          <Button
            size="$3"
            backgroundColor="#3A3A3C"
            color="#F2F2F7"
            borderRadius="$3"
            onPress={() => (activeTab === 'midweek' ? fetchMidweek() : fetchWeekend())}
            icon={<RefreshCw size={14} color="#9CA3AF" />}
          >
            Try Again
          </Button>
          <Button
            size="$3"
            backgroundColor="#5B7E6B"
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
    <SafeAreaView style={{ flex: 1, backgroundColor: '#1C1C1E' }}>
      <YStack flex={1}>
        {/* ── Header ── */}
        <XStack
          paddingHorizontal="$5"
          paddingTop="$4"
          paddingBottom="$3"
          alignItems="center"
          gap="$2"
        >
          <BookOpen size={22} color="#5B7E6B" />
          <H2 color="#F2F2F7" fontWeight="800" fontSize={24}>
            Meeting Preparation
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
            backgroundColor="#2C2C2E"
            color="#9CA3AF"
            borderRadius="$3"
            onPress={handlePrevWeek}
            icon={<ChevronLeft size={16} color="#9CA3AF" />}
            width={44}
            height={44}
          />
          <YStack alignItems="center" gap="$1" flex={1}>
            <XStack alignItems="center" gap="$2">
              <SizableText size="$4" color="#F2F2F7" fontWeight="700">
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
            <SizableText size="$2" color="#6B7280">
              Week {week}, {year}
            </SizableText>
          </YStack>
          <Button
            size="$3"
            backgroundColor="#2C2C2E"
            color="#9CA3AF"
            borderRadius="$3"
            onPress={handleNextWeek}
            icon={<ChevronRight size={16} color="#9CA3AF" />}
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

        <Separator borderColor="#2C2C2E" />

        {/* ── Content ── */}
        <YStack flex={1}>
          {loading && (
            <YStack flex={1} justifyContent="center" alignItems="center" gap="$3">
              <Spinner size="large" color="#5B7E6B" />
              <SizableText size="$3" color="#9CA3AF">
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
                        const { label, color } = SECTION_LABELS[sec];
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
                                {label}
                              </SizableText>
                            </YStack>
                            {sectionParts.map((part) => (
                              <PartCard
                                key={part.id}
                                part={part}
                                onPress={() => handlePartPress(part)}
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
