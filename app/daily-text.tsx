import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAppStore } from '@/store/appStore';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  YStack,
  XStack,
  ScrollView,
  SizableText,
  Card,
  Button,
  Spinner,
  Input,
  Separator,
} from '@blinkdotnew/mobile-ui';
import {
  ArrowLeft,
  ExternalLink,
  Volume2,
  RefreshCw,
  Sparkles,
  Save,
  BookOpen,
  AlertTriangle,
} from '@blinkdotnew/mobile-ui';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TouchableOpacity, Linking } from 'react-native';
import { safeBack } from '@/services/navigationService';
import { generateAiText } from '@/services/localAiService';
import { saveSource } from '@/services/storageService';
import { createTranslator } from '@/services/i18nService';
import { usePremiumTheme } from '@/hooks/usePremiumTheme';
import {
  absoluteWolUrl,
  type WolPreview,
  type WolReference,
  type WolReferenceToken,
} from '@/services/wolReferenceService';
import {
  gatewayResolveReference,
  getDailyText as getNormalizedDailyText,
  normalizeAppLanguage,
} from '@/services/sourceGatewayService';
import type { Language } from '@/types';
import { PreviewModal } from '@/components/premium';

// ─── Brand tokens ─────────────────────────────────────────────────────────────
const PRIMARY = '#5B7E6B';
const BG = '#1C1C1E';
const CARD_BG = '#2C2C2E';
const CARD_BORDER = '#3A3A3C';
const TEXT_PRIMARY = '#F2F2F7';
const TEXT_SECONDARY = '#9CA3AF';
const PRIMARY_SUBTLE = 'rgba(91,126,107,0.15)';
const PRIMARY_BORDER = 'rgba(91,126,107,0.3)';

// ─── Blink SDK client ─────────────────────────────────────────────────────────
// ─── JW AI system prompt ──────────────────────────────────────────────────────
const JW_SYSTEM_PROMPT =
  'You are a JW study assistant. Using ONLY the following JW.org/WOL source content provided, ' +
  "explain this daily text for personal application. NEVER invent quotes or references. " +
  'Always cite your sources. If the content is insufficient, say so.';

// ─── Types ────────────────────────────────────────────────────────────────────
interface DailyText {
  date: string;
  scripture: string;
  scriptureText?: string;
  comment: string;
  commentTokens?: WolReferenceToken[];
  references?: WolReference[];
  audio?: { url: string; title?: string } | null;
  fullUrl?: string;
}

// ─── WOL language map ─────────────────────────────────────────────────────────
async function fetchDailyText(language: Language, dateStr: string): Promise<DailyText | null> {
  const d = dateStr ? new Date(dateStr + 'T00:00:00') : new Date();
  const result = await getNormalizedDailyText({ date: d, language });
  const data = result.data;
  if (!data.scriptureRef && !data.commentText) return null;
  return {
    date: data.date,
    scripture: data.scriptureRef,
    scriptureText: data.scriptureText,
    comment: data.commentText,
    commentTokens: data.commentTokens,
    references: data.references,
    audio: data.audio,
    fullUrl: data.sourceUrl,
  };
}

function asReference(token: WolReferenceToken): WolReference | null {
  if (!token.href || token.kind === 'text' || token.kind === 'image' || token.kind === 'video') return null;
  return { text: token.text, href: absoluteWolUrl(token.href), kind: token.kind };
}

function InlineDailyTokens({
  tokens,
  onReference,
}: {
  tokens: WolReferenceToken[];
  onReference: (ref: WolReference) => void;
}) {
  const colors = usePremiumTheme();
  return (
    <XStack flexWrap="wrap" gap="$1" alignItems="baseline">
      {tokens.map((token, index) => {
        const ref = asReference(token);
        if (!ref) {
          return (
            <SizableText
              key={index}
              size="$3"
              color={colors.textSoft}
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
            color={ref.kind === 'bible' || ref.kind === 'crossref' ? colors.primary : colors.accent}
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
  reference,
  onClose,
  onReference,
  t,
}: {
  reference: WolReference | null;
  onClose: () => void;
  onReference: (ref: WolReference) => void;
  t: ReturnType<typeof createTranslator>;
}) {
  const colors = usePremiumTheme();
  const [preview, setPreview] = useState<WolPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!reference) return;
    setLoading(true);
    setError('');
    setPreview(null);
    gatewayResolveReference(reference)
      .then((result) => setPreview(result.data))
      .catch(() => setError(t('could_not_load_reference_preview')))
      .finally(() => setLoading(false));
  }, [reference]);

  return (
    <PreviewModal
      open={!!reference}
      onClose={onClose}
      label={reference?.kind === 'bible' || reference?.kind === 'crossref' ? t('bible_reference') : t('publication')}
      title={reference?.text}
      loading={loading}
    >
      {error ? (
        <SizableText color={colors.danger}>{error}</SizableText>
      ) : preview ? (
        <YStack gap="$3">
          {preview.title && preview.title !== reference?.text ? (
            <SizableText size="$4" color={colors.textMuted} fontWeight="800">{preview.title}</SizableText>
          ) : null}
          {preview.tokens?.length ? (
            <InlineDailyTokens tokens={preview.tokens} onReference={onReference} />
          ) : (
            <SizableText size="$4" color={colors.text} lineHeight={28}>{preview.content}</SizableText>
          )}
        </YStack>
      ) : null}
    </PreviewModal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function DailyTextScreen() {
  const router = useRouter();
  const colors = usePremiumTheme();
  const PRIMARY = colors.primary;
  const BG = colors.bg;
  const CARD_BG = colors.surface;
  const CARD_BORDER = colors.border;
  const TEXT_PRIMARY = colors.text;
  const TEXT_SECONDARY = colors.textMuted;
  const PRIMARY_SUBTLE = colors.glow;
  const PRIMARY_BORDER = colors.borderStrong;
  const { date } = useLocalSearchParams<{ date?: string }>();
  const dateKey = date ?? new Date().toISOString().slice(0, 10);


  const [dailyText, setDailyText] = useState<DailyText | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  // Use global contentLanguage from app store
  const appLanguage = useAppStore((s) => s.appLanguage);
  const fallbackLanguage = useAppStore((s) => s.language);
  const contentLanguage = useAppStore((s) => s.contentLanguage || s.language);
  const activeContentLanguage = useMemo(
    () => normalizeAppLanguage(contentLanguage || fallbackLanguage),
    [contentLanguage, fallbackLanguage]
  );
  const language = activeContentLanguage.symbol || 'en';
  const displaySymbol = appLanguage?.symbol || language;
  const t = createTranslator(displaySymbol);
  const expectedPath = `/${language}/wol/dt/${activeContentLanguage.wolRegion}/${activeContentLanguage.wolLangParam}/`;

  const [notes, setNotes] = useState('');
  const [notesSaved, setNotesSaved] = useState(false);

  const [aiAnswer, setAiAnswer] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [activeReference, setActiveReference] = useState<WolReference | null>(null);

  // ── Load data ────────────────────────────────────────────────────────────
  // No need to set language from AsyncStorage, always use contentLanguage

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const cacheKey = `daily_text_${language}_${activeContentLanguage.wolRegion}_${activeContentLanguage.wolLangParam}_${dateKey}`;
      const cached = await AsyncStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached) as DailyText;
        if (
          parsed.fullUrl?.includes(expectedPath) &&
          parsed.commentTokens?.length &&
          !/meeting program|reyinyon|Ann egzamine Ekriti yo chak jou/i.test(parsed.comment)
        ) {
          setDailyText(parsed);
        } else {
          await AsyncStorage.removeItem(cacheKey);
          const data = await fetchDailyText(activeContentLanguage, dateKey);
          if (data) {
            setDailyText(data);
            await AsyncStorage.setItem(cacheKey, JSON.stringify(data));
          } else {
            setLoadError(true);
          }
        }
      } else {
        const data = await fetchDailyText(activeContentLanguage, dateKey);
        if (data) {
          setDailyText(data);
          await AsyncStorage.setItem(cacheKey, JSON.stringify(data));
        } else {
          setLoadError(true);
        }
      }
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
    // Load notes
    try {
      const savedNotes = await AsyncStorage.getItem(`daily_text_notes_${language}_${dateKey}`);
      if (savedNotes) setNotes(savedNotes);
    } catch {}
    // Load cached AI answer
    try {
      const savedAi = await AsyncStorage.getItem(`daily_text_ai_${language}_${dateKey}`);
      if (savedAi) setAiAnswer(savedAi);
    } catch {}
  }, [activeContentLanguage, language, expectedPath, dateKey]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Save notes ───────────────────────────────────────────────────────────
  const saveNotes = async () => {
    try {
      await AsyncStorage.setItem(`daily_text_notes_${language}_${dateKey}`, notes);
      setNotesSaved(true);
      setTimeout(() => setNotesSaved(false), 2000);
    } catch {}
  };

  // ── Save AI answer ───────────────────────────────────────────────────────
  const saveAiAnswer = async () => {
    if (!aiAnswer) return;
    try {
      await AsyncStorage.setItem(`daily_text_ai_${language}_${dateKey}`, aiAnswer);
      await saveSource({
        id: `daily_text_ai_${language}_${dateKey}`,
        type: 'answer',
        title: `Daily Text explanation - ${dailyText?.date ?? dateKey}`,
        content: aiAnswer,
        url: dailyText?.fullUrl,
        language,
        savedAt: new Date().toISOString(),
        syncStatus: 'saved',
      });
      setNotesSaved(true);
      setTimeout(() => setNotesSaved(false), 2000);
    } catch {}
  };

  // ── Generate AI explanation ───────────────────────────────────────────────
  const generateExplanation = useCallback(async () => {
    if (!dailyText) return;
    setAiLoading(true);
    setAiError('');
    setAiAnswer('');

    try {
      const result = await generateAiText({
        messages: [
          { role: 'system', content: JW_SYSTEM_PROMPT },
          {
            role: 'user',
            content:
              `Daily Text for ${dailyText.date}:\n\n` +
              `Scripture: ${dailyText.scripture}\n\n` +
              (dailyText.scriptureText ? `Scripture text: ${dailyText.scriptureText}\n\n` : '') +
              `Comment: ${dailyText.comment}\n\n` +
              "Please explain how a Jehovah's Witness can apply this text in their life today, " +
              'using only the JW content above.',
          },
        ],
      });

      setAiAnswer(result.text);
    } catch (e: any) {
      setAiError(e?.message ?? t('ai_generation_failed'));
    } finally {
      setAiLoading(false);
    }
  }, [dailyText]);

  // ── Open WOL ─────────────────────────────────────────────────────────────
  const openWOL = () => {
    if (dailyText?.fullUrl) Linking.openURL(dailyText.fullUrl).catch(() => {});
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BG }}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <XStack
        paddingHorizontal="$4"
        paddingVertical="$3"
        alignItems="center"
        gap="$3"
        borderBottomWidth={1}
        borderBottomColor={CARD_BORDER}
        backgroundColor={BG}
      >
        <TouchableOpacity onPress={() => safeBack(router, '/(tabs)')} activeOpacity={0.7} hitSlop={8}>
          <ArrowLeft size={22} color={TEXT_PRIMARY} />
        </TouchableOpacity>
        <YStack flex={1}>
          <SizableText size="$4" color={TEXT_PRIMARY} fontWeight="700">
            {t('daily_text')}
          </SizableText>
          {dailyText?.date ? (
            <SizableText size="$2" color={TEXT_SECONDARY} numberOfLines={1}>
              {dailyText.date}
            </SizableText>
          ) : null}
        </YStack>
        <TouchableOpacity
          onPress={openWOL}
          activeOpacity={0.7}
          style={{
            backgroundColor: PRIMARY_SUBTLE,
            borderRadius: 8,
            padding: 8,
            borderWidth: 1,
            borderColor: PRIMARY_BORDER,
          }}
        >
          <ExternalLink size={16} color={PRIMARY} />
        </TouchableOpacity>
      </XStack>

      <ScrollView flex={1} showsVerticalScrollIndicator={false} backgroundColor={BG}>
        <YStack paddingHorizontal="$5" paddingTop="$4" paddingBottom="$10" gap="$5">

          {loading ? (
            <YStack alignItems="center" justifyContent="center" paddingVertical="$10" gap="$3">
              <Spinner size="large" color={PRIMARY} />
              <SizableText size="$3" color={TEXT_SECONDARY}>
                {t('loading_daily_text')}
              </SizableText>
            </YStack>
          ) : loadError ? (
            <Card
              backgroundColor={CARD_BG}
              borderRadius="$4"
              padding="$5"
              borderWidth={1}
              borderColor={CARD_BORDER}
              alignItems="center"
              gap="$3"
            >
              <AlertTriangle size={32} color="#F59E0B" />
              <SizableText size="$4" color={TEXT_PRIMARY} fontWeight="600" textAlign="center">
                {t('could_not_load_daily_text')}
              </SizableText>
              <SizableText size="$3" color={TEXT_SECONDARY} textAlign="center">
                {t('check_connection_retry')}
              </SizableText>
              <TouchableOpacity
                onPress={loadData}
                activeOpacity={0.8}
                style={{
                  backgroundColor: PRIMARY,
                  borderRadius: 10,
                  paddingHorizontal: 20,
                  paddingVertical: 11,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <RefreshCw size={14} color="#fff" />
                <SizableText size="$3" color="#fff" fontWeight="700">
                  {t('try_again')}
                </SizableText>
              </TouchableOpacity>
            </Card>
          ) : dailyText ? (
            <>
              {/* ── Scripture card ──────────────────────────────────────── */}
              <Card
                backgroundColor={CARD_BG}
                borderRadius="$4"
                padding="$5"
                borderWidth={1}
                borderColor={CARD_BORDER}
                gap="$3"
                elevation={2}
              >
                <XStack alignItems="center" gap="$2">
                  <BookOpen size={15} color={PRIMARY} />
                  <SizableText size="$2" color={PRIMARY} fontWeight="700" letterSpacing={1.2}>
                    {t('scripture').toUpperCase()}
                  </SizableText>
                </XStack>
                <SizableText size="$5" color={TEXT_PRIMARY} fontWeight="700" lineHeight={28}>
                  {dailyText.scripture}
                </SizableText>
                {dailyText.scriptureText ? (
                  <SizableText size="$3" color={TEXT_SECONDARY} lineHeight={22}>
                    {dailyText.scriptureText}
                  </SizableText>
                ) : null}
              </Card>

              {/* ── Comment card ─────────────────────────────────────────── */}
              {dailyText.comment ? (
                <Card
                  backgroundColor={CARD_BG}
                  borderRadius="$4"
                  padding="$5"
                  borderWidth={1}
                  borderColor={CARD_BORDER}
                  gap="$3"
                  elevation={2}
                >
                  <SizableText size="$2" color={TEXT_SECONDARY} fontWeight="700" letterSpacing={1.2}>
                    {t('meditation_comment').toUpperCase()}
                  </SizableText>
                  {dailyText.commentTokens?.length ? (
                    <InlineDailyTokens tokens={dailyText.commentTokens} onReference={setActiveReference} />
                  ) : (
                    <SizableText
                      size="$3"
                      color={TEXT_SECONDARY}
                      lineHeight={22}
                    >
                      {dailyText.comment}
                    </SizableText>
                  )}
                  <Separator borderColor={CARD_BORDER} />
                  <TouchableOpacity onPress={openWOL} activeOpacity={0.7}>
                    <XStack alignItems="center" gap="$2">
                      <ExternalLink size={13} color={PRIMARY} />
                      <SizableText size="$2" color={PRIMARY} fontWeight="600">
                        {t('open_on_wol')}
                      </SizableText>
                    </XStack>
                  </TouchableOpacity>
                </Card>
              ) : null}

              {/* ── Notes section ────────────────────────────────────────── */}
              <Card
                backgroundColor={CARD_BG}
                borderRadius="$4"
                padding="$4"
                borderWidth={1}
                borderColor={CARD_BORDER}
                gap="$3"
                elevation={2}
              >
                <SizableText size="$2" color={TEXT_SECONDARY} fontWeight="700" letterSpacing={1.2}>
                  {t('my_notes').toUpperCase()}
                </SizableText>
                <Input
                  value={notes}
                  onChangeText={setNotes}
                  placeholder={t('write_personal_notes')}
                  placeholderTextColor={TEXT_SECONDARY}
                  color={TEXT_PRIMARY}
                  backgroundColor="#1C1C1E"
                  borderWidth={1}
                  borderColor={CARD_BORDER}
                  borderRadius="$3"
                  padding="$3"
                  multiline
                  numberOfLines={4}
                  size="$3"
                  focusStyle={{ borderColor: PRIMARY, outlineWidth: 0 }}
                  style={{ minHeight: 100, textAlignVertical: 'top' }}
                />
                <TouchableOpacity
                  onPress={saveNotes}
                  activeOpacity={0.8}
                  style={{
                    backgroundColor: notesSaved ? 'rgba(91,126,107,0.3)' : PRIMARY,
                    borderRadius: 10,
                    paddingVertical: 10,
                    alignSelf: 'flex-end',
                    paddingHorizontal: 18,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <Save size={13} color="#fff" />
                  <SizableText size="$3" color="#fff" fontWeight="700">
                    {notesSaved ? t('saved') : t('save_notes')}
                  </SizableText>
                </TouchableOpacity>
              </Card>

              {/* ── AI Explanation section ───────────────────────────────── */}
              <Card
                backgroundColor={CARD_BG}
                borderRadius="$4"
                padding="$4"
                borderWidth={1}
                borderColor={CARD_BORDER}
                gap="$3"
                elevation={2}
              >
                <XStack alignItems="center" gap="$2">
                  <Sparkles size={15} color={PRIMARY} />
                  <SizableText size="$2" color={PRIMARY} fontWeight="700" letterSpacing={1.2}>
                    {t('ai_explanation').toUpperCase()}
                  </SizableText>
                </XStack>
                <SizableText size="$2" color={TEXT_SECONDARY} lineHeight={18}>
                  {t('ai_explanation_hint')}
                </SizableText>

                {aiAnswer ? (
                  <>
                    <Card
                      backgroundColor="#1C1C1E"
                      borderRadius="$3"
                      padding="$4"
                      borderWidth={1}
                      borderColor={PRIMARY_BORDER}
                      gap="$2"
                    >
                      <XStack alignItems="center" gap="$2">
                        <BookOpen size={12} color={PRIMARY} />
                        <SizableText size="$1" color={PRIMARY} fontWeight="700" letterSpacing={1}>
                          {t('based_on_jw_sources').toUpperCase()}
                        </SizableText>
                      </XStack>
                      <SizableText size="$3" color={TEXT_SECONDARY} lineHeight={22}>
                        {aiAnswer}
                      </SizableText>
                    </Card>

                    <XStack gap="$2">
                      <TouchableOpacity
                        onPress={saveAiAnswer}
                        activeOpacity={0.8}
                        style={{
                          flex: 1,
                          backgroundColor: PRIMARY_SUBTLE,
                          borderRadius: 10,
                          paddingVertical: 10,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          borderWidth: 1,
                          borderColor: PRIMARY_BORDER,
                        }}
                      >
                        <Save size={13} color={PRIMARY} />
                        <SizableText size="$3" color={PRIMARY} fontWeight="700">
                          {t('save_answer')}
                        </SizableText>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={generateExplanation}
                        activeOpacity={0.8}
                        style={{
                          flex: 1,
                          backgroundColor: CARD_BORDER,
                          borderRadius: 10,
                          paddingVertical: 10,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                        }}
                      >
                        <RefreshCw size={13} color={TEXT_SECONDARY} />
                        <SizableText size="$3" color={TEXT_SECONDARY} fontWeight="700">
                          {t('regenerate')}
                        </SizableText>
                      </TouchableOpacity>
                    </XStack>
                  </>
                ) : aiLoading ? (
                  <YStack
                    backgroundColor="#1C1C1E"
                    borderRadius="$3"
                    padding="$5"
                    borderWidth={1}
                    borderColor={CARD_BORDER}
                    alignItems="center"
                    gap="$3"
                  >
                    <Spinner size="small" color={PRIMARY} />
                    <SizableText size="$3" color={TEXT_SECONDARY}>
                      {t('generating_explanation')}
                    </SizableText>
                  </YStack>
                ) : aiError ? (
                  <Card
                    backgroundColor="rgba(239,68,68,0.08)"
                    borderRadius="$3"
                    padding="$4"
                    borderWidth={1}
                    borderColor="rgba(239,68,68,0.2)"
                    gap="$2"
                  >
                    <XStack alignItems="center" gap="$2">
                      <AlertTriangle size={14} color="#EF4444" />
                      <SizableText size="$3" color="#EF4444" fontWeight="600">
                        {aiError}
                      </SizableText>
                    </XStack>
                  </Card>
                ) : null}

                {!aiAnswer && !aiLoading && (
                  <TouchableOpacity
                    onPress={generateExplanation}
                    activeOpacity={0.8}
                    style={{
                      backgroundColor: PRIMARY,
                      borderRadius: 10,
                      paddingVertical: 12,
                      alignItems: 'center',
                      flexDirection: 'row',
                      justifyContent: 'center',
                      gap: 8,
                    }}
                  >
                    <Sparkles size={15} color="#fff" />
                    <SizableText size="$4" color="#fff" fontWeight="700">
                      {t('explain_using_jw_sources')}
                    </SizableText>
                  </TouchableOpacity>
                )}
              </Card>

              {/* ── Audio player stub ─────────────────────────────────────── */}
              <Card
                backgroundColor={CARD_BG}
                borderRadius="$4"
                padding="$4"
                borderWidth={1}
                borderColor={CARD_BORDER}
                elevation={1}
              >
                <XStack alignItems="center" gap="$3" justifyContent="space-between">
                  <XStack alignItems="center" gap="$2">
                    <Volume2 size={16} color={TEXT_SECONDARY} />
                    <YStack gap="$0">
                      <SizableText size="$3" color={TEXT_PRIMARY} fontWeight="600">
                        {t('audio_version')}
                      </SizableText>
                      <SizableText size="$2" color={TEXT_SECONDARY}>
                        {t('available_on_wol')}
                      </SizableText>
                    </YStack>
                  </XStack>
                  <TouchableOpacity
                    onPress={openWOL}
                    activeOpacity={0.7}
                    style={{
                      backgroundColor: PRIMARY_SUBTLE,
                      borderRadius: 8,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderWidth: 1,
                      borderColor: PRIMARY_BORDER,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 5,
                    }}
                  >
                    <ExternalLink size={12} color={PRIMARY} />
                    <SizableText size="$2" color={PRIMARY} fontWeight="600">
                      {t('open')}
                    </SizableText>
                  </TouchableOpacity>
                </XStack>
              </Card>
            </>
          ) : null}
        </YStack>
      </ScrollView>
      <ReferenceSheet
        reference={activeReference}
        onClose={() => setActiveReference(null)}
        onReference={setActiveReference}
        t={t}
      />
    </SafeAreaView>
  );
}
