import { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { createTranslator, DISPLAY_LANGUAGES, saveLanguagePair } from '@/services/i18nService';
import { getLanguageBySymbol } from '@/services/languageService';
import { useAppStore } from '@/store/appStore';
import type { Language as AppLanguage } from '@/types';
import {
  YStack,
  XStack,
  SizableText,
  H1,
  H2,
  Paragraph,
  Button,
  Input,
  ScrollView,
  Spinner,
  Card,
  BookOpen,
  Search,
  Users,
  Calendar,
  Check,
  ChevronRight,
  Globe,
  Bookmark,
  Sparkles,
} from '@blinkdotnew/mobile-ui';
import { usePremiumTheme } from '@/hooks/usePremiumTheme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Language {
  name: string;
  langCode: string;
  symbol: string;
  direction: string;
}

interface SpiritualProfile {
  spiritualStatus: string;
  ageRange: string;
  maritalStatus: string;
  studyInterests: string;
}

const FALLBACK_LANGUAGES: Language[] = [
  { name: 'English', langCode: 'E', symbol: 'en', direction: 'ltr' },
  { name: 'Spanish', langCode: 'S', symbol: 'es', direction: 'ltr' },
  { name: 'French', langCode: 'F', symbol: 'fr', direction: 'ltr' },
  { name: 'Portuguese', langCode: 'T', symbol: 'pt', direction: 'ltr' },
  { name: 'German', langCode: 'X', symbol: 'de', direction: 'ltr' },
  { name: 'Italian', langCode: 'I', symbol: 'it', direction: 'ltr' },
  { name: 'Russian', langCode: 'U', symbol: 'ru', direction: 'ltr' },
  { name: 'Japanese', langCode: 'J', symbol: 'ja', direction: 'ltr' },
  { name: 'Korean', langCode: 'Ko', symbol: 'ko', direction: 'ltr' },
  { name: 'Haitian Creole', langCode: 'CR', symbol: 'ht', direction: 'ltr' },
];

const SPIRITUAL_STATUSES = [
  'Publisher',
  'Baptized',
  'Pioneer',
  'Elder',
  'Ministerial Servant',
  'Bible Student',
  'Interested Person',
];

const AGE_RANGES = ['Under 18', '18-25', '26-35', '36-50', '51-65', 'Over 65'];
const MARITAL_STATUSES = ['Single', 'Married', 'Widowed'];

function StepIndicator({ current, total }: { current: number; total: number }) {
  const colors = usePremiumTheme();
  return (
    <XStack gap="$2" justifyContent="center" alignItems="center">
      {Array.from({ length: total }).map((_, i) => (
        <YStack
          key={i}
          width={i === current ? 32 : 8}
          height={8}
          borderRadius={4}
          backgroundColor={i === current ? colors.primary : i < current ? colors.primaryDeep : colors.surface3}
          opacity={i <= current ? 1 : 0.5}
        />
      ))}
    </XStack>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  const colors = usePremiumTheme();
  return (
    <YStack
      backgroundColor={colors.surface}
      borderRadius="$6"
      padding="$4"
      gap="$2"
      borderWidth={1}
      borderColor={colors.border}
      width={(SCREEN_WIDTH - 60) / 2}
    >
      <YStack
        width={44}
        height={44}
        borderRadius={22}
        backgroundColor={colors.glow}
        alignItems="center"
        justifyContent="center"
      >
        {icon}
      </YStack>
      <SizableText size="$4" color={colors.text} fontWeight="800">{title}</SizableText>
      <SizableText size="$2" color={colors.textMuted} lineHeight={18}>{description}</SizableText>
    </YStack>
  );
}

function SelectableOption({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const colors = usePremiumTheme();
  return (
    <TouchableOpacity activeOpacity={0.7} onPress={onPress}>
      <XStack
        backgroundColor={selected ? colors.glow : colors.surface}
        borderRadius="$4"
        paddingHorizontal="$4"
        paddingVertical="$3"
        borderWidth={1.5}
        borderColor={selected ? colors.primary : colors.border}
        alignItems="center"
        justifyContent="space-between"
      >
        <SizableText size="$4" color={selected ? colors.primary : colors.text} fontWeight={selected ? '700' : '500'}>
          {label}
        </SizableText>
        {selected && (
          <YStack
            width={22}
            height={22}
            borderRadius={11}
            backgroundColor={colors.primary}
            alignItems="center"
            justifyContent="center"
          >
            <Check size={14} color="white" />
          </YStack>
        )}
      </XStack>
    </TouchableOpacity>
  );
}

// Step 0: Welcome
function WelcomeStep({ onNext, t }: { onNext: () => void; t: ReturnType<typeof createTranslator> }) {
  const colors = usePremiumTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <YStack flex={1} justifyContent="space-between">
      <LinearGradient
        colors={colors.heroGradient as any}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 400 }}
      />
      <YStack position="absolute" top={-60} right={-60} width={200} height={200} borderRadius={100} backgroundColor={colors.glowBlue} opacity={0.4} />
      <YStack position="absolute" bottom={100} left={-80} width={240} height={240} borderRadius={120} backgroundColor={colors.glow} opacity={0.3} />

      <ScrollView flex={1} showsVerticalScrollIndicator={false}>
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          <YStack padding="$6" paddingTop="$10" gap="$6" alignItems="center">
            <YStack
              width={100}
              height={100}
              borderRadius={50}
              backgroundColor={colors.glow}
              alignItems="center"
              justifyContent="center"
              borderWidth={2}
              borderColor={colors.primary}
            >
              <BookOpen size={48} color={colors.primary} />
            </YStack>

            <YStack alignItems="center" gap="$2">
              <SizableText size="$2" color={colors.primary} fontWeight="900" letterSpacing={2}>
                WELCOME TO
              </SizableText>
              <H1 color={colors.text} fontWeight="900" textAlign="center" lineHeight={42} style={{ fontSize: 36 }}>
                JW Study{'\n'}Assistant
              </H1>
              <Paragraph size="$4" color={colors.textMuted} textAlign="center" lineHeight={24} maxWidth={300}>
                {t('onboarding_intro')}
              </Paragraph>
            </YStack>

            <XStack gap="$3" flexWrap="wrap" justifyContent="center">
              <FeatureCard
                icon={<BookOpen size={22} color={colors.primary} />}
                title={t('study_tools')}
                description="Daily text, meeting prep, personal study"
              />
              <FeatureCard
                icon={<Search size={22} color={colors.accent} />}
                title={t('smart_search')}
                description="AI-powered search across JW sources"
              />
              <FeatureCard
                icon={<Users size={22} color={colors.gold} />}
                title={t('ministry')}
                description="Track visits and Bible studies"
              />
              <FeatureCard
                icon={<Bookmark size={22} color={colors.violet} />}
                title={t('saved_items')}
                description="Save and organize your research"
              />
            </XStack>
          </YStack>
        </Animated.View>
      </ScrollView>

      <YStack padding="$6" paddingTop="$3" gap="$3">
        <YStack
          backgroundColor={colors.surface}
          borderRadius="$4"
          padding="$3"
          borderLeftWidth={3}
          borderLeftColor={colors.primary}
        >
          <SizableText size="$2" color={colors.textMuted} lineHeight={18}>
            {t('short_disclaimer')}
          </SizableText>
        </YStack>

        <YStack borderRadius="$5" overflow="hidden">
          <LinearGradient colors={colors.buttonGradient as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            <Button
              size="$5"
              borderRadius="$5"
              backgroundColor="transparent"
              color="white"
              fontWeight="800"
              pressStyle={{ opacity: 0.9 }}
              onPress={onNext}
              icon={<ChevronRight size={18} color="white" />}
              iconAfter
            >
              {t('get_started')}
            </Button>
          </LinearGradient>
        </YStack>
      </YStack>
    </YStack>
  );
}

// Step 1: Name
function NameStep({ name, setName, onNext, t }: { name: string; setName: (n: string) => void; onNext: () => void; t: ReturnType<typeof createTranslator> }) {
  const colors = usePremiumTheme();
  return (
    <YStack flex={1} padding="$6" justifyContent="center" gap="$6">
      <YStack alignItems="center" gap="$3">
        <YStack
          width={80}
          height={80}
          borderRadius={40}
          backgroundColor={colors.glowBlue}
          alignItems="center"
          justifyContent="center"
        >
          <Users size={36} color={colors.accent} />
        </YStack>
        <H2 color={colors.text} fontWeight="900" textAlign="center">{t('what_is_your_name')}</H2>
        <Paragraph size="$3" color={colors.textMuted} textAlign="center">
          This helps personalize your experience
        </Paragraph>
      </YStack>

      <YStack gap="$4">
        <Input
          value={name}
          onChangeText={setName}
          placeholder={t('enter_your_name')}
          placeholderTextColor={colors.textMuted}
          autoFocus
          size="$5"
          backgroundColor={colors.surface}
          borderColor={colors.border}
          borderWidth={1}
          borderRadius="$4"
          color={colors.text}
          textAlign="center"
          maxLength={32}
          paddingHorizontal="$4"
        />

        <YStack borderRadius="$5" overflow="hidden" opacity={name.trim() ? 1 : 0.5}>
          <LinearGradient colors={colors.buttonGradient as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            <Button
              size="$5"
              borderRadius="$5"
              backgroundColor="transparent"
              color="white"
              fontWeight="800"
              disabled={!name.trim()}
              onPress={onNext}
            >
              {t('continue')}
            </Button>
          </LinearGradient>
        </YStack>
      </YStack>
    </YStack>
  );
}

// Step 2: Language
function LanguageStep({
  onNext,
  selectedLanguage,
  onSelectLanguage,
  t,
}: {
  onNext: () => void;
  selectedLanguage: Language | null;
  onSelectLanguage: (lang: Language) => void;
  t: ReturnType<typeof createTranslator>;
}) {
  const colors = usePremiumTheme();
  const [languages, setLanguages] = useState<Language[]>([]);
  const [filtered, setFiltered] = useState<Language[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const normalizeApiLanguage = (l: any): Language | null => {
    const langCode = String(l?.langCode ?? l?.langcode ?? l?.code ?? '').trim();
    const symbol = String(l?.symbol ?? l?.locale ?? l?.localeCode ?? '').trim().toLowerCase();
    const name = String(l?.name ?? l?.vernacularName ?? l?.englishName ?? langCode ?? symbol ?? '').trim();
    if (!name || (!langCode && !symbol)) return null;
    return {
      name,
      langCode: langCode || symbol.toUpperCase(),
      symbol: symbol || langCode.toLowerCase(),
      direction: l?.direction === 'rtl' ? 'rtl' : 'ltr',
    };
  };

  useEffect(() => {
    fetch('https://b.jw-cdn.org/apis/mediator/v1/languages/E/web?clientType=www')
      .then((r) => r.json())
      .then((data) => {
        const langs: Language[] = (data.languages || [])
          .map(normalizeApiLanguage)
          .filter(Boolean) as Language[];
        const sorted = langs.sort((a, b) => a.name.localeCompare(b.name));
        setLanguages(sorted);
        setFiltered(sorted);
      })
      .catch(() => {
        setLanguages(FALLBACK_LANGUAGES);
        setFiltered(FALLBACK_LANGUAGES);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setFiltered(languages);
    } else {
      setFiltered(languages.filter((l) => l.name.toLowerCase().includes(query.toLowerCase())));
    }
  }, [query, languages]);

  const renderItem = ({ item }: { item: Language }) => {
    const isSelected = selectedLanguage?.langCode === item.langCode || selectedLanguage?.symbol === item.symbol;
    return (
      <TouchableOpacity activeOpacity={0.7} onPress={() => onSelectLanguage(item)}>
        <XStack
          backgroundColor={isSelected ? colors.glow : 'transparent'}
          borderRadius="$4"
          paddingHorizontal="$4"
          paddingVertical="$3"
          marginHorizontal="$5"
          marginBottom="$2"
          alignItems="center"
          gap="$3"
          borderWidth={1}
          borderColor={isSelected ? colors.primary : 'transparent'}
        >
          <YStack
            width={40}
            height={40}
            borderRadius={20}
            backgroundColor={isSelected ? colors.primary : colors.surface2}
            alignItems="center"
            justifyContent="center"
          >
            <SizableText size="$3" color={isSelected ? 'white' : colors.textMuted} fontWeight="800">
              {item.symbol.slice(0, 2).toUpperCase()}
            </SizableText>
          </YStack>
          <SizableText size="$4" color={isSelected ? colors.primary : colors.text} fontWeight={isSelected ? '700' : '500'} flex={1}>
            {item.name}
          </SizableText>
          {isSelected && <Check size={20} color={colors.primary} />}
        </XStack>
      </TouchableOpacity>
    );
  };

  return (
    <YStack flex={1}>
      <YStack padding="$6" paddingBottom="$3" gap="$4">
        <YStack gap="$2">
          <XStack alignItems="center" gap="$2">
            <Globe size={20} color={colors.primary} />
            <SizableText size="$2" color={colors.primary} fontWeight="800" letterSpacing={1}>
              STEP 2 OF 4
            </SizableText>
          </XStack>
          <H2 color={colors.text} fontWeight="900" style={{ fontSize: 28 }}>{t('choose_your_language')}</H2>
          <Paragraph size="$3" color={colors.textMuted}>{t('select_language_study_materials')}</Paragraph>
        </YStack>

        <XStack
          backgroundColor={colors.surface}
          borderRadius="$4"
          borderWidth={1}
          borderColor={colors.border}
          alignItems="center"
          paddingHorizontal="$4"
          gap="$2"
        >
          <Search size={18} color={colors.textMuted} />
          <Input
            flex={1}
            value={query}
            onChangeText={setQuery}
            placeholder={t('search_languages')}
            placeholderTextColor={colors.textMuted}
            color={colors.text}
            backgroundColor="transparent"
            borderWidth={0}
            size="$4"
            focusStyle={{ borderWidth: 0, outlineWidth: 0 }}
          />
        </XStack>
      </YStack>

      {loading ? (
        <YStack flex={1} justifyContent="center" alignItems="center" gap="$3">
          <Spinner size="large" color={colors.primary} />
          <SizableText size="$3" color={colors.textMuted}>{t('loading_languages')}</SizableText>
        </YStack>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item, index) => `${item.langCode || item.symbol}-${index}`}
          renderItem={renderItem}
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <YStack padding="$6" alignItems="center">
              <SizableText size="$4" color={colors.textMuted}>{t('no_languages_match', { query })}</SizableText>
            </YStack>
          }
        />
      )}

      <YStack padding="$5" borderTopWidth={1} borderTopColor={colors.border} backgroundColor={colors.bg}>
        <YStack borderRadius="$5" overflow="hidden" opacity={selectedLanguage ? 1 : 0.5}>
          <LinearGradient colors={colors.buttonGradient as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            <Button
              size="$5"
              borderRadius="$5"
              backgroundColor="transparent"
              color="white"
              fontWeight="800"
              disabled={!selectedLanguage}
              onPress={onNext}
            >
              {selectedLanguage ? t('continue_with_language', { language: selectedLanguage.name }) : t('select_language_to_continue')}
            </Button>
          </LinearGradient>
        </YStack>
      </YStack>
    </YStack>
  );
}

// Step 3: Profile
function ProfileStep({
  onNext,
  profile,
  onUpdateProfile,
  t,
}: {
  onNext: () => void;
  profile: SpiritualProfile;
  onUpdateProfile: (updates: Partial<SpiritualProfile>) => void;
  t: ReturnType<typeof createTranslator>;
}) {
  const colors = usePremiumTheme();

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView flex={1} showsVerticalScrollIndicator={false}>
        <YStack padding="$6" gap="$6">
          <YStack gap="$2">
            <XStack alignItems="center" gap="$2">
              <Users size={20} color={colors.primary} />
              <SizableText size="$2" color={colors.primary} fontWeight="800" letterSpacing={1}>
                STEP 3 OF 4
              </SizableText>
            </XStack>
            <H2 color={colors.text} fontWeight="900" style={{ fontSize: 28 }}>{t('your_spiritual_profile')}</H2>
            <Paragraph size="$3" color={colors.textMuted} lineHeight={20}>{t('spiritual_profile_hint')}</Paragraph>
          </YStack>

          <Card backgroundColor={colors.glow} borderRadius="$4" padding="$3" borderWidth={1} borderColor={colors.border}>
            <XStack alignItems="center" gap="$2">
              <Sparkles size={16} color={colors.primary} />
              <Paragraph size="$2" color={colors.textMuted} flex={1}>{t('profile_privacy_hint')}</Paragraph>
            </XStack>
          </Card>

          <YStack gap="$3">
            <SizableText size="$2" color={colors.textMuted} fontWeight="700" letterSpacing={0.5}>
              {t('spiritual_status').toUpperCase()}
            </SizableText>
            <YStack gap="$2">
              {SPIRITUAL_STATUSES.map((status) => (
                <SelectableOption
                  key={status}
                  label={status}
                  selected={profile.spiritualStatus === status}
                  onPress={() => onUpdateProfile({ spiritualStatus: status })}
                />
              ))}
            </YStack>
          </YStack>

          <YStack gap="$3">
            <SizableText size="$2" color={colors.textMuted} fontWeight="700" letterSpacing={0.5}>
              {t('age_range').toUpperCase()}
            </SizableText>
            <XStack gap="$2" flexWrap="wrap">
              {AGE_RANGES.map((age) => (
                <TouchableOpacity key={age} activeOpacity={0.7} onPress={() => onUpdateProfile({ ageRange: age })}>
                  <YStack
                    backgroundColor={profile.ageRange === age ? colors.primary : colors.surface}
                    borderRadius="$3"
                    paddingHorizontal="$3"
                    paddingVertical="$2"
                    borderWidth={1}
                    borderColor={profile.ageRange === age ? colors.primary : colors.border}
                  >
                    <SizableText size="$3" color={profile.ageRange === age ? 'white' : colors.text} fontWeight="600">
                      {age}
                    </SizableText>
                  </YStack>
                </TouchableOpacity>
              ))}
            </XStack>
          </YStack>

          <YStack gap="$3">
            <SizableText size="$2" color={colors.textMuted} fontWeight="700" letterSpacing={0.5}>
              {t('marital_status').toUpperCase()}
            </SizableText>
            <XStack gap="$2">
              {MARITAL_STATUSES.map((status) => (
                <TouchableOpacity key={status} activeOpacity={0.7} onPress={() => onUpdateProfile({ maritalStatus: status })} style={{ flex: 1 }}>
                  <YStack
                    backgroundColor={profile.maritalStatus === status ? colors.primary : colors.surface}
                    borderRadius="$3"
                    paddingVertical="$3"
                    alignItems="center"
                    borderWidth={1}
                    borderColor={profile.maritalStatus === status ? colors.primary : colors.border}
                  >
                    <SizableText size="$3" color={profile.maritalStatus === status ? 'white' : colors.text} fontWeight="600">
                      {status}
                    </SizableText>
                  </YStack>
                </TouchableOpacity>
              ))}
            </XStack>
          </YStack>

          <YStack gap="$3">
            <SizableText size="$2" color={colors.textMuted} fontWeight="700" letterSpacing={0.5}>
              {t('study_interests').toUpperCase()}
            </SizableText>
            <Input
              value={profile.studyInterests}
              onChangeText={(v) => onUpdateProfile({ studyInterests: v })}
              placeholder={t('study_interests_placeholder')}
              placeholderTextColor={colors.textMuted}
              backgroundColor={colors.surface}
              borderColor={colors.border}
              borderWidth={1}
              borderRadius="$4"
              color={colors.text}
              size="$4"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              style={{ minHeight: 80, paddingTop: 12 }}
            />
          </YStack>
        </YStack>
      </ScrollView>

      <YStack padding="$5" borderTopWidth={1} borderTopColor={colors.border} backgroundColor={colors.bg} gap="$3">
        <YStack borderRadius="$5" overflow="hidden">
          <LinearGradient colors={colors.buttonGradient as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            <Button size="$5" borderRadius="$5" backgroundColor="transparent" color="white" fontWeight="800" onPress={onNext}>
              {t('continue')}
            </Button>
          </LinearGradient>
        </YStack>
        <TouchableOpacity onPress={onNext}>
          <SizableText size="$3" color={colors.textMuted} textAlign="center">{t('skip_for_now')}</SizableText>
        </TouchableOpacity>
      </YStack>
    </KeyboardAvoidingView>
  );
}

// Step 4: Complete
function CompleteStep({
  onStart,
  selectedLanguage,
  userName,
  t,
}: {
  onStart: () => void;
  selectedLanguage: Language | null;
  userName: string;
  t: ReturnType<typeof createTranslator>;
}) {
  const colors = usePremiumTheme();
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.1, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <YStack flex={1} justifyContent="space-between" padding="$6">
      <LinearGradient
        colors={colors.heroGradient as any}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 300 }}
      />

      <YStack flex={1} justifyContent="center" alignItems="center" gap="$6">
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <YStack
            width={120}
            height={120}
            borderRadius={60}
            backgroundColor={colors.glow}
            alignItems="center"
            justifyContent="center"
            borderWidth={3}
            borderColor={colors.primary}
          >
            <YStack
              width={80}
              height={80}
              borderRadius={40}
              backgroundColor={colors.primary}
              alignItems="center"
              justifyContent="center"
            >
              <Check size={40} color="white" />
            </YStack>
          </YStack>
        </Animated.View>

        <YStack alignItems="center" gap="$3">
          <SizableText size="$2" color={colors.primary} fontWeight="900" letterSpacing={2}>
            {t('all_set').toUpperCase()}
          </SizableText>
          <H1 color={colors.text} fontWeight="900" textAlign="center" style={{ fontSize: 32 }}>
            {userName ? `Welcome, ${userName}!` : t('ready_to_study')}
          </H1>
          <Paragraph size="$4" color={colors.textMuted} textAlign="center" lineHeight={24} maxWidth={280}>
            {t('ready_to_study_hint')}
          </Paragraph>
        </YStack>

        <YStack gap="$3" width="100%" maxWidth={320}>
          {selectedLanguage && (
            <Card backgroundColor={colors.surface} borderRadius="$4" padding="$4" borderWidth={1} borderColor={colors.border}>
              <XStack alignItems="center" gap="$3">
                <Globe size={22} color={colors.primary} />
                <YStack flex={1}>
                  <SizableText size="$2" color={colors.textMuted}>{t('study_language')}</SizableText>
                  <SizableText size="$4" color={colors.text} fontWeight="700">{selectedLanguage.name}</SizableText>
                </YStack>
                <Check size={18} color={colors.primary} />
              </XStack>
            </Card>
          )}
          <Card backgroundColor={colors.surface} borderRadius="$4" padding="$4" borderWidth={1} borderColor={colors.border}>
            <XStack alignItems="center" gap="$3">
              <Sparkles size={22} color={colors.accent} />
              <YStack flex={1}>
                <SizableText size="$2" color={colors.textMuted}>{t('privacy')}</SizableText>
                <SizableText size="$4" color={colors.text} fontWeight="700">{t('all_data_on_device')}</SizableText>
              </YStack>
              <Check size={18} color={colors.primary} />
            </XStack>
          </Card>
        </YStack>
      </YStack>

      <YStack borderRadius="$5" overflow="hidden">
        <LinearGradient colors={colors.buttonGradient as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <Button
            size="$5"
            borderRadius="$5"
            backgroundColor="transparent"
            color="white"
            fontWeight="800"
            pressStyle={{ opacity: 0.9 }}
            onPress={onStart}
            icon={<Sparkles size={18} color="white" />}
          >
            {t('start_app')}
          </Button>
        </LinearGradient>
      </YStack>
    </YStack>
  );
}

export default function OnboardingScreen() {
  const router = useRouter();
  const colors = usePremiumTheme();
  const setLanguage = useAppStore((s) => s.setLanguage);
  const setAppLanguage = useAppStore((s) => s.setAppLanguage);
  const setContentLanguage = useAppStore((s) => s.setContentLanguage);
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState<Language | null>(null);
  const [profile, setProfile] = useState<SpiritualProfile>({
    spiritualStatus: '',
    ageRange: '',
    maritalStatus: '',
    studyInterests: '',
  });
  const t = createTranslator(selectedLanguage?.symbol || 'en');

  const TOTAL_STEPS = 5;

  const updateProfile = (updates: Partial<SpiritualProfile>) => {
    setProfile((prev) => ({ ...prev, ...updates }));
  };

  const handleComplete = async () => {
    const knownLanguage = selectedLanguage ? getLanguageBySymbol(selectedLanguage.symbol) : undefined;
    const contentLanguage: AppLanguage = selectedLanguage
      ? {
          ...(knownLanguage ?? DISPLAY_LANGUAGES[0]),
          code: knownLanguage?.code ?? selectedLanguage.langCode,
          symbol: knownLanguage?.symbol ?? selectedLanguage.symbol,
          name: knownLanguage?.name ?? selectedLanguage.name,
          englishName: knownLanguage?.englishName ?? selectedLanguage.name,
          direction: selectedLanguage.direction === 'rtl' ? 'rtl' : 'ltr',
        }
      : DISPLAY_LANGUAGES[0];
    const displayLanguage = DISPLAY_LANGUAGES.find((lang) => lang.symbol === contentLanguage.symbol) ?? DISPLAY_LANGUAGES[0];

    try {
      setAppLanguage(displayLanguage);
      setContentLanguage(contentLanguage);
      setLanguage(contentLanguage);
      await saveLanguagePair(displayLanguage, contentLanguage);
      await Promise.all([
        AsyncStorage.setItem('selected_language', JSON.stringify(contentLanguage)),
        AsyncStorage.setItem('user_profile', JSON.stringify(profile)),
        AsyncStorage.setItem('jw_sa:user_name', name.trim()),
        AsyncStorage.setItem('onboarding_complete', 'true'),
      ]);
    } catch (_) {}
    router.replace('/(tabs)');
  };

  const renderStep = () => {
    switch (step) {
      case 0:
        return <WelcomeStep onNext={() => setStep(1)} t={t} />;
      case 1:
        return <NameStep name={name} setName={setName} onNext={() => setStep(2)} t={t} />;
      case 2:
        return (
          <LanguageStep
            onNext={() => setStep(3)}
            selectedLanguage={selectedLanguage}
            onSelectLanguage={setSelectedLanguage}
            t={t}
          />
        );
      case 3:
        return <ProfileStep onNext={() => setStep(4)} profile={profile} onUpdateProfile={updateProfile} t={t} />;
      case 4:
        return <CompleteStep onStart={handleComplete} selectedLanguage={selectedLanguage} userName={name} t={t} />;
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <YStack paddingHorizontal="$6" paddingTop="$2" paddingBottom="$1">
        <XStack alignItems="center" justifyContent="space-between">
          {step > 0 ? (
            <TouchableOpacity
              onPress={() => setStep((s) => Math.max(0, s - 1))}
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: colors.surface,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <SizableText size="$5" color={colors.textMuted}>{'<'}</SizableText>
            </TouchableOpacity>
          ) : (
            <YStack width={44} />
          )}

          <StepIndicator current={step} total={TOTAL_STEPS} />

          <YStack
            backgroundColor={colors.surface}
            borderRadius="$10"
            paddingHorizontal="$3"
            paddingVertical="$1.5"
          >
            <SizableText size="$2" color={colors.textMuted} fontWeight="700">
              {step + 1}/{TOTAL_STEPS}
            </SizableText>
          </YStack>
        </XStack>
      </YStack>

      <YStack flex={1}>{renderStep()}</YStack>
    </SafeAreaView>
  );
}
