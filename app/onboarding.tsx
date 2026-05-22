import { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
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
  Separator,
} from '@blinkdotnew/mobile-ui';
import { usePremiumTheme } from '@/hooks/usePremiumTheme';

// ─── Types ───────────────────────────────────────────────────────────────────

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

// ─── Constants ───────────────────────────────────────────────────────────────

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
  { name: 'Dutch', langCode: 'O', symbol: 'nl', direction: 'ltr' },
  { name: 'Swedish', langCode: 'Z', symbol: 'sv', direction: 'ltr' },
  { name: 'Polish', langCode: 'G', symbol: 'pl', direction: 'ltr' },
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

const AGE_RANGES = [
  'Under 18',
  '18–25',
  '26–35',
  '36–50',
  '51–65',
  'Over 65',
];

const MARITAL_STATUSES = ['Single', 'Married', 'Widowed'];

// ─── Sub-components ──────────────────────────────────────────────────────────

function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <XStack gap="$2" justifyContent="center" marginTop="$3">
      {Array.from({ length: total }).map((_, i) => (
        <YStack
          key={i}
          width={i === current ? 24 : 8}
          height={8}
          borderRadius="$10"
          backgroundColor={i === current ? '#5B7E6B' : '#3A3A3C'}
        />
      ))}
    </XStack>
  );
}

function PickerRow({
  label,
  value,
  options,
  onSelect,
}: {
  label: string;
  value: string;
  options: string[];
  onSelect: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <YStack gap="$2">
      <SizableText size="$3" color="#9CA3AF" fontWeight="600" letterSpacing={0.5}>
        {label.toUpperCase()}
      </SizableText>
      <TouchableOpacity
        activeOpacity={0.75}
        onPress={() => setOpen((p) => !p)}
        style={{
          backgroundColor: '#2C2C2E',
          borderRadius: 12,
          borderWidth: 1,
          borderColor: open ? '#5B7E6B' : '#3A3A3C',
          paddingHorizontal: 16,
          paddingVertical: 14,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <SizableText size="$4" color={value ? '#F2F2F7' : '#6B7280'}>
          {value || `Select ${label}`}
        </SizableText>
        <SizableText size="$3" color="#5B7E6B">
          {open ? '▲' : '▼'}
        </SizableText>
      </TouchableOpacity>

      {open && (
        <Card
          backgroundColor="#2C2C2E"
          borderRadius="$4"
          borderWidth={1}
          borderColor="#3A3A3C"
          overflow="hidden"
        >
          {options.map((opt, idx) => (
            <TouchableOpacity
              key={opt}
              activeOpacity={0.7}
              onPress={() => {
                onSelect(opt);
                setOpen(false);
              }}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 13,
                backgroundColor:
                  opt === value ? 'rgba(91,126,107,0.18)' : 'transparent',
                borderBottomWidth: idx < options.length - 1 ? 1 : 0,
                borderBottomColor: '#3A3A3C',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <SizableText
                size="$4"
                color={opt === value ? '#5B7E6B' : '#E5E7EB'}
              >
                {opt}
              </SizableText>
              {opt === value && (
                <SizableText size="$4" color="#5B7E6B">
                  ✓
                </SizableText>
              )}
            </TouchableOpacity>
          ))}
        </Card>
      )}
    </YStack>
  );
}

// ─── Step 0: Ask for Name ────────────────────────────────────────────────
function NameStep({ name, setName, onNext, t }: { name: string; setName: (n: string) => void; onNext: () => void; t: ReturnType<typeof createTranslator> }) {
  return (
    <YStack flex={1} justifyContent="center" alignItems="center" gap="$5" padding="$6">
      <H1 color="#5B7E6B">{t('welcome')}</H1>
      <SizableText size="$4" color="#9CA3AF" textAlign="center">
        {t('what_is_your_name')}
      </SizableText>
      <Input
        value={name}
        onChangeText={setName}
        placeholder={t('enter_your_name')}
        autoFocus
        size="$4"
        width={240}
        maxLength={32}
      />
      <Button
        backgroundColor="#5B7E6B"
        color="#fff"
        borderRadius={10}
        size="$4"
        disabled={!name.trim()}
        onPress={onNext}
      >
        {t('continue')}
      </Button>
    </YStack>
  );
}

// ─── Step 1: Welcome ─────────────────────────────────────────────────────────

function WelcomeStep({ onNext, t }: { onNext: () => void; t: ReturnType<typeof createTranslator> }) {
  return (
    <YStack flex={1} justifyContent="space-between" padding="$6">
      {/* Top glow */}
      <YStack
        position="absolute"
        top={-80}
        left={-80}
        width={320}
        height={320}
        borderRadius={160}
        backgroundColor="rgba(91,126,107,0.08)"
      />

      <YStack flex={1} justifyContent="center" alignItems="center" gap="$5">
        {/* Icon badge */}
        <YStack
          width={110}
          height={110}
          borderRadius={55}
          backgroundColor="rgba(91,126,107,0.15)"
          justifyContent="center"
          alignItems="center"
          borderWidth={1.5}
          borderColor="rgba(91,126,107,0.35)"
        >
          <SizableText size="$10" style={{ fontSize: 52 }}>
            📖
          </SizableText>
        </YStack>

        <YStack alignItems="center" gap="$3">
          <SizableText
            size="$2"
            color="#5B7E6B"
            fontWeight="700"
            letterSpacing={2.5}
            textAlign="center"
          >
            {t('welcome_to').toUpperCase()}
          </SizableText>
          <H1
            color="#F2F2F7"
            fontWeight="800"
            textAlign="center"
            lineHeight={40}
            style={{ fontSize: 32 }}
          >
            JW Study{'\n'}Assistant
          </H1>
          <Paragraph
            size="$4"
            color="#9CA3AF"
            textAlign="center"
            lineHeight={22}
            maxWidth={300}
            marginTop="$1"
          >
            {t('onboarding_intro')}
          </Paragraph>
        </YStack>

        {/* Feature pills */}
        <XStack gap="$2" flexWrap="wrap" justifyContent="center" marginTop="$2">
          {[t('study_tools'), t('meeting_prep'), t('ministry'), t('saved_items')].map(
            (feat) => (
              <YStack
                key={feat}
                backgroundColor="#2C2C2E"
                paddingHorizontal="$3"
                paddingVertical="$2"
                borderRadius="$10"
                borderWidth={1}
                borderColor="#3A3A3C"
              >
                <SizableText size="$2" color="#D1D5DB">
                  {feat}
                </SizableText>
              </YStack>
            )
          )}
        </XStack>
      </YStack>

      <YStack gap="$4">
        {/* Disclaimer */}
        <YStack
          backgroundColor="#2C2C2E"
          borderRadius="$3"
          padding="$3"
          borderLeftWidth={3}
          borderLeftColor="#5B7E6B"
        >
          <SizableText size="$2" color="#6B7280" lineHeight={18}>
            {t('short_disclaimer')}
          </SizableText>
        </YStack>

        <Button
          backgroundColor="#5B7E6B"
          color="white"
          size="$5"
          borderRadius="$4"
          fontWeight="700"
          pressStyle={{ opacity: 0.85, scale: 0.98 }}
          onPress={onNext}
        >
          {t('get_started')}
        </Button>
      </YStack>
    </YStack>
  );
}

// ─── Step 2: Language ─────────────────────────────────────────────────────────

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
      setFiltered(
        languages.filter((l) =>
          l.name.toLowerCase().includes(query.toLowerCase())
        )
      );
    }
  }, [query, languages]);

  const renderItem = ({ item }: { item: Language }) => {
    const badge = String(item.symbol || item.langCode || item.name || '??')
      .slice(0, 2)
      .toUpperCase();
    const isSelected =
      selectedLanguage?.langCode === item.langCode ||
      selectedLanguage?.symbol === item.symbol;
    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => onSelectLanguage(item)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          paddingVertical: 14,
          backgroundColor: isSelected
            ? 'rgba(91,126,107,0.14)'
            : 'transparent',
          borderBottomWidth: 1,
          borderBottomColor: '#2C2C2E',
        }}
      >
        <XStack alignItems="center" gap="$3">
          <YStack
            width={36}
            height={36}
            borderRadius={18}
            backgroundColor={isSelected ? '#5B7E6B' : '#2C2C2E'}
            justifyContent="center"
            alignItems="center"
          >
            <SizableText
              size="$2"
              color={isSelected ? 'white' : '#9CA3AF'}
              fontWeight="700"
            >
              {badge}
            </SizableText>
          </YStack>
          <SizableText
            size="$4"
            color={isSelected ? '#5B7E6B' : '#E5E7EB'}
            fontWeight={isSelected ? '600' : '400'}
          >
            {item.name}
          </SizableText>
        </XStack>
        {isSelected && (
          <YStack
            width={24}
            height={24}
            borderRadius={12}
            backgroundColor="#5B7E6B"
            justifyContent="center"
            alignItems="center"
          >
            <SizableText size="$2" color="white">
              ✓
            </SizableText>
          </YStack>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <YStack flex={1}>
      <YStack padding="$6" gap="$4" paddingBottom="$3">
        <YStack gap="$1">
          <SizableText
            size="$2"
            color="#5B7E6B"
            fontWeight="700"
            letterSpacing={2}
          >
            {t('step_of_total', { step: 2, total: 4 })}
          </SizableText>
          <H2 color="#F2F2F7" fontWeight="800" style={{ fontSize: 26 }}>
            {t('choose_your_language')}
          </H2>
          <Paragraph size="$3" color="#9CA3AF">
            {t('select_language_study_materials')}
          </Paragraph>
        </YStack>

        <YStack
          backgroundColor="#2C2C2E"
          borderRadius="$4"
          borderWidth={1}
          borderColor="#3A3A3C"
          flexDirection="row"
          alignItems="center"
          paddingHorizontal="$3"
          gap="$2"
        >
          <SizableText size="$4" color="#6B7280">
            🔍
          </SizableText>
          <Input
            flex={1}
            value={query}
            onChangeText={setQuery}
            placeholder={t('search_languages')}
            placeholderTextColor="#6B7280"
            color="#F2F2F7"
            backgroundColor="transparent"
            borderWidth={0}
            size="$4"
            focusStyle={{ borderWidth: 0, outlineWidth: 0 }}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <SizableText size="$3" color="#6B7280">
                ✕
              </SizableText>
            </TouchableOpacity>
          )}
        </YStack>
      </YStack>

      {loading ? (
        <YStack flex={1} justifyContent="center" alignItems="center" gap="$3">
          <Spinner size="large" color="#5B7E6B" />
          <SizableText size="$3" color="#9CA3AF">
            {t('loading_languages')}
          </SizableText>
        </YStack>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item, index) => `${item.langCode || item.symbol || item.name}-${index}`}
          renderItem={renderItem}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 16 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <YStack padding="$6" alignItems="center" gap="$2">
              <SizableText size="$5" color="#6B7280">
                🌐
              </SizableText>
              <SizableText size="$4" color="#9CA3AF" textAlign="center">
                {t('no_languages_match', { query })}
              </SizableText>
            </YStack>
          }
        />
      )}

      <YStack
        padding="$5"
        borderTopWidth={1}
        borderTopColor="#2C2C2E"
        backgroundColor="#1C1C1E"
      >
        <Button
          backgroundColor={selectedLanguage ? '#5B7E6B' : '#3A3A3C'}
          color={selectedLanguage ? 'white' : '#6B7280'}
          size="$5"
          borderRadius="$4"
          fontWeight="700"
          pressStyle={{ opacity: 0.85, scale: 0.98 }}
          disabled={!selectedLanguage}
          onPress={onNext}
        >
          {selectedLanguage
            ? t('continue_with_language', { language: selectedLanguage.name })
            : t('select_language_to_continue')}
        </Button>
      </YStack>
    </YStack>
  );
}

// ─── Step 3: Spiritual Profile ────────────────────────────────────────────────

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
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView flex={1} showsVerticalScrollIndicator={false}>
        <YStack padding="$6" gap="$5" paddingBottom="$8">
          <YStack gap="$1">
            <SizableText
              size="$2"
              color="#5B7E6B"
              fontWeight="700"
              letterSpacing={2}
            >
              {t('step_of_total', { step: 3, total: 4 })}
            </SizableText>
            <H2 color="#F2F2F7" fontWeight="800" style={{ fontSize: 26 }}>
              {t('your_spiritual_profile')}
            </H2>
            <Paragraph size="$3" color="#9CA3AF" lineHeight={20}>
              {t('spiritual_profile_hint')}
            </Paragraph>
          </YStack>

          {/* Status badge */}
          <XStack
            backgroundColor="rgba(91,126,107,0.1)"
            borderRadius="$3"
            padding="$3"
            gap="$2"
            alignItems="center"
            borderWidth={1}
            borderColor="rgba(91,126,107,0.2)"
          >
            <SizableText size="$3" color="#5B7E6B">
              🔒
            </SizableText>
            <Paragraph size="$2" color="#9CA3AF" flex={1} lineHeight={17}>
              {t('profile_privacy_hint')}
            </Paragraph>
          </XStack>

          <YStack gap="$5">
            <PickerRow
              label={t('spiritual_status')}
              value={profile.spiritualStatus}
              options={SPIRITUAL_STATUSES}
              onSelect={(v) => onUpdateProfile({ spiritualStatus: v })}
            />

            <PickerRow
              label={t('age_range')}
              value={profile.ageRange}
              options={AGE_RANGES}
              onSelect={(v) => onUpdateProfile({ ageRange: v })}
            />

            <PickerRow
              label={t('marital_status')}
              value={profile.maritalStatus}
              options={MARITAL_STATUSES}
              onSelect={(v) => onUpdateProfile({ maritalStatus: v })}
            />

            <YStack gap="$2">
              <SizableText
                size="$3"
                color="#9CA3AF"
                fontWeight="600"
                letterSpacing={0.5}
              >
                {t('study_interests').toUpperCase()}
              </SizableText>
              <YStack
                backgroundColor="#2C2C2E"
                borderRadius="$4"
                borderWidth={1}
                borderColor="#3A3A3C"
                padding="$1"
              >
                <Input
                  value={profile.studyInterests}
                  onChangeText={(v) => onUpdateProfile({ studyInterests: v })}
                  placeholder={t('study_interests_placeholder')}
                  placeholderTextColor="#6B7280"
                  color="#F2F2F7"
                  backgroundColor="transparent"
                  borderWidth={0}
                  size="$4"
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  focusStyle={{ borderWidth: 0, outlineWidth: 0 }}
                  style={{ minHeight: 80, paddingTop: 10 }}
                />
              </YStack>
              <SizableText size="$2" color="#6B7280">
                {t('separate_topics_commas')}
              </SizableText>
            </YStack>
          </YStack>

          <Button
            backgroundColor="#5B7E6B"
            color="white"
            size="$5"
            borderRadius="$4"
            fontWeight="700"
            marginTop="$2"
            pressStyle={{ opacity: 0.85, scale: 0.98 }}
            onPress={onNext}
          >
            {t('continue')}
          </Button>

          <YStack alignItems="center">
            <TouchableOpacity onPress={onNext}>
              <SizableText size="$3" color="#6B7280">
                {t('skip_for_now')}
              </SizableText>
            </TouchableOpacity>
          </YStack>
        </YStack>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Step 4: Complete ─────────────────────────────────────────────────────────

function CompleteStep({
  onStart,
  selectedLanguage,
  t,
}: {
  onStart: () => void;
  selectedLanguage: Language | null;
  t: ReturnType<typeof createTranslator>;
}) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.08,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  return (
    <YStack flex={1} justifyContent="space-between" padding="$6">
      <YStack flex={1} justifyContent="center" alignItems="center" gap="$6">
        {/* Animated check circle */}
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <YStack
            width={120}
            height={120}
            borderRadius={60}
            backgroundColor="rgba(91,126,107,0.2)"
            justifyContent="center"
            alignItems="center"
            borderWidth={2}
            borderColor="#5B7E6B"
          >
            <YStack
              width={80}
              height={80}
              borderRadius={40}
              backgroundColor="#5B7E6B"
              justifyContent="center"
              alignItems="center"
            >
              <SizableText size="$8" color="white" fontWeight="800">
                ✓
              </SizableText>
            </YStack>
          </YStack>
        </Animated.View>

        <YStack alignItems="center" gap="$3">
          <SizableText
            size="$2"
            color="#5B7E6B"
            fontWeight="700"
            letterSpacing={2.5}
          >
            {t('all_set').toUpperCase()}
          </SizableText>
          <H1
            color="#F2F2F7"
            fontWeight="800"
            textAlign="center"
            style={{ fontSize: 30 }}
          >
            {t('ready_to_study')}
          </H1>
          <Paragraph
            size="$4"
            color="#9CA3AF"
            textAlign="center"
            lineHeight={22}
            maxWidth={280}
          >
            {t('ready_to_study_hint')}
          </Paragraph>
        </YStack>

        {/* Summary cards */}
        <YStack gap="$2" width="100%" maxWidth={320}>
          {selectedLanguage && (
            <XStack
              backgroundColor="#2C2C2E"
              borderRadius="$3"
              padding="$3"
              gap="$3"
              alignItems="center"
              borderWidth={1}
              borderColor="#3A3A3C"
            >
              <SizableText size="$5">🌐</SizableText>
              <YStack flex={1}>
                <SizableText size="$2" color="#9CA3AF">
                  {t('study_language')}
                </SizableText>
                <SizableText size="$4" color="#F2F2F7" fontWeight="600">
                  {selectedLanguage.name}
                </SizableText>
              </YStack>
              <SizableText size="$3" color="#5B7E6B">
                ✓
              </SizableText>
            </XStack>
          )}
          <XStack
            backgroundColor="#2C2C2E"
            borderRadius="$3"
            padding="$3"
            gap="$3"
            alignItems="center"
            borderWidth={1}
            borderColor="#3A3A3C"
          >
            <SizableText size="$5">🔒</SizableText>
            <YStack flex={1}>
              <SizableText size="$2" color="#9CA3AF">
                {t('privacy')}
              </SizableText>
              <SizableText size="$4" color="#F2F2F7" fontWeight="600">
                {t('all_data_on_device')}
              </SizableText>
            </YStack>
            <SizableText size="$3" color="#5B7E6B">
              ✓
            </SizableText>
          </XStack>
        </YStack>
      </YStack>

      <Button
        backgroundColor="#5B7E6B"
        color="white"
        size="$5"
        borderRadius="$4"
        fontWeight="700"
        pressStyle={{ opacity: 0.85, scale: 0.98 }}
        onPress={onStart}
      >
        {t('start_app')}
      </Button>
    </YStack>
  );
}

// ─── Main Onboarding Screen ───────────────────────────────────────────────────

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
        AsyncStorage.setItem(
          'selected_language',
          JSON.stringify(contentLanguage)
        ),
        AsyncStorage.setItem('user_profile', JSON.stringify(profile)),
        AsyncStorage.setItem('jw_sa:user_name', name.trim()),
        AsyncStorage.setItem('onboarding_complete', 'true'),
      ]);
    } catch (_) {
      // Silently continue even if storage fails
    }
    router.replace('/(tabs)');
  };

  const renderStep = () => {
    switch (step) {
      case 0:
        return <NameStep name={name} setName={setName} onNext={() => setStep(1)} t={t} />;
      case 1:
        return <WelcomeStep onNext={() => setStep(2)} t={t} />;
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
        return (
          <ProfileStep
            onNext={() => setStep(4)}
            profile={profile}
            onUpdateProfile={updateProfile}
            t={t}
          />
        );
      case 4:
        return (
          <CompleteStep
            onStart={handleComplete}
            selectedLanguage={selectedLanguage}
            t={t}
          />
        );
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Header with back button + dots */}
      <YStack paddingHorizontal="$6" paddingTop="$2" paddingBottom="$1">
        <XStack alignItems="center" justifyContent="space-between">
          {step > 0 ? (
            <TouchableOpacity
              onPress={() => setStep((s) => Math.max(0, s - 1))}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: '#2C2C2E',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <SizableText size="$4" color="#9CA3AF">
                ←
              </SizableText>
            </TouchableOpacity>
          ) : (
            <YStack width={40} />
          )}

          <StepDots current={step} total={TOTAL_STEPS} />

          {/* Step counter */}
          <YStack
            backgroundColor="#2C2C2E"
            borderRadius="$10"
            paddingHorizontal="$3"
            paddingVertical="$1"
          >
            <SizableText size="$2" color="#9CA3AF" fontWeight="600">
              {step + 1}/{TOTAL_STEPS}
            </SizableText>
          </YStack>
        </XStack>
      </YStack>

      {/* Step content */}
      <YStack flex={1}>{renderStep()}</YStack>
    </SafeAreaView>
  );
}
