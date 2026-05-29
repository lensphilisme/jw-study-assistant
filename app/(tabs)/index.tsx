import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'expo-router';
import { TouchableOpacity, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  YStack,
  XStack,
  SizableText,
  Spinner,
  Separator,
  BookOpen,
  Search,
  Users,
  ChevronRight,
  Globe,
  Calendar,
  Zap,
  AlertTriangle,
  RefreshCw,
  BookMarked,
  Bookmark,
  Sparkles,
} from '@blinkdotnew/mobile-ui';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppStore } from '@/store/appStore';
import { translate } from '@/services/i18nService';
import { getDailyText as getNormalizedDailyText, normalizeAppLanguage } from '@/services/sourceGatewayService';
import type { Language } from '@/types';
import { usePremiumTheme } from '@/hooks/usePremiumTheme';
import { AppScreen, ContentCard, EmptyState, GradientButton, PremiumBadge, PremiumCard, SearchBar, SectionHeader } from '@/components/premium';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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

function getLocaleId(symbol: string): string {
  if (symbol === 'ht') return 'fr-HT';
  return symbol;
}

function formatDate(d: Date, symbol: string): string {
  return d.toLocaleDateString(getLocaleId(symbol), {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

function getMeetingDate(offsetTo: number, symbol: string): string {
  const d = new Date();
  const day = d.getDay();
  const diff = day <= offsetTo ? offsetTo - day : 7 + offsetTo - day;
  d.setDate(d.getDate() + diff);
  return d.toLocaleDateString(getLocaleId(symbol), { weekday: 'short', month: 'short', day: 'numeric' });
}

async function fetchDailyText(language: Language): Promise<DailyText | null> {
  const lang = normalizeAppLanguage(language);
  const now = new Date();
  const result = await getNormalizedDailyText({ date: now, language: lang });
  const data = result.data;
  if (!data.scriptureRef && !data.commentText) return null;
  return {
    date: data.date || formatDate(now, lang.symbol),
    scripture: data.scriptureRef,
    comment: data.commentText,
    fullUrl: data.sourceUrl,
  };
}

function QuickActionCard({
  title,
  subtitle,
  icon,
  gradient,
  onPress,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  gradient: readonly string[];
  onPress: () => void;
}) {
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={{ flex: 1, minWidth: 150 }}>
      <YStack borderRadius="$7" overflow="hidden">
        <LinearGradient colors={gradient as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <YStack padding="$4" gap="$3" minHeight={130} justifyContent="space-between">
            <XStack justifyContent="space-between" alignItems="center">
              <YStack
                width={44}
                height={44}
                borderRadius={22}
                alignItems="center"
                justifyContent="center"
                backgroundColor="rgba(255,255,255,0.2)"
              >
                {icon}
              </YStack>
              <ChevronRight size={18} color="rgba(255,255,255,0.8)" />
            </XStack>
            <YStack gap="$1">
              <SizableText size="$4" color="white" fontWeight="900">{title}</SizableText>
              <SizableText size="$2" color="rgba(255,255,255,0.75)" lineHeight={16}>{subtitle}</SizableText>
            </YStack>
          </YStack>
        </LinearGradient>
      </YStack>
    </TouchableOpacity>
  );
}

function MeetingCard({
  title,
  subtitle,
  date,
  icon,
  color,
  onPress,
}: {
  title: string;
  subtitle: string;
  date: string;
  icon: React.ReactNode;
  color: string;
  onPress: () => void;
}) {
  const colors = usePremiumTheme();
  return (
    <TouchableOpacity activeOpacity={0.8} onPress={onPress}>
      <YStack
        backgroundColor={colors.surface}
        borderRadius="$6"
        padding="$4"
        borderWidth={1}
        borderColor={colors.border}
        borderLeftWidth={3}
        borderLeftColor={color}
      >
        <XStack alignItems="center" gap="$3">
          <YStack
            width={46}
            height={46}
            borderRadius={23}
            backgroundColor={`${color}20`}
            alignItems="center"
            justifyContent="center"
          >
            {icon}
          </YStack>
          <YStack flex={1} gap="$1">
            <SizableText size="$4" color={colors.text} fontWeight="800">{title}</SizableText>
            <SizableText size="$2" color={colors.textMuted}>{subtitle}</SizableText>
          </YStack>
          <YStack alignItems="flex-end" gap="$1">
            <YStack backgroundColor={colors.surface2} borderRadius="$2" paddingHorizontal="$2" paddingVertical="$1">
              <SizableText size="$1" color={colors.textMuted} fontWeight="700">{date}</SizableText>
            </YStack>
            <ChevronRight size={16} color={colors.textMuted} />
          </YStack>
        </XStack>
      </YStack>
    </TouchableOpacity>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const colors = usePremiumTheme();
  const appLanguage = useAppStore((s) => s.appLanguage);
  const fallbackLanguage = useAppStore((s) => s.language);
  const contentLanguage = useAppStore((s) => s.contentLanguage || s.language);
  const activeContentLanguage = useMemo(
    () => normalizeAppLanguage(contentLanguage || fallbackLanguage),
    [contentLanguage, fallbackLanguage]
  );
  const displaySymbol = appLanguage?.symbol || 'en';
  const language = activeContentLanguage.symbol || 'en';
  const expectedDailyTextPath = `/${language}/wol/dt/${activeContentLanguage.wolRegion}/${activeContentLanguage.wolLangParam}/`;

  const [dailyText, setDailyText] = useState<DailyText | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loadingText, setLoadingText] = useState(true);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [textError, setTextError] = useState(false);
  const [aiQuery, setAiQuery] = useState('');
  const [retryCount, setRetryCount] = useState(0);
  const [userName, setUserName] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem('jw_sa:user_name').then((n) => {
      if (n) setUserName(n);
    });
  }, []);

  useEffect(() => {
    AsyncStorage.getItem('jw_sa:contacts')
      .then((raw) => {
        if (raw) setContacts(JSON.parse(raw));
      })
      .catch(() => {})
      .finally(() => setLoadingContacts(false));
  }, []);

  const loadDailyText = useCallback(async () => {
    setLoadingText(true);
    setTextError(false);
    const today = new Date().toISOString().slice(0, 10);
    const cacheKey = `daily_text_${language}_${activeContentLanguage.wolRegion}_${activeContentLanguage.wolLangParam}_${today}`;
    try {
      const cached = await AsyncStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached) as DailyText;
        if (parsed.fullUrl?.includes(expectedDailyTextPath) && !/meeting program|reyinyon|Ann egzamine Ekriti yo chak jou/i.test(parsed.comment)) {
          setDailyText(parsed);
          setLoadingText(false);
          return;
        }
        await AsyncStorage.removeItem(cacheKey);
      }
      const data = await fetchDailyText(activeContentLanguage);
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
  }, [activeContentLanguage, language, expectedDailyTextPath, retryCount]);

  useEffect(() => {
    loadDailyText();
  }, [loadDailyText]);

  const goToDailyText = () => router.push({ pathname: '/daily-text', params: { date: new Date().toISOString().slice(0, 10) } });
  const goToSearch = (q?: string, ai?: boolean) => router.push({ pathname: '/(tabs)/search', params: q ? { query: q, aiMode: ai ? 'true' : undefined } : undefined });
  const handleAskAI = () => {
    if (aiQuery.trim()) goToSearch(aiQuery.trim(), true);
  };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? translate(displaySymbol, 'good_morning') : hour < 17 ? translate(displaySymbol, 'good_afternoon') : translate(displaySymbol, 'good_evening');

  return (
    <AppScreen scroll>
      {/* Hero Section */}
      <YStack borderRadius="$8" overflow="hidden">
        <LinearGradient colors={colors.royalGradient as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <YStack padding="$5" gap="$4" minHeight={180}>
            <XStack justifyContent="space-between" alignItems="flex-start">
              <YStack flex={1} gap="$1">
                <SizableText size="$2" color="rgba(255,255,255,0.65)" fontWeight="800" letterSpacing={1}>
                  {formatDate(new Date(), displaySymbol).toUpperCase()}
                </SizableText>
                <SizableText fontSize={28} lineHeight={34} color="white" fontWeight="900">
                  {greeting}{userName ? `,` : ''}
                </SizableText>
                {userName && (
                  <SizableText fontSize={28} lineHeight={34} color="white" fontWeight="900">
                    {userName}
                  </SizableText>
                )}
              </YStack>
              <TouchableOpacity onPress={() => router.push('/(tabs)/settings')} activeOpacity={0.75}>
                <XStack
                  alignItems="center"
                  gap="$2"
                  backgroundColor="rgba(255,255,255,0.15)"
                  borderRadius="$10"
                  paddingHorizontal="$3"
                  paddingVertical="$2"
                >
                  <Globe size={14} color="white" />
                  <SizableText size="$2" color="white" fontWeight="800">{language.toUpperCase()}</SizableText>
                </XStack>
              </TouchableOpacity>
            </XStack>
          </YStack>
        </LinearGradient>
      </YStack>

      {/* Quick Actions */}
      <XStack gap="$3" flexWrap="wrap">
        <QuickActionCard
          title={translate(displaySymbol, 'daily_text')}
          subtitle={translate(displaySymbol, 'read_full_daily_text')}
          icon={<BookOpen size={22} color="white" />}
          gradient={colors.sunriseGradient}
          onPress={goToDailyText}
        />
        <QuickActionCard
          title={translate(displaySymbol, 'ask_from_sources')}
          subtitle={translate(displaySymbol, 'search_jw_sources')}
          icon={<Sparkles size={22} color="white" />}
          gradient={colors.oceanGradient}
          onPress={() => goToSearch(undefined, true)}
        />
      </XStack>

      {/* Daily Text Card */}
      <YStack gap="$3">
        <SectionHeader title={translate(displaySymbol, 'todays_daily_text')} />
        <YStack borderRadius="$7" overflow="hidden">
          <LinearGradient
            colors={colors.mode === 'dark' ? ['rgba(255,255,255,0.08)', 'rgba(139,227,178,0.06)'] : ['rgba(255,255,255,0.95)', 'rgba(255,240,215,0.8)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <YStack padding="$5" gap="$4" borderWidth={1} borderColor={colors.border} borderRadius="$7">
              {loadingText ? (
                <XStack gap="$3" alignItems="center" minHeight={80}>
                  <Spinner size="small" color={colors.primary} />
                  <SizableText color={colors.textMuted}>{translate(displaySymbol, 'loading_daily_text')}</SizableText>
                </XStack>
              ) : textError ? (
                <YStack gap="$3">
                  <XStack gap="$2" alignItems="center">
                    <AlertTriangle size={18} color={colors.warning} />
                    <SizableText color={colors.warning} fontWeight="800">{translate(displaySymbol, 'could_not_load_daily_text')}</SizableText>
                  </XStack>
                  <GradientButton onPress={() => setRetryCount((c) => c + 1)} icon={<RefreshCw size={15} color="white" />}>
                    {translate(displaySymbol, 'retry')}
                  </GradientButton>
                </YStack>
              ) : dailyText ? (
                <YStack gap="$3">
                  <SizableText size="$6" color={colors.text} fontWeight="900" lineHeight={30}>
                    {dailyText.scripture}
                  </SizableText>
                  <SizableText size="$3" color={colors.textMuted} lineHeight={22} numberOfLines={3}>
                    {dailyText.comment}
                  </SizableText>
                  <GradientButton onPress={goToDailyText} icon={<ChevronRight size={15} color="white" />}>
                    {translate(displaySymbol, 'read_full_daily_text')}
                  </GradientButton>
                </YStack>
              ) : (
                <EmptyState
                  title={translate(displaySymbol, 'tap_to_load_daily_text')}
                  action={<GradientButton onPress={() => setRetryCount((c) => c + 1)}>{translate(displaySymbol, 'retry')}</GradientButton>}
                />
              )}
            </YStack>
          </LinearGradient>
        </YStack>
      </YStack>

      {/* This Week's Meetings */}
      <YStack gap="$3">
        <SectionHeader title={translate(displaySymbol, 'this_weeks_meetings')} />
        <MeetingCard
          title={translate(displaySymbol, 'midweek_meeting')}
          subtitle={translate(displaySymbol, 'life_ministry')}
          date={getMeetingDate(2, displaySymbol)}
          icon={<BookOpen size={22} color={colors.primary} />}
          color={colors.primary}
          onPress={() => router.push('/(tabs)/meetings')}
        />
        <MeetingCard
          title={translate(displaySymbol, 'watchtower_study')}
          subtitle={translate(displaySymbol, 'weekend_meeting')}
          date={getMeetingDate(6, displaySymbol)}
          icon={<BookMarked size={22} color={colors.accent} />}
          color={colors.accent}
          onPress={() => router.push('/(tabs)/meetings')}
        />
      </YStack>

      {/* AI Search */}
      <YStack gap="$3">
        <SectionHeader title={translate(displaySymbol, 'quick_ai_ask')} subtitle={translate(displaySymbol, 'ask_ai_sources_hint')} />
        <PremiumCard>
          <YStack gap="$3">
            <SearchBar
              value={aiQuery}
              onChangeText={setAiQuery}
              placeholder={translate(displaySymbol, 'ask_jw_sources_placeholder')}
              onSubmitEditing={handleAskAI}
            />
            <GradientButton onPress={handleAskAI} disabled={!aiQuery.trim()} icon={<Zap size={15} color="white" />}>
              {translate(displaySymbol, 'ask')}
            </GradientButton>
          </YStack>
        </PremiumCard>
      </YStack>

      {/* More Quick Links */}
      <YStack gap="$3">
        <SectionHeader title={translate(displaySymbol, 'quick_access')} />
        <XStack gap="$3" flexWrap="wrap">
          <QuickActionCard
            title={translate(displaySymbol, 'field')}
            subtitle={`${contacts.length} ${translate(displaySymbol, 'contacts').toLowerCase()}`}
            icon={<Users size={22} color="white" />}
            gradient={colors.accentGradient}
            onPress={() => router.push('/(tabs)/ministry')}
          />
          <QuickActionCard
            title={translate(displaySymbol, 'library')}
            subtitle={translate(displaySymbol, 'saved_library')}
            icon={<Bookmark size={22} color="white" />}
            gradient={['#7B6B9E', '#5B5B8E'] as any}
            onPress={() => router.push('/(tabs)/saved')}
          />
        </XStack>
      </YStack>

      {/* Return Visits */}
      {!loadingContacts && contacts.length > 0 && (
        <YStack gap="$3">
          <SectionHeader title={translate(displaySymbol, 'upcoming_return_visits')} />
          <PremiumCard padded={false}>
            {contacts.slice(0, 3).map((c, idx) => (
              <YStack key={c.id}>
                <TouchableOpacity activeOpacity={0.7} onPress={() => router.push('/(tabs)/ministry')}>
                  <XStack padding="$4" gap="$3" alignItems="center">
                    <YStack
                      width={44}
                      height={44}
                      borderRadius={22}
                      backgroundColor={colors.glow}
                      justifyContent="center"
                      alignItems="center"
                    >
                      <SizableText color={colors.primary} fontWeight="900" size="$5">
                        {c.name.charAt(0).toUpperCase()}
                      </SizableText>
                    </YStack>
                    <YStack flex={1}>
                      <SizableText color={colors.text} size="$4" fontWeight="800">{c.name}</SizableText>
                      <SizableText color={colors.textMuted} size="$2" numberOfLines={1}>
                        {c.nextVisit ? `${translate(displaySymbol, 'next_visit')}: ${c.nextVisit}` : c.address ?? translate(displaySymbol, 'no_date_set')}
                      </SizableText>
                    </YStack>
                    <ChevronRight size={16} color={colors.textMuted} />
                  </XStack>
                </TouchableOpacity>
                {idx < Math.min(contacts.length, 3) - 1 && <Separator borderColor={colors.border} />}
              </YStack>
            ))}
          </PremiumCard>
        </YStack>
      )}

      {/* Bottom spacer for tab bar */}
      <YStack height={20} />
    </AppScreen>
  );
}
