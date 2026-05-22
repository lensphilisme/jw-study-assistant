import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'expo-router';
import { TouchableOpacity } from 'react-native';
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
    year: 'numeric',
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

function QuickAction({
  title,
  subtitle,
  icon,
  colors: gradientColors,
  onPress,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  colors: readonly string[];
  onPress: () => void;
}) {
  const theme = usePremiumTheme();
  return (
    <TouchableOpacity activeOpacity={0.82} onPress={onPress} style={{ flex: 1, minWidth: 144 }}>
      <YStack borderRadius="$8" overflow="hidden">
        <LinearGradient colors={gradientColors as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <YStack padding="$4" gap="$3" minHeight={136} justifyContent="space-between">
            <XStack justifyContent="space-between" alignItems="center">
              <YStack width={42} height={42} borderRadius={21} alignItems="center" justifyContent="center" backgroundColor="rgba(255,255,255,0.20)" borderWidth={1} borderColor="rgba(255,255,255,0.25)">
                {icon}
              </YStack>
              <ChevronRight size={18} color="rgba(255,255,255,0.86)" />
            </XStack>
            <YStack gap="$1">
              <SizableText size="$4" color="white" fontWeight="900" lineHeight={21}>{title}</SizableText>
              <SizableText size="$2" color={theme.mode === 'dark' ? 'rgba(255,255,255,0.78)' : 'rgba(255,255,255,0.86)'} lineHeight={18}>{subtitle}</SizableText>
            </YStack>
          </YStack>
        </LinearGradient>
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
      <YStack borderRadius="$10" overflow="hidden">
        <LinearGradient colors={colors.royalGradient as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <YStack padding="$5" gap="$5" minHeight={238}>
            <XStack justifyContent="space-between" alignItems="flex-start">
              <YStack flex={1} gap="$2">
                <SizableText size="$2" color="rgba(255,255,255,0.72)" fontWeight="900" letterSpacing={1.3}>
                  {formatDate(new Date(), displaySymbol).toUpperCase()}
                </SizableText>
                <SizableText fontSize={34} lineHeight={39} color="white" fontWeight="900">
                  {greeting}{userName ? `, ${userName}` : ''}
                </SizableText>
                <SizableText size="$3" color="rgba(255,255,255,0.78)" lineHeight={22} maxWidth={520}>
                  {translate(displaySymbol, 'home_hero_subtitle')}
                </SizableText>
              </YStack>
              <TouchableOpacity onPress={() => router.push('/(tabs)/settings')} activeOpacity={0.75}>
                <XStack alignItems="center" gap="$2" backgroundColor="rgba(255,255,255,0.16)" borderWidth={1} borderColor="rgba(255,255,255,0.24)" borderRadius="$10" paddingHorizontal="$3" paddingVertical="$2">
                  <Globe size={14} color="white" />
                  <SizableText size="$2" color="white" fontWeight="900">{language.toUpperCase()}</SizableText>
                </XStack>
              </TouchableOpacity>
            </XStack>
            <XStack gap="$3" flexWrap="wrap">
              <QuickAction
                title={translate(displaySymbol, 'daily_text')}
                subtitle={translate(displaySymbol, 'read_full_daily_text')}
                icon={<BookOpen size={20} color="white" />}
                colors={colors.sunriseGradient}
                onPress={goToDailyText}
              />
              <QuickAction
                title={translate(displaySymbol, 'ask_from_sources')}
                subtitle={translate(displaySymbol, 'search_jw_sources')}
                icon={<Sparkles size={20} color="white" />}
                colors={colors.oceanGradient}
                onPress={() => goToSearch(undefined, true)}
              />
            </XStack>
          </YStack>
        </LinearGradient>
      </YStack>

      <YStack borderRadius="$9" overflow="hidden">
        <LinearGradient colors={colors.mode === 'dark' ? ['rgba(255,255,255,0.12)', 'rgba(139,227,178,0.08)'] : ['rgba(255,255,255,0.98)', 'rgba(255,240,215,0.88)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <YStack padding="$5" gap="$4" borderWidth={1} borderColor={colors.borderStrong} borderRadius="$9">
            <XStack justifyContent="space-between" alignItems="center" gap="$3">
              <YStack gap="$1" flex={1}>
                <PremiumBadge>{translate(displaySymbol, 'today')}</PremiumBadge>
                <SizableText size="$6" color={colors.text} fontWeight="900">{translate(displaySymbol, 'todays_daily_text')}</SizableText>
              </YStack>
              <YStack width={52} height={52} borderRadius={26} backgroundColor={colors.glow} alignItems="center" justifyContent="center" borderWidth={1} borderColor={colors.border}>
                <BookOpen size={23} color={colors.primary} />
              </YStack>
            </XStack>
            {loadingText ? (
              <XStack gap="$3" alignItems="center" minHeight={96}>
                <Spinner size="small" color={colors.primary} />
                <SizableText color={colors.textMuted}>{translate(displaySymbol, 'loading_daily_text')}</SizableText>
              </XStack>
            ) : textError ? (
              <YStack gap="$3">
                <XStack gap="$2" alignItems="center">
                  <AlertTriangle size={18} color={colors.warning} />
                  <SizableText color={colors.warning} fontWeight="900">{translate(displaySymbol, 'could_not_load_daily_text')}</SizableText>
                </XStack>
                <GradientButton onPress={() => setRetryCount((c) => c + 1)} icon={<RefreshCw size={15} color="white" />}>{translate(displaySymbol, 'retry')}</GradientButton>
              </YStack>
            ) : dailyText ? (
              <YStack gap="$3">
                <SizableText size="$7" color={colors.text} fontWeight="900" lineHeight={32}>{dailyText.scripture}</SizableText>
                <SizableText size="$3" color={colors.textMuted} lineHeight={23} numberOfLines={4}>
                  {dailyText.comment}
                </SizableText>
                <GradientButton onPress={goToDailyText} icon={<ChevronRight size={15} color="white" />}>{translate(displaySymbol, 'read_full_daily_text')}</GradientButton>
              </YStack>
            ) : (
              <EmptyState title={translate(displaySymbol, 'tap_to_load_daily_text')} action={<GradientButton onPress={() => setRetryCount((c) => c + 1)}>{translate(displaySymbol, 'retry')}</GradientButton>} />
            )}
          </YStack>
        </LinearGradient>
      </YStack>

      <XStack gap="$3" flexWrap="wrap">
        <QuickAction
          title={translate(displaySymbol, 'meetings')}
          subtitle={translate(displaySymbol, 'this_weeks_meetings')}
          icon={<Calendar size={20} color="white" />}
          colors={colors.accentGradient}
          onPress={() => router.push('/(tabs)/meetings')}
        />
        <QuickAction
          title={translate(displaySymbol, 'field')}
          subtitle={loadingContacts ? translate(displaySymbol, 'loading_daily_text') : `${contacts.length} ${translate(displaySymbol, 'saved_items').toLowerCase()}`}
          icon={<Users size={20} color="white" />}
          colors={colors.sunriseGradient}
          onPress={() => router.push('/(tabs)/ministry')}
        />
        <QuickAction
          title={translate(displaySymbol, 'library')}
          subtitle={translate(displaySymbol, 'saved_library')}
          icon={<Bookmark size={20} color="white" />}
          colors={colors.oceanGradient}
          onPress={() => router.push('/(tabs)/saved')}
        />
      </XStack>

      <YStack gap="$3">
        <SectionHeader title={translate(displaySymbol, 'this_weeks_meetings')} subtitle={`${getMeetingDate(2, displaySymbol)} / ${getMeetingDate(6, displaySymbol)}`} />
        <ContentCard
          title={translate(displaySymbol, 'midweek_meeting')}
          subtitle={translate(displaySymbol, 'life_ministry')}
          icon={<BookOpen size={18} color={colors.primary} />}
          action={<ChevronRight size={18} color={colors.textMuted} />}
          onPress={() => router.push('/(tabs)/meetings')}
        />
        <ContentCard
          title={translate(displaySymbol, 'watchtower_study')}
          subtitle={translate(displaySymbol, 'weekend_meeting')}
          icon={<BookMarked size={18} color={colors.accent} />}
          action={<ChevronRight size={18} color={colors.textMuted} />}
          onPress={() => router.push('/(tabs)/meetings')}
        />
      </YStack>

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

      <YStack gap="$3">
        <SectionHeader title={translate(displaySymbol, 'upcoming_return_visits')} />
        {loadingContacts ? (
          <PremiumCard><Spinner size="small" color={colors.primary} /></PremiumCard>
        ) : contacts.length === 0 ? (
          <EmptyState
            icon={<Users size={34} color={colors.primary} />}
            title={translate(displaySymbol, 'no_return_visits')}
            action={<GradientButton onPress={() => router.push('/(tabs)/ministry')}>{translate(displaySymbol, 'go_to_ministry')}</GradientButton>}
          />
        ) : (
          <PremiumCard padded={false}>
            {contacts.slice(0, 3).map((c, idx) => (
              <YStack key={c.id}>
                <XStack padding="$4" gap="$3" alignItems="center" onPress={() => router.push('/(tabs)/ministry')} pressStyle={{ opacity: 0.74 }}>
                  <YStack width={42} height={42} borderRadius={21} backgroundColor={colors.glow} justifyContent="center" alignItems="center" borderWidth={1} borderColor={colors.border}>
                    <SizableText color={colors.primary} fontWeight="900">{c.name.charAt(0).toUpperCase()}</SizableText>
                  </YStack>
                  <YStack flex={1}>
                    <SizableText color={colors.text} size="$4" fontWeight="900">{c.name}</SizableText>
                    <SizableText color={colors.textMuted} size="$2" numberOfLines={1}>
                      {c.nextVisit ? `${translate(displaySymbol, 'next_visit')}: ${c.nextVisit}` : c.address ?? translate(displaySymbol, 'no_date_set')}
                    </SizableText>
                  </YStack>
                  <ChevronRight size={16} color={colors.textMuted} />
                </XStack>
                {idx < Math.min(contacts.length, 3) - 1 ? <Separator borderColor={colors.border} /> : null}
              </YStack>
            ))}
          </PremiumCard>
        )}
      </YStack>
    </AppScreen>
  );
}
