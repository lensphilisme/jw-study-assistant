// ============================================================
// JW Study Assistant — Watchtower Study Screen
// ============================================================
import { useState, useEffect, useCallback, useRef } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Platform, FlatList } from 'react-native';
import { Image } from 'expo-image';
import {
  YStack,
  XStack,
  SizableText,
  Card,
  Button,
  ScrollView,
  BlinkToggleGroup,
  Sheet,
  Spinner,
  Separator,
  toast,
  ChevronLeft,
  BookOpen,
  Zap,
  Play,
  Pause,
  Copy,
  Bookmark,
  CheckCircle,
  AlignLeft,
  Volume2,
} from '@blinkdotnew/mobile-ui';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAppStore } from '@/store/appStore';
import { createTranslator } from '@/services/i18nService';
import { generateWatchtowerAnswer } from '@/services/aiRetrievalService';
import { getPublicationContent, getMediaLinks, proxiedMediaUrl } from '@/services/jwApiService';
import { saveSource } from '@/services/storageService';
import { safeBack } from '@/services/navigationService';
import {
  fetchWolText,
  refsFromHtml,
  type WolPreview,
  type WolReference,
  type WolReferenceToken,
} from '@/services/wolReferenceService';
import { gatewayResolveReference } from '@/services/sourceGatewayService';
import type { GeneratedAnswer } from '@/types';
import { PreviewModal } from '@/components/premium';
import { usePremiumTheme } from '@/hooks/usePremiumTheme';

// ── Types ─────────────────────────────────────────────────────
type AnswerLength = 'short' | 'medium' | 'long';
type AnswerTone = 'natural' | 'heartfelt' | 'scriptural';

interface ParsedParagraph {
  id: string;
  number: number;
  text: string;
  dataPid?: string;
  questions: string[];
  html?: string;
  images?: ArticleImage[];
  refs?: WolReference[];
}

interface ArticleImage {
  url: string;
  caption: string;
  alt?: string;
  width?: number;
  height?: number;
}

interface ParagraphGroup {
  id: string;
  question: string;
  paragraphs: ParsedParagraph[];
}

interface AudioMarker {
  pid: string;
  startSec: number;
  endSec: number;
}

interface AudioState {
  isLoaded: boolean;
  isPlaying: boolean;
  duration: number;
  position: number;
  url: string | null;
  markers: AudioMarker[];
}

const LENGTH_OPTIONS = [
  { label: '30 sec', value: 'short' },
  { label: '1 min', value: 'medium' },
  { label: '2 min', value: 'long' },
];

const TONE_OPTIONS = [
  { label: 'Natural', value: 'natural' },
  { label: 'Heartfelt', value: 'heartfelt' },
  { label: 'Scriptural', value: 'scriptural' },
];

// ── HTML parsing helpers ──────────────────────────────────────
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function absoluteWolAsset(src: string): string {
  if (!src) return '';
  if (/^https?:\/\//i.test(src)) return src;
  return `https://wol.jw.org${src.startsWith('/') ? src : `/${src}`}`;
}

function attrValue(tag: string, name: string): string {
  return new RegExp(`${name}="([^"]*)"`, 'i').exec(tag)?.[1] ?? '';
}

function bestSrcFromSrcset(srcset: string): string {
  if (!srcset) return '';
  const candidates = srcset
    .split(',')
    .map((item) => {
      const [url = '', descriptor = ''] = item.trim().split(/\s+/);
      const width = /(\d+)w/i.exec(descriptor)?.[1];
      const density = /(\d+(?:\.\d+)?)x/i.exec(descriptor)?.[1];
      return {
        url,
        score: width ? Number(width) : density ? Number(density) * 1000 : 0,
      };
    })
    .filter((item) => item.url);
  return candidates.sort((a, b) => b.score - a.score)[0]?.url ?? '';
}

function bestImageFromFigure(fig: string): ArticleImage | null {
  const imgTag = /<img\b[^>]*>/i.exec(fig)?.[0] ?? '';
  if (!imgTag) return null;
  const src =
    attrValue(imgTag, 'data-img-size-xl')
    || attrValue(imgTag, 'data-img-size-lg')
    || attrValue(imgTag, 'data-img-size-md')
    || bestSrcFromSrcset(attrValue(imgTag, 'srcset'))
    || attrValue(imgTag, 'src');
  if (!src || /thumbnail|sprite|icon/i.test(src)) return null;
  return {
    url: absoluteWolAsset(src),
    alt: attrValue(imgTag, 'alt'),
    caption: stripHtml(/<figcaption[^>]*>([\s\S]*?)<\/figcaption>/i.exec(fig)?.[1] ?? ''),
    width: Number(attrValue(imgTag, 'width')) || undefined,
    height: Number(attrValue(imgTag, 'height')) || undefined,
  };
}

function parseParagraphs(html: string): ParsedParagraph[] {
  if (!html) return [];

  const paragraphs: ParsedParagraph[] = [];
  const imageQueue: ArticleImage[] = [];
  const segmentRe = /<p([^>]*)>([\s\S]*?)<\/p>|<div\b[^>]*>\s*<figure>([\s\S]*?)<\/figure>\s*<\/div>/gi;
  let match;
  const byPid = extractQuestionsByPid(html);

  while ((match = segmentRe.exec(html)) !== null) {
    if (match[3]) {
      const fig = match[3];
      const image = bestImageFromFigure(fig);
      if (image) {
        const paraMatch = /paragraf(?:o|e)?\s+(\d+)/i.exec(image.caption);
        const target = paraMatch
          ? paragraphs.find((p) => p.number === Number(paraMatch[1]))
          : paragraphs[paragraphs.length - 1];
        if (target) target.images = [...(target.images ?? []), image];
        else imageQueue.push(image);
      }
      continue;
    }

    const attrs = match[1] ?? '';
    const content = match[2] ?? '';

    const pidMatch = /data-pid="(\d+)"/.exec(attrs);
    const relPid = /data-rel-pid="\[(\d+)\]"/.exec(attrs)?.[1];
    const visibleNum = /data-pnum="(\d+)"/.exec(content)?.[1];
    if (!pidMatch || !relPid || !visibleNum) continue;

    const stripped = stripHtml(content.replace(/<span[^>]*class="[^"]*parNum[^"]*"[\s\S]*?<\/span>/i, ''));
    if (stripped.length < 30) continue;

    paragraphs.push({
      id: `p-${pidMatch[1]}`,
      number: Number(visibleNum),
      text: stripped,
      dataPid: pidMatch[1],
      questions: byPid[relPid] ? [byPid[relPid]] : [],
      html: content,
      images: imageQueue.splice(0),
      refs: refsFromHtml(content),
    });
  }

  return paragraphs;
}

function extractQuestionsByPid(html: string): Record<string, string> {
  const questions: Record<string, string> = {};
  const qRegex = /<p\b([^>]*)class="[^"]*\bqu\b[^"]*"[^>]*>([\s\S]*?)<\/p>/gi;
  let match;
  while ((match = qRegex.exec(html)) !== null) {
    const pid = /data-pid="(\d+)"/.exec(match[1] ?? '')?.[1];
    const text = stripHtml(match[2] ?? '').trim();
    if (pid && text.length > 5) questions[pid] = text;
  }
  return questions;
}

function groupParagraphs(paragraphs: ParsedParagraph[]): ParagraphGroup[] {
  const groups: ParagraphGroup[] = [];
  for (const para of paragraphs) {
    const question = para.questions[0] ?? `Paragraph ${para.number}`;
    const last = groups[groups.length - 1];
    if (last && last.question === question) {
      last.paragraphs.push(para);
    } else {
      groups.push({ id: `q-${para.number}`, question, paragraphs: [para] });
    }
  }
  return groups;
}

function parseTimeToSeconds(value: string): number {
  const [h = '0', m = '0', s = '0'] = value.split(':');
  return Number(h) * 3600 + Number(m) * 60 + Number(s);
}

// ── Audio player (native only via expo-av) ────────────────────
interface AudioPlayerProps {
  audioUrl: string | null;
  isLoaded: boolean;
  isPlaying: boolean;
  onToggle: () => void;
}
function AudioPlayer({ audioUrl, isLoaded, isPlaying, onToggle }: AudioPlayerProps) {
  const colors = usePremiumTheme();
  if (!audioUrl) return null;

  return (
    <XStack
      backgroundColor={colors.surface}
      borderRadius="$7"
      padding="$3"
      borderWidth={1}
      borderColor={colors.border}
      alignItems="center"
      gap="$3"
    >
      <YStack
        width={40}
        height={40}
        borderRadius={20}
        backgroundColor={colors.glow}
        justifyContent="center"
        alignItems="center"
        borderWidth={1}
        borderColor={colors.borderStrong}
      >
        <Volume2 size={18} color={colors.primary} />
      </YStack>
      <YStack flex={1} gap="$1">
        <SizableText size="$3" color={colors.text} fontWeight="800">Article Audio</SizableText>
        <SizableText size="$2" color={colors.textMuted}>
          {isLoaded ? 'Ready to play' : 'Loading…'}
        </SizableText>
      </YStack>
      <Button
        size="$3"
        backgroundColor={isPlaying ? 'rgba(239,68,68,0.1)' : 'rgba(91,126,107,0.15)'}
        borderColor={isPlaying ? 'rgba(239,68,68,0.3)' : 'rgba(91,126,107,0.3)'}
        borderWidth={1}
        color={isPlaying ? '#EF4444' : '#5B7E6B'}
        onPress={onToggle}
        disabled={!isLoaded}
        icon={isPlaying ? <Pause size={16} color="#EF4444" /> : <Play size={16} color="#5B7E6B" />}
      >
        {isPlaying ? 'Pause' : 'Play'}
      </Button>
    </XStack>
  );
}

// ── Paragraph card ────────────────────────────────────────────
interface ParagraphCardProps {
  group: ParagraphGroup;
  activePid?: string | null;
  articleTitle: string;
  onPrepare: (para: ParsedParagraph, question: string) => void;
  onReference: (ref: WolReference) => void;
}
function ParagraphCard({ group, activePid, onPrepare, onReference }: ParagraphCardProps) {
  const colors = usePremiumTheme();
  const combinedText = group.paragraphs.map((p) => p.text).join('\n\n');
  const firstPara = { ...group.paragraphs[0], text: combinedText };
  const isActive = group.paragraphs.some((p) => p.dataPid === activePid);
  return (
    <Card
      backgroundColor={colors.surface}
      borderRadius="$7"
      padding="$4"
      borderWidth={1}
      borderColor={isActive ? colors.gold : colors.border}
      {...(Platform.OS === 'web' && isActive ? { boxShadow: `0 0 0 2px ${colors.glow}` } as any : {})}
      gap="$3"
    >
      <XStack gap="$2" alignItems="flex-start">
        <AlignLeft size={14} color={colors.accent} style={{ marginTop: 3 }} />
        <SizableText size="$3" color={colors.text} flex={1} lineHeight={21} fontWeight="900">
          {group.question}
        </SizableText>
      </XStack>

      {group.paragraphs.map((para) => (
        <YStack key={para.id} gap="$2">
          <XStack gap="$3" alignItems="flex-start">
            <SizableText size="$3" color={para.dataPid === activePid ? colors.gold : colors.primary} fontWeight="900" width={30}>
              {para.number}
            </SizableText>
            <SizableText size="$3" color={colors.textSoft} flex={1} lineHeight={24}>
              {para.text}
            </SizableText>
          </XStack>
          {(para.images ?? []).map((image) => (
            <YStack key={image.url} marginLeft={42} gap="$2">
              <Image
                source={{ uri: image.url }}
                style={{
                  width: '100%',
                  aspectRatio: image.width && image.height ? image.width / image.height : 16 / 9,
                  borderRadius: 10,
                  backgroundColor: '#111',
                }}
                contentFit="contain"
                cachePolicy="disk"
                transition={180}
              />
              {image.caption ? (
                <SizableText size="$2" color="#9CA3AF" lineHeight={18}>{image.caption}</SizableText>
              ) : null}
              <Button
                size="$2"
                backgroundColor="rgba(123,107,158,0.14)"
                borderColor="rgba(123,107,158,0.3)"
                borderWidth={1}
                color="#B9A8E8"
                alignSelf="flex-start"
                icon={<Zap size={12} color="#B9A8E8" />}
                onPress={() => onPrepare(para, `${group.question}\n\nInclude the paragraph image in the comment.`)}
              >
                Prepare for Image
              </Button>
            </YStack>
          ))}
          {(para.refs ?? []).length > 0 && (
            <XStack marginLeft={42} flexWrap="wrap" gap="$2">
              {(para.refs ?? []).map((ref) => (
                <Button
                  key={`${ref.href}-${ref.text}`}
                  size="$2"
                  backgroundColor={ref.kind === 'bible' ? 'rgba(91,126,107,0.12)' : 'rgba(90,123,158,0.12)'}
                  borderColor={ref.kind === 'bible' ? 'rgba(91,126,107,0.3)' : 'rgba(90,123,158,0.3)'}
                  borderWidth={1}
                  color={ref.kind === 'bible' ? '#78B58A' : '#8DB4E2'}
                  onPress={() => onReference(ref)}
                >
                  {ref.text}
                </Button>
              ))}
            </XStack>
          )}
        </YStack>
      ))}

      <Button
        size="$2"
        backgroundColor="rgba(91,126,107,0.1)"
        borderColor="rgba(91,126,107,0.25)"
        borderWidth={1}
        color="#5B7E6B"
        alignSelf="flex-start"
        icon={<Zap size={12} color="#5B7E6B" />}
        onPress={() => onPrepare(firstPara, group.question)}
      >
        Prepare Answer
      </Button>
      {group.paragraphs.length === 0 && (
        <Button
          size="$2"
          backgroundColor="rgba(91,126,107,0.08)"
          borderColor="#3A3A3C"
          borderWidth={1}
          color="#6B7280"
          alignSelf="flex-start"
          icon={<Zap size={12} color="#6B7280" />}
          onPress={() => onPrepare(firstPara, group.question)}
        >
          Prepare Comment
        </Button>
      )}
    </Card>
  );
}

// ── Answer sheet ──────────────────────────────────────────────
interface AnswerSheetProps {
  open: boolean;
  onClose: () => void;
  paragraph: ParsedParagraph | null;
  question: string;
  articleTitle: string;
  onSave: (answer: GeneratedAnswer, para: ParsedParagraph) => Promise<void>;
}
function AnswerSheet({ open, onClose, paragraph, question, articleTitle, onSave }: AnswerSheetProps) {
  const appLanguage = useAppStore((s) => s.appLanguage);
  const language = useAppStore((s) => s.language);
  const t = createTranslator(appLanguage?.symbol || language?.symbol || 'en');
  const [length, setLength] = useState<AnswerLength>('medium');
  const [tone, setTone] = useState<AnswerTone>('natural');
  const [answer, setAnswer] = useState<GeneratedAnswer | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!open) { setAnswer(null); setSaved(false); }
  }, [open]);

  const generate = async () => {
    if (!paragraph) return;
    setIsGenerating(true);
    setSaved(false);
    try {
      const result = await generateWatchtowerAnswer(
        paragraph.text,
        question || `What is the main point of paragraph ${paragraph.number}?`,
        articleTitle,
        [],
        length,
        tone,
      );
      setAnswer(result);
    } catch {
      toast('Generation failed', { message: 'Check your connection and try again.', variant: 'error' });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!answer) return;
    if (Platform.OS === 'web') {
      try { await navigator.clipboard.writeText(answer.content); } catch { /* ignore */ }
    } else {
      toast(t('clipboard_unavailable'), { message: t('clipboard_unavailable_hint'), variant: 'warning' });
      return;
    }
    toast(t('copied'), { variant: 'success' });
  };

  const handleSave = async () => {
    if (!answer || !paragraph) return;
    setIsSaving(true);
    try {
      await onSave(answer, paragraph);
      setSaved(true);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(v: boolean) => { if (!v) onClose(); }}
      snapPoints={[90]}
      modal
      dismissOnSnapToBottom
    >
      <Sheet.Overlay />
      <Sheet.Frame backgroundColor="#1C1C1E" borderTopLeftRadius="$6" borderTopRightRadius="$6">
        <Sheet.Handle backgroundColor="#3A3A3C" />
        <ScrollView flex={1} showsVerticalScrollIndicator={false}>
          <YStack padding="$4" gap="$4" paddingBottom="$10">
            <SizableText size="$5" color="#F2F2F7" fontWeight="700">
              Prepare Answer
            </SizableText>

            {/* Question preview */}
            {question ? (
              <XStack
                backgroundColor="#2C2C2E"
                borderRadius="$3"
                padding="$3"
                gap="$2"
                borderWidth={1}
                borderColor="#3A3A3C"
              >
                <AlignLeft size={14} color="#7B6B9E" />
                <SizableText size="$3" color="#9CA3AF" flex={1} lineHeight={20}>{question}</SizableText>
              </XStack>
            ) : null}

            {/* Paragraph preview */}
            {paragraph && (
              <YStack
                backgroundColor="#2C2C2E"
                borderRadius="$3"
                padding="$3"
                borderWidth={1}
                borderColor="#3A3A3C"
              >
                <SizableText size="$2" color="#6B7280" marginBottom="$1">¶ {paragraph.number}</SizableText>
                <SizableText size="$3" color="#D1D5DB" lineHeight={20} numberOfLines={4}>
                  {paragraph.text}
                </SizableText>
              </YStack>
            )}

            {/* Length */}
            <YStack gap="$2">
              <SizableText size="$3" color="#9CA3AF" fontWeight="600">Length</SizableText>
              <BlinkToggleGroup
                options={LENGTH_OPTIONS}
                value={length}
                onValueChange={(v) => setLength(v as AnswerLength)}
              />
            </YStack>

            {/* Tone */}
            <YStack gap="$2">
              <SizableText size="$3" color="#9CA3AF" fontWeight="600">Tone</SizableText>
              <BlinkToggleGroup
                options={TONE_OPTIONS}
                value={tone}
                onValueChange={(v) => setTone(v as AnswerTone)}
              />
            </YStack>

            <Button
              backgroundColor="#5B7E6B"
              color="white"
              fontWeight="700"
              size="$4"
              onPress={generate}
              disabled={isGenerating}
              icon={isGenerating ? <Spinner size="small" color="white" /> : <Zap size={16} color="white" />}
            >
              {isGenerating ? 'Generating…' : 'Generate Answer'}
            </Button>

            {/* Generated answer */}
            {answer && !isGenerating && (
              <YStack gap="$3">
                <Separator borderColor="#3A3A3C" />
                <XStack gap="$2" alignItems="center">
                  <Zap size={14} color="#5B7E6B" />
                  <SizableText size="$2" color="#5B7E6B" fontWeight="700">AI ANSWER</SizableText>
                </XStack>
                <SizableText size="$3" color="#F2F2F7" lineHeight={24}>{answer.content}</SizableText>
                <XStack gap="$2">
                  <Button
                    flex={1}
                    size="$3"
                    backgroundColor={saved ? 'rgba(91,126,107,0.2)' : 'rgba(91,126,107,0.1)'}
                    borderColor={saved ? '#5B7E6B' : 'rgba(91,126,107,0.3)'}
                    borderWidth={1}
                    color={saved ? '#5B7E6B' : '#9CA3AF'}
                    onPress={handleSave}
                    disabled={isSaving || saved}
                    icon={saved ? <CheckCircle size={14} color="#5B7E6B" /> : isSaving ? <Spinner size="small" color="#5B7E6B" /> : <Bookmark size={14} color="#9CA3AF" />}
                  >
                    {saved ? 'Saved' : 'Save'}
                  </Button>
                  <Button
                    flex={1}
                    size="$3"
                    backgroundColor="#2C2C2E"
                    borderColor="#3A3A3C"
                    borderWidth={1}
                    color="#9CA3AF"
                    onPress={handleCopy}
                    icon={<Copy size={14} color="#9CA3AF" />}
                  >
                    Copy
                  </Button>
                </XStack>
              </YStack>
            )}
          </YStack>
        </ScrollView>
      </Sheet.Frame>
    </Sheet>
  );
}

// ── Main Screen ───────────────────────────────────────────────
function ReferenceSheet({
  open,
  onClose,
  reference,
  onReference,
}: {
  open: boolean;
  onClose: () => void;
  reference: WolReference | null;
  onReference: (ref: WolReference) => void;
}) {
  const [preview, setPreview] = useState<WolPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !reference) return;
    setPreview(null);
    setError('');
    setLoading(true);
    gatewayResolveReference(reference)
      .then((result) => setPreview(result.data))
      .catch(() => setError('Could not load this reference preview.'))
      .finally(() => setLoading(false));
  }, [open, reference]);

  return (
    <PreviewModal
      open={open}
      onClose={onClose}
      label={reference?.kind === 'bible' ? 'Bible verse' : 'Publication'}
      title={reference?.text}
      loading={loading}
    >
      {error ? (
        <SizableText color="#EF8080">{error}</SizableText>
      ) : preview ? (
        <YStack gap="$3">
          {preview.title && preview.title !== reference?.text ? (
            <SizableText size="$4" color="#D1D5DB" fontWeight="800">{preview.title}</SizableText>
          ) : null}
          {preview.tokens?.length ? (
            <ReferencePreviewTokens tokens={preview.tokens} onReference={onReference} />
          ) : (
            <SizableText size="$4" color="#F2F2F7" lineHeight={28}>{preview.content}</SizableText>
          )}
        </YStack>
      ) : null}
    </PreviewModal>
  );
}

function ReferencePreviewTokens({
  tokens,
  onReference,
}: {
  tokens: WolReferenceToken[];
  onReference: (ref: WolReference) => void;
}) {
  return (
    <XStack flexWrap="wrap" gap="$1" alignItems="baseline">
      {tokens.map((token, index) => {
        if (!token.href || token.kind === 'text' || token.kind === 'image' || token.kind === 'video') {
          return (
            <SizableText key={index} size="$4" color="#F2F2F7" lineHeight={26}>
              {token.text}
            </SizableText>
          );
        }
        const refKind = token.kind as WolReference['kind'];
        return (
          <SizableText
            key={index}
            size="$4"
            color={refKind === 'bible' || refKind === 'crossref' ? '#78B58A' : '#8DB4E2'}
            lineHeight={26}
            textDecorationLine="underline"
            onPress={() => onReference({ text: token.text, href: token.href ?? '', kind: refKind })}
          >
            {token.text}
          </SizableText>
        );
      })}
    </XStack>
  );
}

export default function WatchtowerStudyScreen() {
  const router = useRouter();
  const colors = usePremiumTheme();
  const { docId } = useLocalSearchParams<{ docId: string }>();

  const language = useAppStore((s) => s.language);
  const contentLanguage = useAppStore((s) => s.contentLanguage);
  const addSavedSource = useAppStore((s) => s.addSavedSource);

  const selectedLanguage = contentLanguage || language;
  const langCode = selectedLanguage?.code ?? 'E';
  const langSymbol = selectedLanguage?.symbol ?? 'en';
  const wolRegion = selectedLanguage?.wolRegion ?? 'r1';
  const wolLangParam = selectedLanguage?.wolLangParam ?? 'lp-e';

  const [paragraphs, setParagraphs] = useState<ParsedParagraph[]>([]);
  const paragraphGroups = groupParagraphs(paragraphs);
  const [articleTitle, setArticleTitle] = useState('Watchtower Study');
  const [themeScripture, setThemeScripture] = useState('');
  const [studyDates, setStudyDates] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Answer sheet state
  const [sheetOpen, setSheetOpen] = useState(false);
  const [activeParagraph, setActiveParagraph] = useState<ParsedParagraph | null>(null);
  const [activeQuestion, setActiveQuestion] = useState('');
  const [activeReference, setActiveReference] = useState<WolReference | null>(null);

  // Audio state
  const [audioState, setAudioState] = useState<AudioState>({
    isLoaded: false,
    isPlaying: false,
    duration: 0,
    position: 0,
    url: null,
    markers: [],
  });
  const soundRef = useRef<unknown>(null);
  const webAudioRef = useRef<HTMLAudioElement | null>(null);
  const listRef = useRef<FlatList<ParagraphGroup>>(null);
  const lastScrolledPidRef = useRef<string | null>(null);
  const [activePid, setActivePid] = useState<string | null>(null);

  // ── Fetch article content ──────────────────────────────────
  useEffect(() => {
    if (!docId) { setIsLoading(false); return; }
    loadContent();
    loadAudio();
  }, [docId, langCode, langSymbol, wolRegion, wolLangParam]);

  const loadContent = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      let raw = await getPublicationContent(docId!, langCode, langSymbol, wolRegion, wolLangParam).catch(() => null) as {
        items?: Array<{ content?: string; title?: string; citation?: string }>;
        title?: string;
      } | string | null;
      if (!raw || typeof raw === 'string') {
        raw = await fetchWolText(`https://wol.jw.org/${langSymbol}/wol/d/${wolRegion}/${wolLangParam}/${docId}`)
          .then((result) => result.text)
          .catch(() => null);
      }
      if (!raw) {
        throw new Error('Article not found for selected language');
      }

      const item = typeof raw === 'string' ? null : raw?.items?.[0];
      const html = typeof raw === 'string' ? raw : item?.content ?? '';
      const title = item?.title
        ?? (typeof raw === 'string' ? /<input[^>]+id="contentTitle"[^>]+value="([^"]+)"/i.exec(raw)?.[1] : raw?.title)
        ?? /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html)?.[1]
        ?? 'Watchtower Study';

      setArticleTitle(stripHtml(title));

      // Extract scripture from title (common pattern: "Title—Scripture")
      const scriptureMatch = /—([^—]+)$/u.exec(title);
      if (scriptureMatch) {
        setThemeScripture(scriptureMatch[1].trim());
      }

      const parsed = parseParagraphs(html);
      setParagraphs(parsed);

      // Set study dates
      const now = new Date();
      const weekEnd = new Date(now);
      weekEnd.setDate(now.getDate() + 6);
      const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      setStudyDates(`${fmt(now)} – ${fmt(weekEnd)}`);

    } catch (err) {
      setLoadError('Could not load article content. Please check your connection.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadAudio = async () => {
    try {
      const media = await getMediaLinks(docId!, langCode) as {
        files?: Record<string, { MP3?: Array<{ file?: { url?: string }; markers?: { documentId?: number; markers?: Array<{ startTime: string; duration: string; mepsParagraphId: number }> } }> }>;
      };
      const langFiles = media?.files?.[langCode]?.MP3 ?? Object.values(media?.files ?? {})[0]?.MP3 ?? [];
      const track = langFiles.find((item) => String(item.markers?.documentId ?? '') === String(docId)) ?? langFiles[0];
      const mp3Url = track?.file?.url;
      if (!mp3Url) return;
      const markers = (track?.markers?.markers ?? []).map((m) => {
        const startSec = parseTimeToSeconds(m.startTime);
        const endSec = startSec + parseTimeToSeconds(m.duration);
        return { pid: String(m.mepsParagraphId), startSec, endSec };
      });

      if (Platform.OS === 'web') {
        const audio = new window.Audio(proxiedMediaUrl(mp3Url) ?? mp3Url);
        webAudioRef.current = audio;
        audio.addEventListener('loadedmetadata', () => {
          setAudioState((s) => ({ ...s, isLoaded: true, duration: audio.duration || 0, url: audio.src, markers }));
        });
        audio.addEventListener('ended', () => setAudioState((s) => ({ ...s, isPlaying: false, position: 0 })));
        setAudioState((s) => ({ ...s, url: audio.src, markers }));
        return;
      }

      // Dynamically import expo-av (native only)
      const { Audio } = await import('expo-av');
      const { sound } = await Audio.Sound.createAsync({ uri: mp3Url }, { shouldPlay: false });
      soundRef.current = sound;
      const status = await sound.getStatusAsync();
      setAudioState({
        isLoaded: true,
        isPlaying: false,
        duration: status.isLoaded ? (status.durationMillis ?? 0) / 1000 : 0,
        position: 0,
        url: mp3Url,
        markers,
      });
    } catch {
      // Audio not available — silently ignore
    }
  };

  useEffect(() => {
    if (!audioState.isPlaying || audioState.markers.length === 0) return;
    const timer = setInterval(async () => {
      let position = audioState.position;
      if (Platform.OS === 'web') {
        position = webAudioRef.current?.currentTime ?? 0;
      } else if (soundRef.current) {
        const status = await (soundRef.current as any).getStatusAsync?.();
        position = status?.isLoaded ? (status.positionMillis ?? 0) / 1000 : 0;
      }
      const marker = audioState.markers.find((m) => position >= m.startSec && position < m.endSec);
      setAudioState((s) => ({ ...s, position }));
      setActivePid(marker?.pid ?? null);
    }, 250);
    return () => clearInterval(timer);
  }, [audioState.isPlaying, audioState.markers, audioState.position]);

  useEffect(() => {
    if (!activePid || lastScrolledPidRef.current === activePid) return;
    const index = paragraphGroups.findIndex((group) => group.paragraphs.some((p) => p.dataPid === activePid));
    if (index < 0) return;
    lastScrolledPidRef.current = activePid;
    listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.25 });
  }, [activePid, paragraphGroups]);

  const handleAudioToggle = async () => {
    if (Platform.OS === 'web') {
      const audio = webAudioRef.current;
      if (!audio) return;
      if (audioState.isPlaying) {
        audio.pause();
        setAudioState((s) => ({ ...s, isPlaying: false }));
      } else {
        await audio.play();
        setAudioState((s) => ({ ...s, isPlaying: true }));
      }
      return;
    }
    if (!soundRef.current) return;
    const sound = soundRef.current as { playAsync: () => Promise<void>; pauseAsync: () => Promise<void> };
    try {
      if (audioState.isPlaying) {
        await sound.pauseAsync();
        setAudioState((s) => ({ ...s, isPlaying: false }));
      } else {
        await sound.playAsync();
        setAudioState((s) => ({ ...s, isPlaying: true }));
      }
    } catch {
      toast('Audio playback error', { variant: 'error' });
    }
  };

  const handlePrepare = (para: ParsedParagraph, question: string) => {
    setActiveParagraph(para);
    setActiveQuestion(question);
    setSheetOpen(true);
  };

  const handleSaveAnswer = async (answer: GeneratedAnswer, para: ParsedParagraph) => {
    const source = {
      id: `wt_ans_${answer.id}`,
      type: 'answer' as const,
      title: `WT Answer: ¶${para.number} — ${articleTitle}`,
      content: answer.content,
      language: langCode,
      savedAt: new Date().toISOString(),
      syncStatus: 'saved' as const,
    };
    await saveSource(source);
    addSavedSource(source);
    toast('Answer saved', { message: 'Added to your Saved Library.', variant: 'success' });
  };

  // ── Render ─────────────────────────────────────────────────
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* ── Header ── */}
      <XStack paddingHorizontal="$4" paddingTop="$2" paddingBottom="$2" alignItems="center" gap="$2">
        <Button
          chromeless
          size="$3"
          onPress={() => safeBack(router, '/(tabs)/meetings')}
          icon={<ChevronLeft size={22} color={colors.textMuted} />}
        />
        <YStack flex={1} gap="$1">
          <SizableText size="$4" color={colors.text} fontWeight="900">Watchtower Study</SizableText>
          {studyDates ? (
            <SizableText size="$2" color={colors.textMuted}>{studyDates}</SizableText>
          ) : null}
        </YStack>
      </XStack>

      {isLoading ? (
        <YStack flex={1} justifyContent="center" alignItems="center" gap="$4">
          <Spinner size="large" color={colors.primary} />
          <SizableText size="$3" color="#9CA3AF">Loading article…</SizableText>
        </YStack>
      ) : loadError ? (
        <YStack flex={1} justifyContent="center" alignItems="center" padding="$6" gap="$4">
          <SizableText size="$4" color={colors.danger} textAlign="center">{loadError}</SizableText>
          <Button
            backgroundColor={colors.glow}
            borderColor={colors.borderStrong}
            borderWidth={1}
            color={colors.primary}
            onPress={loadContent}
          >
            Retry
          </Button>
        </YStack>
      ) : (
        <FlatList
          ref={listRef}
          data={paragraphGroups}
          keyExtractor={(item) => item.id}
          onScrollToIndexFailed={({ index }) => {
            setTimeout(() => listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.25 }), 300);
          }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
          ListHeaderComponent={
            <YStack gap="$4" paddingBottom="$2" paddingTop="$2">
              {/* Article title + theme scripture */}
              <YStack gap="$2">
                <SizableText size="$6" color={colors.text} fontWeight="900" lineHeight={32}>
                  {articleTitle}
                </SizableText>
                {themeScripture ? (
                  <XStack gap="$2" alignItems="center">
                    <BookOpen size={14} color={colors.primary} />
                    <SizableText size="$3" color={colors.primary} fontWeight="700" fontStyle="italic">
                      {themeScripture}
                    </SizableText>
                  </XStack>
                ) : null}
              </YStack>

              {/* Audio player */}
              <AudioPlayer
                audioUrl={audioState.url}
                isLoaded={audioState.isLoaded}
                isPlaying={audioState.isPlaying}
                onToggle={handleAudioToggle}
              />

              {/* Paragraphs label */}
              <XStack gap="$2" alignItems="center" paddingTop="$2">
                <AlignLeft size={14} color={colors.textMuted} />
                <SizableText size="$2" color={colors.textMuted} fontWeight="900" letterSpacing={1}>
                  {paragraphs.length} PARAGRAPHS
                </SizableText>
              </XStack>
            </YStack>
          }
          ListEmptyComponent={
            <YStack alignItems="center" paddingTop="$10" gap="$4">
              <BookOpen size={48} color={colors.textMuted} />
              <SizableText size="$4" color={colors.textMuted} textAlign="center" maxWidth={260}>
                No article content available. Try opening a different Watchtower article.
              </SizableText>
            </YStack>
          }
          renderItem={({ item }) => (
            <YStack marginBottom="$3">
              <ParagraphCard
                group={item}
                activePid={activePid}
                articleTitle={articleTitle}
                onPrepare={handlePrepare}
                onReference={setActiveReference}
              />
            </YStack>
          )}
        />
      )}

      {/* Answer preparation sheet */}
      <AnswerSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        paragraph={activeParagraph}
        question={activeQuestion}
        articleTitle={articleTitle}
        onSave={handleSaveAnswer}
      />
      <ReferenceSheet
        open={Boolean(activeReference)}
        onClose={() => setActiveReference(null)}
        reference={activeReference}
        onReference={setActiveReference}
      />
    </SafeAreaView>
  );
}
