// ============================================================
// JW Study Assistant — Meeting Part Preparation Screen
// ============================================================
import { useState, useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Platform } from 'react-native';
import {
  YStack,
  XStack,
  SizableText,
  Card,
  Button,
  ScrollView,
  BlinkToggleGroup,
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
} from '@blinkdotnew/mobile-ui';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Clipboard } from 'react-native';
import { useAppStore } from '@/store/appStore';
import { generateMeetingAnswer } from '@/services/aiRetrievalService';
import { saveSource } from '@/services/storageService';
import type { GeneratedAnswer } from '@/types';

// ── Types ─────────────────────────────────────────────────────
type AnswerLength = 'short' | 'medium' | 'long';
type AnswerTone = 'natural' | 'heartfelt' | 'scriptural';

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
    partTitle: string;
    questions: string;   // JSON array
    references: string;  // JSON array
    timeMinutes: string;
  }>();

  const partTitle = params.partTitle ?? 'Meeting Part';
  const questions: string[] = (() => {
    try { return JSON.parse(params.questions ?? '[]') as string[]; } catch { return []; }
  })();
  const references: string[] = (() => {
    try { return JSON.parse(params.references ?? '[]') as string[]; } catch { return []; }
  })();
  const timeMinutes = parseInt(params.timeMinutes ?? '5', 10);

  const addSavedSource = useAppStore((s) => s.addSavedSource);
  const language = useAppStore((s) => s.language);

  const [answerLength, setAnswerLength] = useState<AnswerLength>('medium');
  const [tone, setTone] = useState<AnswerTone>('natural');
  const [generatedAnswer, setGeneratedAnswer] = useState<GeneratedAnswer | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSavingAnswer, setIsSavingAnswer] = useState(false);
  const [answerSaved, setAnswerSaved] = useState(false);

  const generateAnswer = useCallback(async (
    length: AnswerLength,
    t: AnswerTone,
  ) => {
    setIsGenerating(true);
    setAnswerSaved(false);
    try {
      const answer = await generateMeetingAnswer(
        partTitle,
        questions,
        references,
        '', // retrievedContent — populated by backend
        [],
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
  }, [partTitle, questions, references]);

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
        language: language?.code ?? 'E',
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
          onPress={() => router.back()}
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
                  <RefChip key={`ref-${i}`} reference={ref} />
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
    </SafeAreaView>
  );
}
