// ============================================================
// JW Study Assistant — Edit Spiritual Profile Screen
// ============================================================
import { useState, useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Platform } from 'react-native';
import {
  YStack,
  XStack,
  SizableText,
  Card,
  Button,
  Input,
  ScrollView,
  BlinkSelect,
  Switch,
  Spinner,
  toast,
  ChevronLeft,
  Shield,
  User,
} from '@blinkdotnew/mobile-ui';
import { useRouter } from 'expo-router';
import { useAppStore } from '@/store/appStore';
import { saveUserProfile } from '@/services/storageService';
import type { UserProfile, AgeRange, Gender, MaritalStatus, SpiritualStatus } from '@/types';

// ── Select option helpers ─────────────────────────────────────
const AGE_RANGES: { label: string; value: AgeRange }[] = [
  { label: 'Under 18', value: 'under-18' },
  { label: '18–25', value: '18-25' },
  { label: '26–35', value: '26-35' },
  { label: '36–45', value: '36-45' },
  { label: '46–55', value: '46-55' },
  { label: '56–65', value: '56-65' },
  { label: 'Over 65', value: '65+' },
];

const GENDERS: { label: string; value: Gender }[] = [
  { label: 'Male', value: 'male' },
  { label: 'Female', value: 'female' },
  { label: 'Prefer not to say', value: 'prefer-not-to-say' },
];

const MARITAL_STATUSES: { label: string; value: MaritalStatus }[] = [
  { label: 'Single', value: 'single' },
  { label: 'Married', value: 'married' },
  { label: 'Widowed', value: 'widowed' },
  { label: 'Divorced', value: 'divorced' },
];

const SPIRITUAL_STATUSES: { label: string; value: SpiritualStatus }[] = [
  { label: 'Publisher', value: 'publisher' },
  { label: 'Baptized Publisher', value: 'baptized' },
  { label: 'Pioneer', value: 'pioneer' },
  { label: 'Elder', value: 'elder' },
  { label: 'Ministerial Servant', value: 'ms' },
  { label: 'Bible Student', value: 'bible-student' },
  { label: 'Interested Person', value: 'other' },
];

const STUDY_STYLES: { label: string; value: UserProfile['preferredStudyStyle'] }[] = [
  { label: 'Reading', value: 'reading' },
  { label: 'Discussion', value: 'interactive' },
  { label: 'Visual', value: 'visual' },
  { label: 'Audio', value: 'audio' },
];

// ── Field label ───────────────────────────────────────────────
function FieldLabel({ label, required }: { label: string; required?: boolean }) {
  return (
    <SizableText size="$3" color="#9CA3AF" fontWeight="600" marginBottom="$1">
      {label}{required && <SizableText color="#EF4444"> *</SizableText>}
    </SizableText>
  );
}

// ── Section card ──────────────────────────────────────────────
function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <YStack gap="$3">
      <SizableText size="$2" color="#9CA3AF" fontWeight="700" letterSpacing={1.5}>
        {title.toUpperCase()}
      </SizableText>
      <Card
        backgroundColor="#2C2C2E"
        borderRadius="$4"
        padding="$4"
        borderWidth={1}
        borderColor="#3A3A3C"
        gap="$4"
      >
        {children}
      </Card>
    </YStack>
  );
}

// ── Multiline text input ──────────────────────────────────────
function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <YStack gap="$1">
      <FieldLabel label={label} />
      <Input
        value={value}
        onChangeText={onChange}
        placeholder={placeholder ?? label}
        multiline
        numberOfLines={3}
        backgroundColor="#1C1C1E"
        borderColor="#3A3A3C"
        color="#F2F2F7"
        placeholderTextColor="#4B5563"
        borderRadius="$3"
        minHeight={80}
        textAlignVertical="top"
        padding="$3"
      />
      {hint ? <SizableText size="$2" color="#4B5563">{hint}</SizableText> : null}
    </YStack>
  );
}

// ── Main Screen ───────────────────────────────────────────────
export default function EditProfileScreen() {
  const router = useRouter();
  const storeProfile = useAppStore((s) => s.userProfile);
  const setUserProfile = useAppStore((s) => s.setUserProfile);

  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [ageRange, setAgeRange] = useState<AgeRange>(storeProfile?.ageRange ?? '26-35');
  const [gender, setGender] = useState<Gender>(storeProfile?.gender ?? 'prefer-not-to-say');
  const [maritalStatus, setMaritalStatus] = useState<MaritalStatus>(storeProfile?.maritalStatus ?? 'single');
  const [hasChildren, setHasChildren] = useState(storeProfile?.hasChildren ?? false);
  const [childrenAges, setChildrenAges] = useState(
    (storeProfile?.childrenAges ?? []).join(', ')
  );
  const [workSituation, setWorkSituation] = useState(storeProfile?.workSituation ?? '');
  const [spiritualStatus, setSpiritualStatus] = useState<SpiritualStatus>(
    storeProfile?.spiritualStatus ?? 'publisher'
  );
  const [spiritualGoals, setSpiritualGoals] = useState(
    (storeProfile?.spiritualGoals ?? []).join('\n')
  );
  const [studyInterests, setStudyInterests] = useState(
    (storeProfile?.studyInterests ?? []).join('\n')
  );
  const [personalChallenges, setPersonalChallenges] = useState(
    (storeProfile?.personalChallenges ?? []).join('\n')
  );
  const [studyStyle, setStudyStyle] = useState<UserProfile['preferredStudyStyle']>(
    storeProfile?.preferredStudyStyle ?? 'reading'
  );

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const profile: UserProfile = {
        id: storeProfile?.id ?? `profile_${Date.now()}`,
        ageRange,
        gender,
        maritalStatus,
        hasChildren,
        childrenAges: hasChildren
          ? childrenAges.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n))
          : [],
        workSituation: workSituation as UserProfile['workSituation'],
        spiritualStatus,
        spiritualGoals: spiritualGoals.split('\n').map((s) => s.trim()).filter(Boolean),
        studyInterests: studyInterests.split('\n').map((s) => s.trim()).filter(Boolean),
        personalChallenges: personalChallenges.split('\n').map((s) => s.trim()).filter(Boolean),
        preferredStudyStyle: studyStyle,
      };

      await saveUserProfile(profile);
      setUserProfile(profile);
      toast('Profile saved', { message: 'Your spiritual profile has been updated.', variant: 'success' });

      if (Platform.OS !== 'web') {
        router.back();
      }
    } catch {
      toast('Save failed', { message: 'Could not save profile. Please try again.', variant: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#1C1C1E' }}>
      {/* ── Header ── */}
      <XStack paddingHorizontal="$4" paddingTop="$2" paddingBottom="$2" alignItems="center" gap="$3">
        <Button
          chromeless
          size="$3"
          onPress={() => router.back()}
          icon={<ChevronLeft size={22} color="#9CA3AF" />}
        />
        <SizableText size="$6" color="#F2F2F7" fontWeight="700" flex={1}>
          Edit Profile
        </SizableText>
        <Button
          size="$3"
          backgroundColor="#5B7E6B"
          color="white"
          fontWeight="700"
          onPress={handleSave}
          disabled={isSaving}
          icon={isSaving ? <Spinner size="small" color="white" /> : undefined}
          minWidth={70}
        >
          {isSaving ? '' : 'Save'}
        </Button>
      </XStack>

      <ScrollView flex={1} showsVerticalScrollIndicator={false}>
        <YStack padding="$4" gap="$5" paddingBottom="$12">

          {/* Privacy notice */}
          <XStack
            backgroundColor="rgba(91,126,107,0.1)"
            borderRadius="$4"
            padding="$3"
            gap="$3"
            alignItems="flex-start"
            borderWidth={1}
            borderColor="rgba(91,126,107,0.2)"
          >
            <Shield size={18} color="#5B7E6B" />
            <SizableText size="$3" color="#9CA3AF" flex={1} lineHeight={20}>
              This information stays on your device and is only used to personalize your study suggestions and answer tone.
            </SizableText>
          </XStack>

          {/* ── Personal Info ── */}
          <FormSection title="Personal Info">
            <YStack gap="$1">
              <FieldLabel label="Age Range" />
              <BlinkSelect
                items={AGE_RANGES}
                value={ageRange}
                onValueChange={(v) => setAgeRange(v as AgeRange)}
                placeholder="Select age range"
              />
            </YStack>

            <YStack gap="$1">
              <FieldLabel label="Gender" />
              <BlinkSelect
                items={GENDERS}
                value={gender}
                onValueChange={(v) => setGender(v as Gender)}
                placeholder="Select gender"
              />
            </YStack>

            <YStack gap="$1">
              <FieldLabel label="Marital Status" />
              <BlinkSelect
                items={MARITAL_STATUSES}
                value={maritalStatus}
                onValueChange={(v) => setMaritalStatus(v as MaritalStatus)}
                placeholder="Select status"
              />
            </YStack>

            {/* Has Children toggle */}
            <XStack alignItems="center" gap="$3">
              <SizableText size="$4" color="#F2F2F7" flex={1}>Has Children</SizableText>
              <Switch
                checked={hasChildren}
                onCheckedChange={setHasChildren}
                size="$3"
                backgroundColor={hasChildren ? '$green9' : '$color5'}
              >
                <Switch.Thumb animation="quick" />
              </Switch>
            </XStack>

            {/* Children ages (conditional) */}
            {hasChildren && (
              <YStack gap="$1">
                <FieldLabel label="Children's Ages" />
                <Input
                  value={childrenAges}
                  onChangeText={setChildrenAges}
                  placeholder="e.g. 5, 10, 14 (comma separated)"
                  backgroundColor="#1C1C1E"
                  borderColor="#3A3A3C"
                  color="#F2F2F7"
                  placeholderTextColor="#4B5563"
                  borderRadius="$3"
                  keyboardType="numbers-and-punctuation"
                />
              </YStack>
            )}

            <YStack gap="$1">
              <FieldLabel label="Work / School Situation" />
              <Input
                value={workSituation}
                onChangeText={setWorkSituation}
                placeholder="e.g. Full-time employee, Student, Retired…"
                backgroundColor="#1C1C1E"
                borderColor="#3A3A3C"
                color="#F2F2F7"
                placeholderTextColor="#4B5563"
                borderRadius="$3"
              />
            </YStack>
          </FormSection>

          {/* ── Spiritual Profile ── */}
          <FormSection title="Spiritual Profile">
            <YStack gap="$1">
              <FieldLabel label="Spiritual Status" />
              <BlinkSelect
                items={SPIRITUAL_STATUSES}
                value={spiritualStatus}
                onValueChange={(v) => setSpiritualStatus(v as SpiritualStatus)}
                placeholder="Select spiritual status"
              />
            </YStack>

            <YStack gap="$1">
              <FieldLabel label="Preferred Study Style" />
              <BlinkSelect
                items={STUDY_STYLES}
                value={studyStyle}
                onValueChange={(v) => setStudyStyle(v as UserProfile['preferredStudyStyle'])}
                placeholder="Select study style"
              />
            </YStack>
          </FormSection>

          {/* ── Study Notes ── */}
          <FormSection title="Study Notes">
            <TextAreaField
              label="Spiritual Goals"
              value={spiritualGoals}
              onChange={setSpiritualGoals}
              placeholder="e.g. Regular pioneer, give more public talks, improve ministry…"
              hint="One goal per line"
            />
            <TextAreaField
              label="Study Interests"
              value={studyInterests}
              onChange={setStudyInterests}
              placeholder="e.g. Bible prophecy, creation, faith & science…"
              hint="One topic per line"
            />
            <TextAreaField
              label="Personal Challenges"
              value={personalChallenges}
              onChange={setPersonalChallenges}
              placeholder="e.g. Anxiety, work pressure, family situations…"
              hint="One challenge per line"
            />
          </FormSection>

          {/* Save button (bottom) */}
          <Button
            backgroundColor="#5B7E6B"
            color="white"
            fontWeight="700"
            size="$5"
            borderRadius="$4"
            onPress={handleSave}
            disabled={isSaving}
            icon={isSaving ? <Spinner size="small" color="white" /> : <User size={18} color="white" />}
          >
            {isSaving ? 'Saving…' : 'Save Profile'}
          </Button>
        </YStack>
      </ScrollView>
    </SafeAreaView>
  );
}
