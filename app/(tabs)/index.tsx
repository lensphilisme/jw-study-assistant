import { useState, useEffect, useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
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
  BookOpen,
  Search,
  Users,
  ChevronRight,
  Globe,
  Calendar,
  Zap,
  AlertTriangle,
  RefreshCw,
} from '@blinkdotnew/mobile-ui';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TouchableOpacity, Platform } from 'react-native';

// ─── Brand tokens ─────────────────────────────────────────────────────────────
const PRIMARY = '#5B7E6B';
const BG = '#1C1C1E';
const CARD_BG = '#2C2C2E';
const CARD_BORDER = '#3A3A3C';
const TEXT_PRIMARY = '#F2F2F7';
const TEXT_SECONDARY = '#9CA3AF';
const PRIMARY_SUBTLE = 'rgba(91,126,107,0.15)';
const PRIMARY_BORDER = 'rgba(91,126,107,0.3)';

// ─── Types ────────────────────────────────────────────────────────────────────
interface DailyText {
  date: string;
  scripture: string;
  comment: string;
  fullUrl?: string;
}

interface Contact {
  id: string;
  name: string;
  address?: string;
  nextVisit?: string;
  notes?: string;
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

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function getMidweekDate(): string {
  const d = new Date();
  const day = d.getDay();
  // aim for Tuesday (2) or Wednesday (3)
  const diff = day <= 2 ? 2 - day : 9 - day;
  d.setDate(d.getDate() + diff);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function getWeekendDate(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? 6 : 6 - day;
  d.setDate(d.getDate() + diff);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

async function fetchDailyText(lang: string): Promise<DailyText | null> {
  const cfg = LANG_CONFIG[lang] ?? LANG_CONFIG['en'];
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const day = now.getDate();

  const url = `https://wol.jw.org/${lang}/wol/dt/${cfg.region}/${cfg.param}/${year}/${month}/${day}`;

  const res = await fetch(url, { headers: { Accept: 'text/html' } });
  if (!res.ok) throw new Error('Network response not ok');
  const html = await res.text();

  // Extract scripture reference
  const scrMatch = html.match(/<p[^>]*class="[^"]*themeScrp[^"]*"[^>]*>([\s\S]*?)<\/p>/i);
  const scripture = scrMatch
    ? scrMatch[1].replace(/<[^>]+>/g, '').replace(/&[a-z]+;/g, ' ').trim()
    : '';

  // Extract comment text
  const bodyMatch = html.match(/<div[^>]*class="[^"]*body[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
  const comment = bodyMatch
    ? bodyMatch[1].replace(/<[^>]+>/g, '').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim()
    : '';

  if (!scripture && !comment) return null;

  return {
    date: formatDate(now),
    scripture,
    comment,
    fullUrl: url,
  };
}

// ─── Skeleton component ───────────────────────────────────────────────────────
function SkeletonLine({
  width = '100%',
  height = 14,
}: {
  width?: string | number;
  height?: number;
}) {
  return (
    <YStack
      backgroundColor={CARD_BORDER}
      borderRadius="$2"
      height={height}
      width={width as any}
      opacity={0.6}
    />
  );
}

function CardSkeleton() {
  return (
    <Card
      backgroundColor={CARD_BG}
      borderRadius="$4"
      padding="$4"
      borderWidth={1}
      borderColor={CARD_BORDER}
      gap="$3"
    >
      <SkeletonLine width="40%" height={12} />
      <SkeletonLine width="90%" height={18} />
      <SkeletonLine width="70%" height={14} />
      <SkeletonLine width="35%" height={36} />
    </Card>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const router = useRouter();

  const [language, setLanguage] = useState('en');
  const [dailyText, setDailyText] = useState<DailyText | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loadingText, setLoadingText] = useState(true);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [textError, setTextError] = useState(false);
  const [aiQuery, setAiQuery] = useState('');
  const [retryCount, setRetryCount] = useState(0);

  // ── Load language ──────────────────────────────────────────────────────────
  useEffect(() => {
    AsyncStorage.getItem('selected_language').then((val) => {
      if (val) {
        try {
          const parsed = JSON.parse(val);
          // Language is stored as an object {symbol, langCode, name, ...}
          if (parsed && typeof parsed === 'object') {
            setLanguage(parsed.symbol || parsed.langCode?.toLowerCase() || 'en');
          } else {
            setLanguage(String(val).toLowerCase());
          }
        } catch {
          setLanguage(val.toLowerCase());
        }
      }
    });
  }, []);

  // ── Load contacts ──────────────────────────────────────────────────────────
  useEffect(() => {
    AsyncStorage.getItem('jw_sa:contacts')
      .then((raw) => {
        if (raw) setContacts(JSON.parse(raw));
      })
      .catch(() => {})
      .finally(() => setLoadingContacts(false));
  }, []);

  // ── Load / fetch daily text ────────────────────────────────────────────────
  const loadDailyText = useCallback(async () => {
    setLoadingText(true);
    setTextError(false);

    const today = new Date().toISOString().slice(0, 10);
    const cacheKey = `daily_text_${today}`;

    try {
      // Try cache first
      const cached = await AsyncStorage.getItem(cacheKey);
      if (cached) {
        setDailyText(JSON.parse(cached));
        setLoadingText(false);
        return;
      }

      // Fetch fresh
      const data = await fetchDailyText(language);
      if (data) {
        setDailyText(data);
        await AsyncStorage.setItem(cacheKey, JSON.stringify(data));
      } else {
        setTextError(true);
      }
    } catch {
      setTextError(true);
    } finally {
      setLoadingText(false);
    }
  }, [language, retryCount]);

  useEffect(() => {
    loadDailyText();
  }, [loadDailyText]);

  // ── Navigate helpers ───────────────────────────────────────────────────────
  const goToSettings = () => router.push('/(tabs)/settings');
  const goToDailyText = () =>
    router.push({
      pathname: '/daily-text',
      params: { date: new Date().toISOString().slice(0, 10) },
    });
  const goToSearch = (q?: string) =>
    router.push({ pathname: '/(tabs)/search', params: q ? { query: q } : undefined });
  const goToMinistry = () => router.push('/(tabs)/ministry');
  const goToMeetings = () => router.push('/(tabs)/meetings');
  const goToStudy = () => router.push('/(tabs)/study');

  const handleAskAI = () => {
    if (aiQuery.trim()) goToSearch(aiQuery.trim());
  };

  const langCode = language.toUpperCase();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BG }}>
      <ScrollView flex={1} showsVerticalScrollIndicator={false} backgroundColor={BG}>
        <YStack paddingHorizontal="$5" paddingTop="$4" paddingBottom="$8" gap="$5">

          {/* ── Header ──────────────────────────────────────────────────── */}
          <XStack justifyContent="space-between" alignItems="center">
            <XStack alignItems="center" gap="$2">
              <YStack
                width={34}
                height={34}
                borderRadius="$3"
                backgroundColor={PRIMARY_SUBTLE}
                justifyContent="center"
                alignItems="center"
                borderWidth={1}
                borderColor={PRIMARY_BORDER}
              >
                <BookOpen size={16} color={PRIMARY} />
              </YStack>
              <YStack gap="$0">
                <SizableText size="$2" color={TEXT_SECONDARY} letterSpacing={0.5}>
                  JW
                </SizableText>
                <SizableText size="$4" color={TEXT_PRIMARY} fontWeight="800" lineHeight={18}>
                  Study Assistant
                </SizableText>
              </YStack>
            </XStack>

            <TouchableOpacity
              onPress={goToSettings}
              activeOpacity={0.7}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                backgroundColor: PRIMARY_SUBTLE,
                borderRadius: 20,
                paddingHorizontal: 12,
                paddingVertical: 7,
                borderWidth: 1,
                borderColor: PRIMARY_BORDER,
              }}
            >
              <Globe size={13} color={PRIMARY} />
              <SizableText size="$2" color={PRIMARY} fontWeight="700" letterSpacing={1}>
                {langCode}
              </SizableText>
            </TouchableOpacity>
          </XStack>

          {/* ── Today's date greeting ────────────────────────────────────── */}
          <YStack gap="$0">
            <SizableText size="$2" color={TEXT_SECONDARY}>
              {formatDate(new Date())}
            </SizableText>
            <SizableText size="$6" color={TEXT_PRIMARY} fontWeight="800">
              Good{' '}
              {new Date().getHours() < 12
                ? 'morning'
                : new Date().getHours() < 17
                ? 'afternoon'
                : 'evening'}{' '}
              🕊️
            </SizableText>
          </YStack>

          {/* ── Daily Text Card ──────────────────────────────────────────── */}
          <YStack gap="$2">
            <SectionLabel icon="📖" label="TODAY'S DAILY TEXT" />
            {loadingText ? (
              <CardSkeleton />
            ) : textError ? (
              <Card
                backgroundColor={CARD_BG}
                borderRadius="$4"
                padding="$4"
                borderWidth={1}
                borderColor={CARD_BORDER}
                gap="$3"
              >
                <XStack alignItems="center" gap="$2">
                  <AlertTriangle size={16} color="#F59E0B" />
                  <SizableText size="$3" color="#F59E0B" fontWeight="600">
                    Could not load daily text
                  </SizableText>
                </XStack>
                <SizableText size="$2" color={TEXT_SECONDARY}>
                  Check your connection and try again.
                </SizableText>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => setRetryCount((c) => c + 1)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    alignSelf: 'flex-start',
                    backgroundColor: PRIMARY_SUBTLE,
                    borderRadius: 8,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderWidth: 1,
                    borderColor: PRIMARY_BORDER,
                  }}
                >
                  <RefreshCw size={13} color={PRIMARY} />
                  <SizableText size="$3" color={PRIMARY} fontWeight="600">
                    Retry
                  </SizableText>
                </TouchableOpacity>
              </Card>
            ) : dailyText ? (
              <Card
                backgroundColor={CARD_BG}
                borderRadius="$4"
                padding="$4"
                borderWidth={1}
                borderColor={CARD_BORDER}
                gap="$3"
                elevation={2}
              >
                <XStack justifyContent="space-between" alignItems="flex-start">
                  <SizableText size="$3" color={PRIMARY} fontWeight="700" flex={1} lineHeight={20}>
                    {dailyText.scripture}
                  </SizableText>
                  <YStack
                    backgroundColor={PRIMARY_SUBTLE}
                    paddingHorizontal="$2"
                    paddingVertical="$1"
                    borderRadius="$10"
                    borderWidth={1}
                    borderColor={PRIMARY_BORDER}
                  >
                    <SizableText size="$1" color={PRIMARY} fontWeight="600">
                      Today
                    </SizableText>
                  </YStack>
                </XStack>

                {dailyText.comment ? (
                  <SizableText size="$3" color={TEXT_SECONDARY} lineHeight={20} numberOfLines={3}>
                    {dailyText.comment.slice(0, 150)}
                    {dailyText.comment.length > 150 ? '…' : ''}
                  </SizableText>
                ) : null}

                <TouchableOpacity
                  onPress={goToDailyText}
                  activeOpacity={0.8}
                  style={{
                    backgroundColor: PRIMARY,
                    borderRadius: 10,
                    paddingVertical: 10,
                    paddingHorizontal: 16,
                    alignSelf: 'flex-start',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <SizableText size="$3" color="#fff" fontWeight="700">
                    Read Full Daily Text
                  </SizableText>
                  <ChevronRight size={14} color="#fff" />
                </TouchableOpacity>
              </Card>
            ) : (
              <TouchableOpacity onPress={() => setRetryCount((c) => c + 1)} activeOpacity={0.7}>
                <Card
                  backgroundColor={CARD_BG}
                  borderRadius="$4"
                  padding="$5"
                  borderWidth={1}
                  borderColor={CARD_BORDER}
                  alignItems="center"
                  gap="$2"
                >
                  <SizableText style={{ fontSize: 36 }}>📖</SizableText>
                  <SizableText size="$4" color={TEXT_PRIMARY} fontWeight="600">
                    Tap to load today's daily text
                  </SizableText>
                </Card>
              </TouchableOpacity>
            )}
          </YStack>

          {/* ── This Week's Meetings ─────────────────────────────────────── */}
          <YStack gap="$2">
            <SectionLabel icon="🗓️" label="THIS WEEK'S MEETINGS" />
            <Card
              backgroundColor={CARD_BG}
              borderRadius="$4"
              padding="$0"
              borderWidth={1}
              borderColor={CARD_BORDER}
              overflow="hidden"
              elevation={2}
            >
              {/* Midweek row */}
              <TouchableOpacity onPress={goToMeetings} activeOpacity={0.7}>
                <XStack paddingHorizontal="$4" paddingVertical="$3" gap="$3" alignItems="center">
                  <YStack
                    width={44}
                    height={44}
                    borderRadius="$3"
                    backgroundColor={PRIMARY_SUBTLE}
                    justifyContent="center"
                    alignItems="center"
                    borderWidth={1}
                    borderColor={PRIMARY_BORDER}
                  >
                    <SizableText size="$1" color={PRIMARY} fontWeight="800">
                      MID
                    </SizableText>
                  </YStack>
                  <YStack flex={1} gap="$0">
                    <SizableText size="$4" color={TEXT_PRIMARY} fontWeight="600">
                      Midweek Meeting
                    </SizableText>
                    <SizableText size="$2" color={TEXT_SECONDARY}>
                      {getMidweekDate()} · Life &amp; Ministry
                    </SizableText>
                  </YStack>
                  <TouchableOpacity
                    onPress={goToMeetings}
                    activeOpacity={0.7}
                    style={{
                      backgroundColor: PRIMARY_SUBTLE,
                      borderRadius: 8,
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderWidth: 1,
                      borderColor: PRIMARY_BORDER,
                    }}
                  >
                    <SizableText size="$2" color={PRIMARY} fontWeight="600">
                      Prepare
                    </SizableText>
                  </TouchableOpacity>
                </XStack>
              </TouchableOpacity>

              <Separator borderColor={CARD_BORDER} />

              {/* Weekend row */}
              <TouchableOpacity onPress={goToMeetings} activeOpacity={0.7}>
                <XStack paddingHorizontal="$4" paddingVertical="$3" gap="$3" alignItems="center">
                  <YStack
                    width={44}
                    height={44}
                    borderRadius="$3"
                    backgroundColor="rgba(123,158,139,0.12)"
                    justifyContent="center"
                    alignItems="center"
                    borderWidth={1}
                    borderColor="rgba(123,158,139,0.25)"
                  >
                    <SizableText size="$1" color="#7B9E8B" fontWeight="800">
                      WT
                    </SizableText>
                  </YStack>
                  <YStack flex={1} gap="$0">
                    <SizableText size="$4" color={TEXT_PRIMARY} fontWeight="600">
                      Watchtower Study
                    </SizableText>
                    <SizableText size="$2" color={TEXT_SECONDARY}>
                      {getWeekendDate()} · Weekend Meeting
                    </SizableText>
                  </YStack>
                  <TouchableOpacity
                    onPress={goToMeetings}
                    activeOpacity={0.7}
                    style={{
                      backgroundColor: PRIMARY_SUBTLE,
                      borderRadius: 8,
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderWidth: 1,
                      borderColor: PRIMARY_BORDER,
                    }}
                  >
                    <SizableText size="$2" color={PRIMARY} fontWeight="600">
                      Prepare
                    </SizableText>
                  </TouchableOpacity>
                </XStack>
              </TouchableOpacity>
            </Card>
          </YStack>

          {/* ── Upcoming Return Visits ───────────────────────────────────── */}
          <YStack gap="$2">
            <XStack justifyContent="space-between" alignItems="center">
              <SectionLabel icon="🚶" label="UPCOMING RETURN VISITS" />
              <TouchableOpacity onPress={goToMinistry} activeOpacity={0.7}>
                <SizableText size="$2" color={PRIMARY} fontWeight="600">
                  View All
                </SizableText>
              </TouchableOpacity>
            </XStack>

            {loadingContacts ? (
              <CardSkeleton />
            ) : contacts.length === 0 ? (
              <Card
                backgroundColor={CARD_BG}
                borderRadius="$4"
                padding="$4"
                borderWidth={1}
                borderColor={CARD_BORDER}
                alignItems="center"
                gap="$2"
              >
                <Users size={28} color={TEXT_SECONDARY} />
                <SizableText size="$3" color={TEXT_SECONDARY} textAlign="center">
                  No return visits yet.{'\n'}Add contacts in Ministry.
                </SizableText>
                <TouchableOpacity
                  onPress={goToMinistry}
                  activeOpacity={0.7}
                  style={{
                    backgroundColor: PRIMARY_SUBTLE,
                    borderRadius: 8,
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderWidth: 1,
                    borderColor: PRIMARY_BORDER,
                  }}
                >
                  <SizableText size="$3" color={PRIMARY} fontWeight="600">
                    Go to Ministry
                  </SizableText>
                </TouchableOpacity>
              </Card>
            ) : (
              <Card
                backgroundColor={CARD_BG}
                borderRadius="$4"
                borderWidth={1}
                borderColor={CARD_BORDER}
                overflow="hidden"
                elevation={2}
              >
                {contacts.slice(0, 2).map((c, idx) => (
                  <YStack key={c.id}>
                    <TouchableOpacity onPress={goToMinistry} activeOpacity={0.7}>
                      <XStack
                        paddingHorizontal="$4"
                        paddingVertical="$3"
                        gap="$3"
                        alignItems="center"
                      >
                        <YStack
                          width={40}
                          height={40}
                          borderRadius={20}
                          backgroundColor={PRIMARY_SUBTLE}
                          justifyContent="center"
                          alignItems="center"
                          borderWidth={1}
                          borderColor={PRIMARY_BORDER}
                        >
                          <SizableText size="$3" color={PRIMARY} fontWeight="800">
                            {c.name.charAt(0).toUpperCase()}
                          </SizableText>
                        </YStack>
                        <YStack flex={1} gap="$0">
                          <SizableText size="$4" color={TEXT_PRIMARY} fontWeight="600">
                            {c.name}
                          </SizableText>
                          <SizableText size="$2" color={TEXT_SECONDARY} numberOfLines={1}>
                            {c.nextVisit
                              ? `Next visit: ${c.nextVisit}`
                              : c.address ?? 'No date set'}
                          </SizableText>
                        </YStack>
                        <ChevronRight size={16} color={TEXT_SECONDARY} />
                      </XStack>
                    </TouchableOpacity>
                    {idx < Math.min(contacts.length, 2) - 1 && (
                      <Separator borderColor={CARD_BORDER} />
                    )}
                  </YStack>
                ))}
              </Card>
            )}
          </YStack>

          {/* ── Quick AI Ask ─────────────────────────────────────────────── */}
          <YStack gap="$2">
            <SectionLabel icon="✨" label="QUICK AI ASK" />
            <Card
              backgroundColor={CARD_BG}
              borderRadius="$4"
              padding="$4"
              borderWidth={1}
              borderColor={CARD_BORDER}
              gap="$3"
              elevation={2}
            >
              <SizableText size="$2" color={TEXT_SECONDARY} lineHeight={18}>
                Ask a question answered only from JW.org &amp; WOL sources.
              </SizableText>
              <XStack
                backgroundColor="#1C1C1E"
                borderRadius="$3"
                borderWidth={1}
                borderColor={CARD_BORDER}
                alignItems="center"
                paddingHorizontal="$3"
                gap="$2"
              >
                <Search size={15} color={TEXT_SECONDARY} />
                <Input
                  flex={1}
                  value={aiQuery}
                  onChangeText={setAiQuery}
                  placeholder="Ask from JW sources only…"
                  placeholderTextColor={TEXT_SECONDARY}
                  color={TEXT_PRIMARY}
                  backgroundColor="transparent"
                  borderWidth={0}
                  size="$3"
                  focusStyle={{ borderWidth: 0, outlineWidth: 0 }}
                  onSubmitEditing={handleAskAI}
                  returnKeyType="search"
                />
              </XStack>
              <TouchableOpacity
                onPress={handleAskAI}
                activeOpacity={0.8}
                style={{
                  backgroundColor: aiQuery.trim() ? PRIMARY : CARD_BORDER,
                  borderRadius: 10,
                  paddingVertical: 11,
                  alignItems: 'center',
                  flexDirection: 'row',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <Zap size={14} color={aiQuery.trim() ? '#fff' : TEXT_SECONDARY} />
                <SizableText
                  size="$3"
                  color={aiQuery.trim() ? '#fff' : TEXT_SECONDARY}
                  fontWeight="700"
                >
                  Ask
                </SizableText>
              </TouchableOpacity>
            </Card>
          </YStack>

          {/* ── Today's Preparation ──────────────────────────────────────── */}
          <YStack gap="$2">
            <SectionLabel icon="📋" label="TODAY'S PREPARATION" />
            <XStack gap="$3">
              <PrepCard
                emoji="📖"
                label="Midweek"
                sublabel="Life &amp; Ministry"
                color={PRIMARY}
                onPress={goToMeetings}
              />
              <PrepCard
                emoji="🏛️"
                label="Watchtower"
                sublabel="Weekend Study"
                color="#7B9E8B"
                onPress={goToMeetings}
              />
              <PrepCard
                emoji="🎯"
                label="Study Plan"
                sublabel="Personal"
                color="#9E7B5A"
                onPress={goToStudy}
              />
            </XStack>
          </YStack>

        </YStack>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function SectionLabel({ icon, label }: { icon: string; label: string }) {
  return (
    <XStack alignItems="center" gap="$2">
      <SizableText style={{ fontSize: 13 }}>{icon}</SizableText>
      <SizableText size="$2" color={TEXT_SECONDARY} fontWeight="700" letterSpacing={1.2}>
        {label}
      </SizableText>
    </XStack>
  );
}

function PrepCard({
  emoji,
  label,
  sublabel,
  color,
  onPress,
}: {
  emoji: string;
  label: string;
  sublabel: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={{ flex: 1 }}
    >
      <Card
        backgroundColor={CARD_BG}
        borderRadius="$4"
        padding="$3"
        borderWidth={1}
        borderColor={CARD_BORDER}
        alignItems="center"
        gap="$2"
        elevation={1}
      >
        <YStack
          width={44}
          height={44}
          borderRadius={22}
          backgroundColor={`${color}22`}
          justifyContent="center"
          alignItems="center"
        >
          <SizableText style={{ fontSize: 22 }}>{emoji}</SizableText>
        </YStack>
        <SizableText size="$2" color={TEXT_PRIMARY} fontWeight="700" textAlign="center">
          {label}
        </SizableText>
        <SizableText size="$1" color={TEXT_SECONDARY} textAlign="center" numberOfLines={2}>
          {sublabel}
        </SizableText>
      </Card>
    </TouchableOpacity>
  );
}
