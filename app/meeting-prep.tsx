// ============================================================
// JW Study Assistant — Meeting Part Preparation Screen
// ============================================================
import React, { useEffect, useState, useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Linking, Platform } from 'react-native';
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
  FileText,
  Copy,
  Bookmark,
  Zap,
  Clock,
  Hash,
  RefreshCw,
  CheckCircle,
  AlignLeft,
  Video,
} from '@blinkdotnew/mobile-ui';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Clipboard } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppStore } from '@/store/appStore';
import { generateMeetingAnswer } from '@/services/aiRetrievalService';
import { saveSource } from '@/services/storageService';
import { safeBack } from '@/services/navigationService';
import { getVideoSource, proxiedMediaUrl } from '@/services/jwApiService';
import {
  absoluteWolUrl,
  stripHtml,
  tokenizeWolHtml,
  type WolReference,
  type WolReferenceToken,
  type WolPreview,
} from '@/services/wolReferenceService';
import { gatewayResolveReference } from '@/services/sourceGatewayService';
import type { GeneratedAnswer } from '@/types';
import { premium } from '@/constants/premiumTheme';

// ── Types ─────────────────────────────────────────────────────
type AnswerLength = 'short' | 'medium' | 'long';
type AnswerTone = 'natural' | 'heartfelt' | 'scriptural';

interface MeetingPartData {
  title?: string;
  time?: string;
  questions?: string[];
  references?: Array<string | WolReference>;
  detailHtml?: string;
  tokens?: WolReferenceToken[];
  media?: Array<{ type: 'image' | 'video' | 'audio'; url: string; title?: string; alt?: string }>;
  workbookUrl?: string;
  video?: { title: string; pub: string; issue: string; track: string; langwritten: string };
  images?: Array<{ url: string; alt?: string }>;
}

interface ResolvedVideoSource {
  url: string;
  title?: string;
  poster?: string;
  subtitles?: string;
  label?: string;
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

// ── Helpers ───────────────────────────────────────────────────
function isBibleRef(ref: string): boolean {
  return /^\d?\s*[A-Z][a-z]/.test(ref.trim());
}

function getBibleChipColor(ref: string) {
  return isBibleRef(ref)
    ? { bg: 'rgba(91,126,107,0.15)', border: 'rgba(91,126,107,0.3)', text: '#5B7E6B' }
    : { bg: 'rgba(90,123,158,0.15)', border: 'rgba(90,123,158,0.3)', text: '#5A7B9E' };
}

// ── Reference chip ────────────────────────────────────────────
function RefChip({ reference }: { reference: string }) {
  const colors = getBibleChipColor(reference);
  return (
    <XStack
      backgroundColor={colors.bg}
      borderRadius="$10"
      paddingHorizontal="$3"
      paddingVertical="$2"
      borderWidth={1}
      borderColor={colors.border}
      gap="$1"
      alignItems="center"
    >
      {isBibleRef(reference)
        ? <BookOpen size={12} color={colors.text} />
        : <FileText size={12} color={colors.text} />}
      <SizableText size="$2" color={colors.text} fontWeight="600">{reference}</SizableText>
    </XStack>
  );
}

function asReference(token: WolReferenceToken): WolReference | null {
  if (!token.href || token.kind === 'text' || token.kind === 'image' || token.kind === 'video') return null;
  return {
    text: token.text,
    href: absoluteWolUrl(token.href),
    kind: token.kind,
  };
}

function InlineTokens({
  tokens,
  onReference,
  videoUrl,
  videoSource,
}: {
  tokens: WolReferenceToken[];
  onReference: (ref: WolReference) => void;
  videoUrl?: string | null;
  videoSource?: ResolvedVideoSource | null;
}) {
  return (
    <XStack flexWrap="wrap" gap="$1" alignItems="baseline">
      {tokens.map((token, index) => {
        const ref = asReference(token);
        if (token.kind === 'image' && token.src) {
          return (
            <YStack key={index} width="100%" paddingVertical="$2">
              <Image
                source={{ uri: token.src }}
                style={{ width: '100%', aspectRatio: 16 / 9, borderRadius: 10, backgroundColor: '#111' }}
                contentFit="contain"
                transition={150}
              />
            </YStack>
          );
        }
        if (token.kind === 'video') {
          const targetUrl = token.href || videoUrl;
          if (!targetUrl) return null;
          if (videoUrl) {
            return (
              <YStack key={index} width="100%" gap="$2" paddingVertical="$2">
                <SizableText size="$3" color="#78B58A" fontWeight="700">{videoSource?.title || token.text}</SizableText>
                {React.createElement('video', {
                  src: videoUrl,
                  controls: true,
                  poster: videoSource?.poster,
                  style: { width: '100%', borderRadius: 10, backgroundColor: '#111' },
                  playsInline: true,
                }, videoSource?.subtitles
                  ? React.createElement('track', {
                      kind: 'subtitles',
                      src: videoSource.subtitles,
                      srcLang: 'en',
                      label: 'Captions',
                      default: true,
                    })
                  : null)}
              </YStack>
            );
          }
          return (
            <Button
              key={index}
              size="$3"
              backgroundColor="rgba(91,126,107,0.15)"
              borderColor="rgba(91,126,107,0.3)"
              borderWidth={1}
              color="#78B58A"
              onPress={() => Linking.openURL(targetUrl).catch(() => {})}
              icon={<Video size={14} color="#78B58A" />}
            >
              {token.text}
            </Button>
          );
        }
        if (!ref) {
          return (
            <SizableText
              key={index}
              size="$3"
              color="#D1D5DB"
              lineHeight={22}
              width={token.text.includes('\n') ? '100%' : undefined}
            >
              {token.text}
            </SizableText>
          );
        }
        return (
          <SizableText
            key={index}
            size="$3"
            color={ref.kind === 'bible' ? '#78B58A' : '#8DB4E2'}
            lineHeight={22}
            textDecorationLine="underline"
            onPress={() => onReference(ref)}
          >
            {token.text}
          </SizableText>
        );
      })}
    </XStack>
  );
}

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
    setLoading(true);
    setError('');
    setPreview(null);
    gatewayResolveReference(reference)
      .then((result) => setPreview(result.data))
      .catch(() => setError('Could not load this reference preview.'))
      .finally(() => setLoading(false));
  }, [open, reference]);

  return (
    <Sheet open={open} onOpenChange={(v: boolean) => { if (!v) onClose(); }} snapPoints={[75]} modal={false} dismissOnSnapToBottom>
      <Sheet.Frame backgroundColor={premium.bg} borderTopLeftRadius="$6" borderTopRightRadius="$6">
        <Sheet.Handle backgroundColor={premium.borderStrong} />
        <ScrollView flex={1}>
          <YStack padding="$5" gap="$4">
            <SizableText size="$2" color={premium.primary} fontWeight="900" letterSpacing={1}>
              {reference?.kind === 'bible' ? 'BIBLE VERSE' : 'PUBLICATION'}
            </SizableText>
            <SizableText size="$5" color={premium.text} fontWeight="900" letterSpacing={-0.3}>{reference?.text}</SizableText>
            {loading ? (
              <XStack gap="$2" alignItems="center">
                <Spinner size="small" color={premium.primary} />
                <SizableText color={premium.textMuted}>Loading reference...</SizableText>
              </XStack>
            ) : error ? (
              <SizableText color="#EF8080">{error}</SizableText>
            ) : preview ? (
              <YStack gap="$3">
                {preview.title && preview.title !== reference?.text ? (
                  <SizableText size="$4" color={premium.textSoft} fontWeight="800">{preview.title}</SizableText>
                ) : null}
                {preview.tokens?.length ? (
                  <InlineTokens tokens={preview.tokens} onReference={onReference} />
                ) : (
                  <SizableText size="$4" color={premium.text} lineHeight={26}>{preview.content}</SizableText>
                )}
              </YStack>
            ) : null}
          </YStack>
        </ScrollView>
      </Sheet.Frame>
    </Sheet>
  );
}

// ── Answer display card ───────────────────────────────────────
interface AnswerCardProps {
  answer: GeneratedAnswer;
  onShorter: () => void;
  onWarmer: () => void;
  onMoreScriptural: () => void;
  onAlternative: () => void;
  onSave: () => void;
  onCopy: () => void;
  isSaving: boolean;
  saved: boolean;
}
function AnswerCard({
  answer, onShorter, onWarmer, onMoreScriptural, onAlternative,
  onSave, onCopy, isSaving, saved,
}: AnswerCardProps) {
  return (
    <Card
      backgroundColor="#2C2C2E"
      borderRadius="$4"
      padding="$4"
      borderWidth={1}
      borderColor="rgba(91,126,107,0.3)"
      gap="$4"
    >
      {/* Answer label */}
      <XStack gap="$2" alignItems="center">
        <Zap size={14} color="#5B7E6B" />
        <SizableText size="$2" color="#5B7E6B" fontWeight="700" letterSpacing={1}>AI ANSWER</SizableText>
      </XStack>

      {/* Answer text */}
      <SizableText size="$4" color="#F2F2F7" lineHeight={24}>
        {answer.content}
      </SizableText>

      {/* Refinement buttons */}
      <YStack gap="$2">
        <SizableText size="$2" color="#6B7280" fontWeight="600">REFINE ANSWER</SizableText>
        <XStack flexWrap="wrap" gap="$2">
          {[
            { label: 'Shorter', onPress: onShorter },
            { label: 'Warmer', onPress: onWarmer },
            { label: 'More Scriptural', onPress: onMoreScriptural },
            { label: 'Alternative', onPress: onAlternative },
          ].map(({ label, onPress }) => (
            <Button
              key={label}
              size="$2"
              backgroundColor="#1C1C1E"
              borderColor="#3A3A3C"
              borderWidth={1}
              color="#9CA3AF"
              onPress={onPress}
            >
              {label}
            </Button>
          ))}
        </XStack>
      </YStack>

      <Separator borderColor="#3A3A3C" />

      {/* Action buttons */}
      <XStack gap="$2">
        <Button
          flex={1}
          size="$3"
          backgroundColor={saved ? 'rgba(91,126,107,0.2)' : 'rgba(91,126,107,0.1)'}
          borderColor={saved ? '#5B7E6B' : 'rgba(91,126,107,0.3)'}
          borderWidth={1}
          color={saved ? '#5B7E6B' : '#9CA3AF'}
          onPress={onSave}
          disabled={isSaving || saved}
          icon={saved
            ? <CheckCircle size={14} color="#5B7E6B" />
            : isSaving
              ? <Spinner size="small" color="#5B7E6B" />
              : <Bookmark size={14} color="#9CA3AF" />}
        >
          {saved ? 'Saved' : 'Save'}
        </Button>
        <Button
          flex={1}
          size="$3"
          backgroundColor="#1C1C1E"
          borderColor="#3A3A3C"
          borderWidth={1}
          color="#9CA3AF"
          onPress={onCopy}
          icon={<Copy size={14} color="#9CA3AF" />}
        >
          Copy
        </Button>
      </XStack>
    </Card>
  );
}

// ── Main Screen ───────────────────────────────────────────────
export default function MeetingPrepScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    partData?: string;
    partKey?: string;
    partTitle: string;
    questions: string;   // JSON array
    references: string;  // JSON array
    timeMinutes: string;
  }>();

  const initialPartData: MeetingPartData = (() => {
    try { return params.partData ? JSON.parse(params.partData) as MeetingPartData : {}; } catch { return {}; }
  })();
  const [partData, setPartData] = useState<MeetingPartData>(initialPartData);

  useEffect(() => {
    if (!params.partKey) return;
    AsyncStorage.getItem(params.partKey)
      .then((raw) => {
        if (raw) setPartData(JSON.parse(raw) as MeetingPartData);
      })
      .catch(() => {});
  }, [params.partKey]);
  const partTitle = partData.title ?? params.partTitle ?? 'Meeting Part';
  const questions: string[] = (() => {
    if (partData.questions) return partData.questions;
    try { return JSON.parse(params.questions ?? '[]') as string[]; } catch { return []; }
  })();
  const references: WolReference[] = (() => {
    const normalize = (items: Array<string | WolReference>) => items
      .map((item) => typeof item === 'string'
        ? { text: item, href: partData.workbookUrl ?? '', kind: isBibleRef(item) ? 'bible' as const : 'publication' as const }
        : { ...item, href: absoluteWolUrl(item.href) })
      .filter((item) => item.text && item.href);
    if (partData.references) return normalize(partData.references);
    try { return normalize(JSON.parse(params.references ?? '[]') as Array<string | WolReference>); } catch { return []; }
  })();
  const timeMinutes = parseInt(partData.time ?? params.timeMinutes ?? '5', 10);

  const addSavedSource = useAppStore((s) => s.addSavedSource);
  // Use global contentLanguage for all content and video fetching
  const contentLanguage = useAppStore((s) => s.contentLanguage);
  const language = contentLanguage?.symbol || 'en';

  const [answerLength, setAnswerLength] = useState<AnswerLength>('medium');
  const [tone, setTone] = useState<AnswerTone>('natural');
  const [generatedAnswer, setGeneratedAnswer] = useState<GeneratedAnswer | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSavingAnswer, setIsSavingAnswer] = useState(false);
  const [answerSaved, setAnswerSaved] = useState(false);
  const [activeReference, setActiveReference] = useState<WolReference | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoSource, setVideoSource] = useState<ResolvedVideoSource | null>(null);
  const detailTokens = partData.tokens?.length
    ? partData.tokens
    : partData.detailHtml
      ? tokenizeWolHtml(partData.detailHtml)
      : [];

  useEffect(() => {
    const video = partData.video;
    if (!video) return;
    // Always use contentLanguage for video fetching
    const lang = contentLanguage?.code || video.langwritten;
    setVideoUrl(null);
    setVideoSource(null);
    getVideoSource(video.pub, Number(video.track), lang, video.issue)
      .then((raw: any) => {
        const files = raw?.files?.[lang]?.MP4 ?? raw?.files?.[lang]?.M4V ?? [];
        const best = pickBestVideoFile(files);
        const url = best?.file?.url;
        const subtitles = best?.subtitles?.url;
        setVideoUrl(proxiedMediaUrl(url));
        setVideoSource(url ? {
          url: proxiedMediaUrl(url) ?? url,
          title: best?.title || video.title,
          poster: proxiedMediaUrl(best?.trackImage?.url) ?? best?.trackImage?.url,
          subtitles: proxiedMediaUrl(subtitles) ?? subtitles,
          label: best?.label,
        } : null);
      })
      .catch(() => {});
  }, [partData.video?.pub, partData.video?.issue, partData.video?.track, contentLanguage]);

  function pickBestVideoFile(files: any[] = []) {
    if (!Array.isArray(files) || !files.length) return null;
    return files.find((file) => /480p/i.test(file?.label ?? ''))
      ?? files.find((file) => /360p/i.test(file?.label ?? ''))
      ?? files[0];
  }

  const generateAnswer = useCallback(async (
    length: AnswerLength,
    t: AnswerTone,
  ) => {
    setIsGenerating(true);
    setAnswerSaved(false);
    try {
      const retrievedContent = [
        partData.detailHtml ? stripHtml(partData.detailHtml) : '',
        ...references.map((ref) => `${ref.text}: ${ref.href}`),
      ].filter(Boolean).join('\n\n');
      const answer = await generateMeetingAnswer(
        partTitle,
        questions,
        references.map((ref) => ref.text),
        retrievedContent,
        references.map((ref) => ({ title: ref.text, url: ref.href })),
        length,
        t,
      );
      setGeneratedAnswer(answer);
    } catch (err) {
      toast('Generation failed', {
        message: 'Could not generate answer. Check your connection.',
        variant: 'error',
      });
    } finally {
      setIsGenerating(false);
    }
  }, [partData.detailHtml, partTitle, questions, references]);

  const handleRefine = async (overrideLength?: AnswerLength, overrideTone?: AnswerTone) => {
    const l = overrideLength ?? answerLength;
    const t = overrideTone ?? tone;
    setAnswerLength(l);
    setTone(t);
    await generateAnswer(l, t);
  };

  const handleSave = async () => {
    if (!generatedAnswer) return;
    setIsSavingAnswer(true);
    try {
      const source = {
        id: `saved_${generatedAnswer.id}`,
        type: 'answer' as const,
        title: `Answer: ${partTitle}`,
        content: generatedAnswer.content,
        language,
        savedAt: new Date().toISOString(),
        syncStatus: 'saved' as const,
      };
      await saveSource(source);
      addSavedSource(source);
      setAnswerSaved(true);
      toast('Answer saved', { message: 'Added to your Saved Library.', variant: 'success' });
    } catch {
      toast('Save failed', { variant: 'error' });
    } finally {
      setIsSavingAnswer(false);
    }
  };

  const handleCopy = async () => {
    if (!generatedAnswer) return;
    if (Platform.OS !== 'web') {
      Clipboard.setString(generatedAnswer.content);
    } else {
      try { await navigator.clipboard.writeText(generatedAnswer.content); } catch { /* ignore */ }
    }
    toast('Copied to clipboard', { variant: 'success' });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#1C1C1E' }}>
      {/* ── Header ── */}
      <XStack paddingHorizontal="$4" paddingTop="$2" paddingBottom="$3" alignItems="center" gap="$2">
        <Button
          chromeless
          size="$3"
          onPress={() => safeBack(router, '/(tabs)/meetings')}
          icon={<ChevronLeft size={22} color="#9CA3AF" />}
        />
        <YStack flex={1} gap="$1">
          <SizableText size="$5" color="#F2F2F7" fontWeight="700" numberOfLines={2}>
            {partTitle}
          </SizableText>
        </YStack>
        {/* Time badge */}
        <XStack
          backgroundColor="rgba(91,126,107,0.15)"
          borderRadius="$10"
          paddingHorizontal="$3"
          paddingVertical="$1"
          borderWidth={1}
          borderColor="rgba(91,126,107,0.3)"
          gap="$1"
          alignItems="center"
        >
          <Clock size={12} color="#5B7E6B" />
          <SizableText size="$2" color="#5B7E6B" fontWeight="600">{timeMinutes} min</SizableText>
        </XStack>
      </XStack>

      <ScrollView flex={1} showsVerticalScrollIndicator={false}>
        <YStack padding="$4" gap="$5" paddingBottom="$12">

          {detailTokens.length > 0 && (
            <YStack gap="$3">
              <XStack gap="$2" alignItems="center">
                <FileText size={16} color="#5B7E6B" />
                <SizableText size="$3" color="#9CA3AF" fontWeight="700" letterSpacing={0.5}>
                  SECTION CONTENT
                </SizableText>
              </XStack>
              <Card backgroundColor="#202124" borderRadius="$4" padding="$4" borderWidth={1} borderColor="#34383E" gap="$3">
                <InlineTokens tokens={detailTokens} onReference={setActiveReference} videoUrl={videoUrl} videoSource={videoSource} />
              </Card>
            </YStack>
          )}

          {/* ── References section ── */}
          {references.length > 0 && (
            <YStack gap="$3">
              <XStack gap="$2" alignItems="center">
                <BookOpen size={16} color="#5B7E6B" />
                <SizableText size="$3" color="#9CA3AF" fontWeight="700" letterSpacing={0.5}>
                  REFERENCES
                </SizableText>
              </XStack>
              <XStack flexWrap="wrap" gap="$2">
                {references.map((ref, i) => (
                  <Button
                    key={`ref-${i}`}
                    chromeless
                    padding={0}
                    onPress={() => setActiveReference(ref)}
                  >
                    <RefChip reference={ref.text} />
                  </Button>
                ))}
              </XStack>
            </YStack>
          )}

          {/* ── Questions section ── */}
          {questions.length > 0 && (
            <YStack gap="$3">
              <XStack gap="$2" alignItems="center">
                <AlignLeft size={16} color="#7B6B9E" />
                <SizableText size="$3" color="#9CA3AF" fontWeight="700" letterSpacing={0.5}>
                  QUESTIONS
                </SizableText>
              </XStack>
              <YStack gap="$2">
                {questions.map((q, i) => (
                  <XStack
                    key={`q-${i}`}
                    gap="$3"
                    alignItems="flex-start"
                    backgroundColor="#2C2C2E"
                    borderRadius="$3"
                    padding="$3"
                    borderWidth={1}
                    borderColor="#3A3A3C"
                  >
                    <YStack
                      width={24}
                      height={24}
                      borderRadius={12}
                      backgroundColor="rgba(123,107,158,0.2)"
                      justifyContent="center"
                      alignItems="center"
                      flexShrink={0}
                      marginTop={1}
                    >
                      <SizableText size="$2" color="#7B6B9E" fontWeight="700">{i + 1}</SizableText>
                    </YStack>
                    <SizableText size="$3" color="#D1D5DB" flex={1} lineHeight={22}>
                      {q}
                    </SizableText>
                  </XStack>
                ))}
              </YStack>
            </YStack>
          )}

          {/* ── Prepare Answer section ── */}
          <YStack gap="$4">
            <XStack gap="$2" alignItems="center">
              <Zap size={16} color="#5B7E6B" />
              <SizableText size="$3" color="#9CA3AF" fontWeight="700" letterSpacing={0.5}>
                PREPARE ANSWER
              </SizableText>
            </XStack>

            <Card
              backgroundColor="#2C2C2E"
              borderRadius="$4"
              padding="$4"
              borderWidth={1}
              borderColor="#3A3A3C"
              gap="$4"
            >
              {/* Length selector */}
              <YStack gap="$2">
                <SizableText size="$3" color="#9CA3AF" fontWeight="600">Answer Length</SizableText>
                <BlinkToggleGroup
                  options={LENGTH_OPTIONS}
                  value={answerLength}
                  onValueChange={(v) => setAnswerLength(v as AnswerLength)}
                />
              </YStack>

              {/* Tone selector */}
              <YStack gap="$2">
                <SizableText size="$3" color="#9CA3AF" fontWeight="600">Tone</SizableText>
                <BlinkToggleGroup
                  options={TONE_OPTIONS}
                  value={tone}
                  onValueChange={(v) => setTone(v as AnswerTone)}
                />
              </YStack>

              {/* Generate button */}
              <Button
                backgroundColor="#5B7E6B"
                color="white"
                fontWeight="700"
                size="$4"
                borderRadius="$4"
                onPress={() => generateAnswer(answerLength, tone)}
                disabled={isGenerating}
                icon={
                  isGenerating
                    ? <Spinner size="small" color="white" />
                    : <Zap size={16} color="white" />
                }
              >
                {isGenerating ? 'Generating…' : 'Generate Answer'}
              </Button>
            </Card>
          </YStack>

          {/* ── Generated answer ── */}
          {generatedAnswer && !isGenerating && (
            <AnswerCard
              answer={generatedAnswer}
              onShorter={() => handleRefine('short', tone)}
              onWarmer={() => handleRefine(answerLength, 'heartfelt')}
              onMoreScriptural={() => handleRefine(answerLength, 'scriptural')}
              onAlternative={() => handleRefine(answerLength, tone)}
              onSave={handleSave}
              onCopy={handleCopy}
              isSaving={isSavingAnswer}
              saved={answerSaved}
            />
          )}

          {/* Generating skeleton */}
          {isGenerating && (
            <Card
              backgroundColor="#2C2C2E"
              borderRadius="$4"
              padding="$5"
              borderWidth={1}
              borderColor="rgba(91,126,107,0.2)"
              alignItems="center"
              gap="$3"
            >
              <Spinner size="large" color="#5B7E6B" />
              <SizableText size="$3" color="#9CA3AF">Preparing your answer…</SizableText>
            </Card>
          )}

        </YStack>
      </ScrollView>
      <ReferenceSheet
        open={Boolean(activeReference)}
        onClose={() => setActiveReference(null)}
        reference={activeReference}
        onReference={setActiveReference}
      />
    </SafeAreaView>
  );
}
