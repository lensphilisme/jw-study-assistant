import { useState, useEffect, useCallback } from 'react';
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
import { TouchableOpacity, Linking, Platform } from 'react-native';
import { createClient, AsyncStorageAdapter } from '@blinkdotnew/sdk';

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
const blink = createClient({
  projectId: process.env.EXPO_PUBLIC_BLINK_PROJECT_ID!,
  auth: { mode: 'headless' },
  storage: new AsyncStorageAdapter(AsyncStorage),
});

// ─── JW AI system prompt ──────────────────────────────────────────────────────
const JW_SYSTEM_PROMPT =
  'You are a JW study assistant. Using ONLY the following JW.org/WOL source content provided, ' +
  "explain this daily text for personal application. NEVER invent quotes or references. " +
  'Always cite your sources. If the content is insufficient, say so.';

// ─── Types ────────────────────────────────────────────────────────────────────
interface DailyText {
  date: string;
  scripture: string;
  comment: string;
  fullUrl?: string;
}

// ─── WOL language map ─────────────────────────────────────────────────────────
const LANG_CONFIG: Record<string, { region: string; param: string }> = {
  en: { region: 'r1', param: 'lp-e' },
  fr: { region: 'r30', param: 'lp-f' },
  es: { region: 'r4', param: 'lp-s' },
  de: { region: 'r10', param: 'lp-g' },
  pt: { region: 'r5', param: 'lp-p' },
  it: { region: 'r6', param: 'lp-i' },
};

async function fetchDailyText(lang: string, dateStr: string): Promise<DailyText | null> {
  const cfg = LANG_CONFIG[lang] ?? LANG_CONFIG['en'];
  const d = dateStr ? new Date(dateStr + 'T00:00:00') : new Date();
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const day = d.getDate();

  const url = `https://wol.jw.org/${lang}/wol/dt/${cfg.region}/${cfg.param}/${year}/${month}/${day}`;
  const res = await fetch(url, { headers: { Accept: 'text/html' } });
  if (!res.ok) throw new Error('Network error');
  const html = await res.text();

  const scrMatch = html.match(/<p[^>]*class="[^"]*themeScrp[^"]*"[^>]*>([\s\S]*?)<\/p>/i);
  const scripture = scrMatch
    ? scrMatch[1].replace(/<[^>]+>/g, '').replace(/&[a-z]+;/g, ' ').trim()
    : '';

  const bodyMatch = html.match(/<div[^>]*class="[^"]*body[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
  const comment = bodyMatch
    ? bodyMatch[1].replace(/<[^>]+>/g, '').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim()
    : '';

  if (!scripture && !comment) return null;

  const dateLabel = d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return { date: dateLabel, scripture, comment, fullUrl: url };
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function DailyTextScreen() {
  const router = useRouter();
  const { date } = useLocalSearchParams<{ date?: string }>();
  const dateKey = date ?? new Date().toISOString().slice(0, 10);

  const [dailyText, setDailyText] = useState<DailyText | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [language, setLanguage] = useState('en');

  const [notes, setNotes] = useState('');
  const [notesSaved, setNotesSaved] = useState(false);

  const [aiAnswer, setAiAnswer] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');

  // ── Load data ────────────────────────────────────────────────────────────
  useEffect(() => {
    AsyncStorage.getItem('selected_language').then((v) => {
      if (v) setLanguage(v.toLowerCase());
    });
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(false);

    try {
      const cacheKey = `daily_text_${dateKey}`;
      const cached = await AsyncStorage.getItem(cacheKey);
      if (cached) {
        setDailyText(JSON.parse(cached));
      } else {
        const data = await fetchDailyText(language, dateKey);
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
      const savedNotes = await AsyncStorage.getItem(`daily_text_notes_${dateKey}`);
      if (savedNotes) setNotes(savedNotes);
    } catch {}

    // Load cached AI answer
    try {
      const savedAi = await AsyncStorage.getItem(`daily_text_ai_${dateKey}`);
      if (savedAi) setAiAnswer(savedAi);
    } catch {}
  }, [language, dateKey]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Save notes ───────────────────────────────────────────────────────────
  const saveNotes = async () => {
    try {
      await AsyncStorage.setItem(`daily_text_notes_${dateKey}`, notes);
      setNotesSaved(true);
      setTimeout(() => setNotesSaved(false), 2000);
    } catch {}
  };

  // ── Save AI answer ───────────────────────────────────────────────────────
  const saveAiAnswer = async () => {
    if (!aiAnswer) return;
    try {
      await AsyncStorage.setItem(`daily_text_ai_${dateKey}`, aiAnswer);
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
      const result = await blink.ai.generateText({
        model: 'google/gemini-flash-3',
        messages: [
          { role: 'system', content: JW_SYSTEM_PROMPT },
          {
            role: 'user',
            content:
              `Daily Text for ${dailyText.date}:\n\n` +
              `Scripture: ${dailyText.scripture}\n\n` +
              `Comment: ${dailyText.comment}\n\n` +
              "Please explain how a Jehovah's Witness can apply this text in their life today, " +
              'using only the JW content above.',
          },
        ],
      });

      const text =
        typeof result === 'string'
          ? result
          : (result as any)?.text ?? (result as any)?.content ?? JSON.stringify(result);

      setAiAnswer(text);
    } catch (e: any) {
      setAiError(e?.message ?? 'AI generation failed. Please try again.');
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
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} hitSlop={8}>
          <ArrowLeft size={22} color={TEXT_PRIMARY} />
        </TouchableOpacity>
        <YStack flex={1}>
          <SizableText size="$4" color={TEXT_PRIMARY} fontWeight="700">
            Daily Text
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
                Loading daily text…
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
                Could not load daily text
              </SizableText>
              <SizableText size="$3" color={TEXT_SECONDARY} textAlign="center">
                Check your internet connection and try again.
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
                  Try Again
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
                    SCRIPTURE
                  </SizableText>
                </XStack>
                <SizableText size="$5" color={TEXT_PRIMARY} fontWeight="700" lineHeight={28}>
                  {dailyText.scripture}
                </SizableText>
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
                    MEDITATION &amp; COMMENT
                  </SizableText>
                  <SizableText
                    size="$3"
                    color={TEXT_SECONDARY}
                    lineHeight={22}
                  >
                    {dailyText.comment}
                  </SizableText>
                  <Separator borderColor={CARD_BORDER} />
                  <TouchableOpacity onPress={openWOL} activeOpacity={0.7}>
                    <XStack alignItems="center" gap="$2">
                      <ExternalLink size={13} color={PRIMARY} />
                      <SizableText size="$2" color={PRIMARY} fontWeight="600">
                        Open on WOL (wol.jw.org)
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
                  MY NOTES
                </SizableText>
                <Input
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Write your personal reflection or study notes…"
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
                    {notesSaved ? 'Saved ✓' : 'Save Notes'}
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
                    AI EXPLANATION
                  </SizableText>
                </XStack>
                <SizableText size="$2" color={TEXT_SECONDARY} lineHeight={18}>
                  Get a deeper explanation using only JW.org source content.
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
                          BASED ON JW.ORG SOURCES
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
                          Save Answer
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
                          Regenerate
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
                      Generating explanation from JW sources…
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
                      Explain using JW Sources
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
                        Audio Version
                      </SizableText>
                      <SizableText size="$2" color={TEXT_SECONDARY}>
                        Available on wol.jw.org
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
                      Open
                    </SizableText>
                  </TouchableOpacity>
                </XStack>
              </Card>
            </>
          ) : null}
        </YStack>
      </ScrollView>
    </SafeAreaView>
  );
}
