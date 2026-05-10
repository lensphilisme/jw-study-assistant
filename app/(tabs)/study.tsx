import { useState, useCallback } from 'react';
import { FlatList, TouchableOpacity, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  YStack,
  XStack,
  SizableText,
  H2,
  Card,
  Button,
  Input,
  Switch,
  Progress,
  Separator,
  Spinner,
  Sheet,
  BookMarked,
  Plus,
  ChevronRight,
  Brain,
  X,
  BlinkSelect,
  ScrollView,
} from '@blinkdotnew/mobile-ui';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@blinkdotnew/sdk';
import { useTheme } from '@/constants/theme';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StudyWeek {
  weekNumber: number;
  topic: string;
  jwSources: string[];
  scriptures: string[];
  studyQuestions: string[];
  notes: string;
  completed: boolean;
}

export interface StudyPlan {
  id: string;
  title: string;
  type: 'weekly' | 'monthly' | 'annual';
  weeks: StudyWeek[];
  createdAt: string;
  aiGenerated: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateId() {
  return `plan_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

const TYPE_OPTIONS = [
  { label: 'Weekly (4 weeks)',   value: 'weekly' },
  { label: 'Monthly (12 weeks)', value: 'monthly' },
  { label: 'Annual (52 weeks)',  value: 'annual' },
];

const TYPE_WEEKS: Record<StudyPlan['type'], number> = {
  weekly: 4,
  monthly: 12,
  annual: 52,
};

const TYPE_CONFIG: Record<
  StudyPlan['type'],
  { label: string; color: string; bg: string }
> = {
  weekly:  { label: 'Weekly',  color: '#3B82F6', bg: 'rgba(59,130,246,0.15)' },
  monthly: { label: 'Monthly', color: '#F59E0B', bg: 'rgba(245,158,11,0.15)' },
  annual:  { label: 'Annual',  color: '#5B7E6B', bg: 'rgba(91,126,107,0.15)' },
};

let blinkClient: ReturnType<typeof createClient> | null = null;
try {
  const projectId = process.env.EXPO_PUBLIC_BLINK_PROJECT_ID;
  const publishableKey = process.env.EXPO_PUBLIC_BLINK_PUBLISHABLE_KEY;
  if (projectId && publishableKey) {
    blinkClient = createClient({ projectId, publishableKey });
  }
} catch {}

// ─── Plan Card ────────────────────────────────────────────────────────────────

function PlanCard({ plan, onPress }: { plan: StudyPlan; onPress: () => void }) {
  const cfg = TYPE_CONFIG[plan.type];
  const completed = plan.weeks.filter(w => w.completed).length;
  const total = plan.weeks.length;
  const progress = total > 0 ? completed / total : 0;
  const currentWeek = plan.weeks.find(w => !w.completed);

  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress}>
      <Card
        backgroundColor="#2C2C2E"
        borderRadius="$4"
        borderWidth={1}
        borderColor="#3A3A3C"
        padding="$4"
        marginBottom="$3"
        gap="$3"
      >
        <XStack alignItems="flex-start" gap="$3">
          <YStack flex={1} gap="$2">
            <XStack alignItems="center" gap="$2" flexWrap="wrap">
              <SizableText size="$5" color="#F2F2F7" fontWeight="700" flex={1}>
                {plan.title}
              </SizableText>
              {plan.aiGenerated && (
                <YStack
                  backgroundColor="rgba(91,126,107,0.15)"
                  paddingHorizontal="$2"
                  paddingVertical={2}
                  borderRadius="$10"
                >
                  <SizableText size="$1" color="#5B7E6B" fontWeight="700">
                    AI
                  </SizableText>
                </YStack>
              )}
            </XStack>

            {/* Type badge */}
            <YStack
              backgroundColor={cfg.bg}
              paddingHorizontal="$2"
              paddingVertical={2}
              borderRadius="$10"
              alignSelf="flex-start"
            >
              <SizableText size="$1" color={cfg.color} fontWeight="700">
                {cfg.label.toUpperCase()} · {total} WEEKS
              </SizableText>
            </YStack>
          </YStack>
          <ChevronRight size={18} color="#4B5563" />
        </XStack>

        {/* Progress bar */}
        <YStack gap="$2">
          <XStack justifyContent="space-between">
            <SizableText size="$2" color="#9CA3AF">
              Progress
            </SizableText>
            <SizableText size="$2" color="#F2F2F7" fontWeight="600">
              {completed}/{total} weeks
            </SizableText>
          </XStack>
          <Progress
            value={Math.round(progress * 100)}
            backgroundColor="#3A3A3C"
            height={6}
            borderRadius="$10"
          >
            <Progress.Indicator
              backgroundColor={cfg.color}
              borderRadius="$10"
              animation="bouncy"
            />
          </Progress>
        </YStack>

        {/* Current week topic */}
        {currentWeek && (
          <>
            <Separator borderColor="#3A3A3C" />
            <XStack gap="$2" alignItems="center">
              <SizableText size="$2" color="#9CA3AF">Week {currentWeek.weekNumber}:</SizableText>
              <SizableText size="$3" color="#D1D5DB" flex={1} numberOfLines={1}>
                {currentWeek.topic}
              </SizableText>
            </XStack>
          </>
        )}

        {/* Continue button */}
        <Button
          backgroundColor={cfg.bg}
          color={cfg.color}
          borderColor={`${cfg.color}40`}
          borderWidth={1}
          borderRadius="$3"
          size="$3"
          onPress={onPress}
          pressStyle={{ opacity: 0.75 }}
        >
          Continue →
        </Button>
      </Card>
    </TouchableOpacity>
  );
}

// ─── Create Plan Sheet ────────────────────────────────────────────────────────

function CreatePlanSheet({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (plan: StudyPlan) => void;
}) {
  const [title, setTitle] = useState('');
  const [planType, setPlanType] = useState<StudyPlan['type']>('weekly');
  const [topicsText, setTopicsText] = useState('');
  const [useAI, setUseAI] = useState(false);
  const [creating, setCreating] = useState(false);

  const reset = () => {
    setTitle('');
    setPlanType('weekly');
    setTopicsText('');
    setUseAI(false);
    setCreating(false);
  };

  const handleCreate = async () => {
    if (!title.trim()) {
      Alert.alert('Title required', 'Please enter a title for your study plan.');
      return;
    }

    setCreating(true);
    try {
      const totalWeeks = TYPE_WEEKS[planType];

      let weekTopics: string[] = [];

      if (useAI && blinkClient) {
        // Load user profile for context
        const profileRaw = await AsyncStorage.getItem('user_profile');
        const profile = profileRaw ? JSON.parse(profileRaw) : {};
        const lang = await AsyncStorage.getItem('selected_language');

        const result = await (blinkClient as any).ai.generateText({
          system: `You are a JW Study Assistant creating a personalized study plan based on official Jehovah's Witness publications and JW.org materials. Only use topics from official JW sources. Respond ONLY with a JSON array of ${totalWeeks} strings, each being a study topic.`,
          messages: [{
            role: 'user',
            content: `Create ${totalWeeks} study topics for a ${planType} study plan titled "${title.trim()}". User language: ${lang ?? 'English'}. User profile: ${JSON.stringify(profile)}. Make topics progressively build understanding using JW.org materials, starting with foundational truths.`,
          }],
        });

        try {
          const jsonMatch = result.text?.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            weekTopics = JSON.parse(jsonMatch[0]);
          }
        } catch {}
      }

      // Fall back to manual topics or placeholders
      if (weekTopics.length < totalWeeks) {
        const manualTopics = topicsText
          .split('\n')
          .map(t => t.trim())
          .filter(Boolean);
        weekTopics = Array.from({ length: totalWeeks }, (_, i) =>
          manualTopics[i] ?? `Week ${i + 1} Study`
        );
      }

      const weeks: StudyWeek[] = weekTopics.slice(0, totalWeeks).map((topic, i) => ({
        weekNumber: i + 1,
        topic,
        jwSources: [],
        scriptures: [],
        studyQuestions: [],
        notes: '',
        completed: false,
      }));

      const plan: StudyPlan = {
        id: generateId(),
        title: title.trim(),
        type: planType,
        weeks,
        createdAt: new Date().toISOString(),
        aiGenerated: useAI,
      };

      const raw = await AsyncStorage.getItem('jw_sa:studyPlans');
      const plans: StudyPlan[] = raw ? JSON.parse(raw) : [];
      plans.unshift(plan);
      await AsyncStorage.setItem('jw_sa:studyPlans', JSON.stringify(plans));

      reset();
      onCreated(plan);
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not create plan. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}
      snapPoints={[85]}
      dismissOnSnapToBottom
    >
      <Sheet.Overlay animation="lazy" enterStyle={{ opacity: 0 }} exitStyle={{ opacity: 0 }} />
      <Sheet.Frame backgroundColor="#1C1C1E" borderTopLeftRadius="$5" borderTopRightRadius="$5">
        <Sheet.Handle backgroundColor="#3A3A3C" />
        <ScrollView flex={1} showsVerticalScrollIndicator={false}>
          <YStack padding="$5" gap="$5" paddingBottom={60}>
            {/* Sheet header */}
            <XStack justifyContent="space-between" alignItems="center">
              <SizableText size="$6" color="#F2F2F7" fontWeight="700">
                New Study Plan
              </SizableText>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => { reset(); onClose(); }}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: '#2C2C2E',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <X size={16} color="#9CA3AF" />
              </TouchableOpacity>
            </XStack>

            {/* Title */}
            <YStack gap="$2">
              <SizableText size="$3" color="#9CA3AF" fontWeight="600">
                Plan Title *
              </SizableText>
              <Input
                value={title}
                onChangeText={setTitle}
                placeholder="e.g. Strengthening My Faith…"
                placeholderTextColor="#4B5563"
                backgroundColor="#2C2C2E"
                borderColor="#3A3A3C"
                color="#F2F2F7"
                size="$4"
                borderRadius="$3"
              />
            </YStack>

            {/* Plan type */}
            <YStack gap="$2">
              <SizableText size="$3" color="#9CA3AF" fontWeight="600">
                Plan Type
              </SizableText>
              <BlinkSelect
                items={TYPE_OPTIONS}
                value={planType}
                onValueChange={(v) => setPlanType(v as StudyPlan['type'])}
                placeholder="Select type…"
              />
            </YStack>

            {/* Topics */}
            <YStack gap="$2">
              <SizableText size="$3" color="#9CA3AF" fontWeight="600">
                Topics (one per line)
              </SizableText>
              <Input
                value={topicsText}
                onChangeText={setTopicsText}
                placeholder={"God's Kingdom\nResurrection hope\nThe Bible's reliability…"}
                placeholderTextColor="#4B5563"
                backgroundColor="#2C2C2E"
                borderColor="#3A3A3C"
                color="#F2F2F7"
                size="$4"
                borderRadius="$3"
                multiline
                numberOfLines={5}
                textAlignVertical="top"
                style={{ minHeight: 110, paddingTop: 10 }}
                editable={!useAI}
              />
            </YStack>

            {/* AI toggle */}
            <Card
              backgroundColor="#2C2C2E"
              borderRadius="$4"
              padding="$4"
              borderWidth={1}
              borderColor={useAI ? 'rgba(91,126,107,0.4)' : '#3A3A3C'}
            >
              <XStack alignItems="center" gap="$3">
                <Brain size={20} color="#5B7E6B" />
                <YStack flex={1} gap="$1">
                  <SizableText size="$4" color="#F2F2F7" fontWeight="600">
                    AI Suggest Topics
                  </SizableText>
                  <SizableText size="$2" color="#9CA3AF">
                    Let AI create personalized topics based on your profile
                  </SizableText>
                </YStack>
                <Switch
                  checked={useAI}
                  onCheckedChange={setUseAI}
                  backgroundColor={useAI ? '#5B7E6B' : '#3A3A3C'}
                />
              </XStack>
            </Card>

            <Button
              backgroundColor="#5B7E6B"
              color="#FFFFFF"
              borderRadius="$4"
              size="$5"
              onPress={handleCreate}
              disabled={creating}
              pressStyle={{ opacity: 0.8 }}
              icon={creating ? <Spinner size="small" color="#FFFFFF" /> : undefined}
            >
              {creating ? (useAI ? 'Generating Plan…' : 'Creating…') : 'Create Plan'}
            </Button>
          </YStack>
        </ScrollView>
      </Sheet.Frame>
    </Sheet>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <YStack flex={1} alignItems="center" justifyContent="center" gap="$4" paddingTop="$12" paddingHorizontal="$6">
      <YStack
        width={80}
        height={80}
        borderRadius={40}
        backgroundColor="rgba(91,126,107,0.15)"
        justifyContent="center"
        alignItems="center"
      >
        <BookMarked size={38} color="#5B7E6B" />
      </YStack>
      <YStack gap="$2" alignItems="center">
        <SizableText size="$5" color="#F2F2F7" fontWeight="700" textAlign="center">
          No study plans yet
        </SizableText>
        <SizableText size="$3" color="#9CA3AF" textAlign="center" maxWidth={280} lineHeight={20}>
          Let AI create a personalized plan based on your profile, or build your own with custom topics.
        </SizableText>
      </YStack>
      <Button
        backgroundColor="#5B7E6B"
        color="#FFFFFF"
        borderRadius="$4"
        paddingHorizontal="$6"
        onPress={onCreate}
        pressStyle={{ opacity: 0.8 }}
        icon={<Plus size={16} color="#FFFFFF" />}
      >
        Create First Plan
      </Button>
    </YStack>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function StudyScreen() {
  const router = useRouter();
  const { t: th } = useTheme();
  const [plans, setPlans] = useState<StudyPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const loadPlans = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem('jw_sa:studyPlans');
      setPlans(raw ? JSON.parse(raw) : []);
    } catch {
      setPlans([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    loadPlans();
  }, [loadPlans]));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: th.bg }} testID="study-screen">
      {/* Header */}
      <XStack
        paddingHorizontal="$5"
        paddingTop="$3"
        paddingBottom="$2"
        justifyContent="space-between"
        alignItems="center"
      >
        <H2 color={th.ink} fontWeight="800" style={{ fontSize: 32, fontFamily: 'Georgia, serif', letterSpacing: -0.8 }}>
          Study Plans
        </H2>
        <Button
          size="$3"
          backgroundColor="#5B7E6B"
          color="#FFFFFF"
          borderRadius="$3"
          onPress={() => setShowCreate(true)}
          pressStyle={{ opacity: 0.8 }}
          icon={<Plus size={14} color="#FFFFFF" />}
        >
          New Plan
        </Button>
      </XStack>

      {loading ? (
        <YStack flex={1} justifyContent="center" alignItems="center">
          <Spinner size="large" color="#5B7E6B" />
        </YStack>
      ) : (
        <FlatList
          data={plans}
          keyExtractor={item => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}
          ListHeaderComponent={
            plans.length > 0 ? (
              <YStack paddingTop="$3" paddingBottom="$1">
                <SizableText size="$2" color="#9CA3AF" fontWeight="600" letterSpacing={0.5}>
                  {plans.length} ACTIVE PLAN{plans.length !== 1 ? 'S' : ''}
                </SizableText>
              </YStack>
            ) : null
          }
          ListEmptyComponent={
            <EmptyState onCreate={() => setShowCreate(true)} />
          }
          ListFooterComponent={
            plans.length > 0 ? (
              <YStack paddingTop="$2" paddingBottom="$4">
                <Button
                  backgroundColor="rgba(91,126,107,0.12)"
                  color="#5B7E6B"
                  borderColor="rgba(91,126,107,0.25)"
                  borderWidth={1}
                  borderRadius="$4"
                  size="$4"
                  onPress={() => setShowCreate(true)}
                  pressStyle={{ opacity: 0.75 }}
                  icon={<Brain size={16} color="#5B7E6B" />}
                >
                  Create AI Study Plan
                </Button>
              </YStack>
            ) : null
          }
          renderItem={({ item }) => (
            <PlanCard
              plan={item}
              onPress={() => router.push(`/study-plan-detail?planId=${item.id}` as any)}
            />
          )}
        />
      )}

      {/* Create plan sheet */}
      <CreatePlanSheet
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={(plan) => {
          setPlans(prev => [plan, ...prev]);
          setShowCreate(false);
          router.push(`/study-plan-detail?planId=${plan.id}` as any);
        }}
      />
    </SafeAreaView>
  );
}
