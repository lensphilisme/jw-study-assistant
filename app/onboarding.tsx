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
  { name: 'Haitian Creole', langCode: 'HT', symbol: 'ht', direction: 'ltr' },
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

// ─── Step 1: Welcome ─────────────────────────────────────────────────────────

function WelcomeStep({ onNext }: { onNext: () => void }) {
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
            WELCOME TO
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
            Your personal study and ministry companion for deeper understanding of God's Word.
          </Paragraph>
        </YStack>

        {/* Feature pills */}
        <XStack gap="$2" flexWrap="wrap" justifyContent="center" marginTop="$2">
          {['📚 Study Tools', '🗓 Meeting Prep', '🚶 Ministry', '🔖 Saved Items'].map(
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
            This app is not affiliated with or endorsed by Jehovah's Witnesses,
            JW.org, JW Library, or Watch Tower Bible and Tract Society. It only
            helps users organize study using publicly available JW.org/WOL
            content.
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
          Get Started →
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
}: {
  onNext: () => void;
  selectedLanguage: Language | null;
  onSelectLanguage: (lang: Language) => void;
}) {
  const [languages, setLanguages] = useState<Language[]>([]);
  const [filtered, setFiltered] = useState<Language[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('https://b.jw-cdn.org/apis/mediator/v1/languages/E/web?clientType=www')
      .then((r) => r.json())
      .then((data) => {
        const langs: Language[] = (data.languages || []).map((l: any) => ({
          name: l.name || l.vernacularName || l.langCode,
          langCode: l.langCode,
          symbol: l.symbol,
          direction: l.direction || 'ltr',
        }));
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
    const isSelected = selectedLanguage?.langCode === item.langCode;
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
              {(item.symbol || item.langCode).substring(0, 2).toUpperCase()}
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
            STEP 2 OF 4
          </SizableText>
          <H2 color="#F2F2F7" fontWeight="800" style={{ fontSize: 26 }}>
            Choose Your Language
          </H2>
          <Paragraph size="$3" color="#9CA3AF">
            Select the language for your study materials
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
            placeholder="Search languages…"
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
            Loading languages…
          </SizableText>
        </YStack>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.langCode}
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
                No languages match "{query}"
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
            ? `Continue with ${selectedLanguage.name} →`
            : 'Select a Language to Continue'}
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
}: {
  onNext: () => void;
  profile: SpiritualProfile;
  onUpdateProfile: (updates: Partial<SpiritualProfile>) => void;
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
              STEP 3 OF 4
            </SizableText>
            <H2 color="#F2F2F7" fontWeight="800" style={{ fontSize: 26 }}>
              Your Spiritual Profile
            </H2>
            <Paragraph size="$3" color="#9CA3AF" lineHeight={20}>
              This helps personalize your study suggestions. All fields are
              optional.
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
              This information stays on your device and is used only to
              personalize suggestions.
            </Paragraph>
          </XStack>

          <YStack gap="$5">
            <PickerRow
              label="Spiritual Status"
              value={profile.spiritualStatus}
              options={SPIRITUAL_STATUSES}
              onSelect={(v) => onUpdateProfile({ spiritualStatus: v })}
            />

            <PickerRow
              label="Age Range"
              value={profile.ageRange}
              options={AGE_RANGES}
              onSelect={(v) => onUpdateProfile({ ageRange: v })}
            />

            <PickerRow
              label="Marital Status"
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
                STUDY INTERESTS
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
                  placeholder="e.g. prophecy, family worship, young people…"
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
                Separate topics with commas
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
            Continue →
          </Button>

          <YStack alignItems="center">
            <TouchableOpacity onPress={onNext}>
              <SizableText size="$3" color="#6B7280">
                Skip for now
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
}: {
  onStart: () => void;
  selectedLanguage: Language | null;
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
            ALL SET!
          </SizableText>
          <H1
            color="#F2F2F7"
            fontWeight="800"
            textAlign="center"
            style={{ fontSize: 30 }}
          >
            You're ready to study!
          </H1>
          <Paragraph
            size="$4"
            color="#9CA3AF"
            textAlign="center"
            lineHeight={22}
            maxWidth={280}
          >
            Start your journey with Jehovah's word. Your companion is ready to help.
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
                  Study Language
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
                Privacy
              </SizableText>
              <SizableText size="$4" color="#F2F2F7" fontWeight="600">
                All data stored on device
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
        Start App 🎉
      </Button>
    </YStack>
  );
}

// ─── Main Onboarding Screen ───────────────────────────────────────────────────

export default function OnboardingScreen() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [selectedLanguage, setSelectedLanguage] = useState<Language | null>(null);
  const [profile, setProfile] = useState<SpiritualProfile>({
    spiritualStatus: '',
    ageRange: '',
    maritalStatus: '',
    studyInterests: '',
  });

  const TOTAL_STEPS = 4;

  const updateProfile = (updates: Partial<SpiritualProfile>) => {
    setProfile((prev) => ({ ...prev, ...updates }));
  };

  const handleComplete = async () => {
    try {
      await Promise.all([
        AsyncStorage.setItem(
          'selected_language',
          JSON.stringify(selectedLanguage)
        ),
        AsyncStorage.setItem('user_profile', JSON.stringify(profile)),
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
        return <WelcomeStep onNext={() => setStep(1)} />;
      case 1:
        return (
          <LanguageStep
            onNext={() => setStep(2)}
            selectedLanguage={selectedLanguage}
            onSelectLanguage={setSelectedLanguage}
          />
        );
      case 2:
        return (
          <ProfileStep
            onNext={() => setStep(3)}
            profile={profile}
            onUpdateProfile={updateProfile}
          />
        );
      case 3:
        return (
          <CompleteStep
            onStart={handleComplete}
            selectedLanguage={selectedLanguage}
          />
        );
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#1C1C1E' }}>
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
