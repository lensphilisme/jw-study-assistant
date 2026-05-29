import { useState, useCallback } from 'react';
import { FlatList, TouchableOpacity, Alert, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  YStack,
  XStack,
  SizableText,
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
  Sparkles,
} from '@blinkdotnew/mobile-ui';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { generateAiText } from '@/services/localAiService';
import { usePremiumTheme } from '@/hooks/usePremiumTheme';
import { AppScreen, PageHeader, PremiumCard, GradientButton, EmptyState } from '@/components/premium';

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

function generateId() {
  return `plan_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

const TYPE_OPTIONS = [
  { label: 'Weekly (4 weeks)', value: 'weekly' },
  { label: 'Monthly (12 weeks)', value: 'monthly' },
  { label: 'Annual (52 weeks)', value: 'annual' },
];

const TYPE_WEEKS: Record<StudyPlan['type'], number> = {
  weekly: 4,
  monthly: 12,
  annual: 52,
};

const TYPE_CONFIG: Record<StudyPlan['type'], { label: string; color: string; bg: string }> = {
  weekly: { label: 'Weekly', color: '#3B82F6', bg: 'rgba(59,130,246,0.15)' },
  monthly: { label: 'Monthly', color: '#F59E0B', bg: 'rgba(245,158,11,0.15)' },
  annual: { label: 'Annual', color: '#5B7E6B', bg: 'rgba(91,126,107,0.15)' },
};

function PlanCard({ plan, onPress }: { plan: StudyPlan; onPress: () => void }) {
  const colors = usePremiumTheme();
  const cfg = TYPE_CONFIG[plan.type];
  const completed = plan.weeks.filter((w) => w.completed).length;
  const total = plan.weeks.length;
  const progress = total > 0 ? completed / total : 0;
  const currentWeek = plan.weeks.find((w) => !w.completed);

  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress}>
      <YStack
        backgroundColor={colors.surface}
        borderRadius="$7"
        borderWidth={1}
        borderColor={colors.border}
        padding="$4"
        marginBottom="$3"
        gap="$3"
      >
        <XStack alignItems="flex-start" gap="$3">
          <YStack flex={1} gap="$2">
            <XStack alignItems="center" gap="$2" flexWrap="wrap">
              <SizableText size="$5" color={colors.text} fontWeight="900" flex={1}>
                {plan.title}
              </SizableText>
              {plan.aiGenerated && (
                <YStack backgroundColor={colors.glow} paddingHorizontal="$2" paddingVertical={2} borderRadius="$10">
                  <SizableText size="$1" color={colors.primary} fontWeight="700">AI</SizableText>
                </YStack>
              )}
            </XStack>
            <YStack backgroundColor={cfg.bg} paddingHorizontal="$2" paddingVertical={2} borderRadius="$10" alignSelf="flex-start">
              <SizableText size="$1" color={cfg.color} fontWeight="700">
                {cfg.label.toUpperCase()} - {total} WEEKS
              </SizableText>
            </YStack>
          </YStack>
          <ChevronRight size={18} color={colors.textMuted} />
        </XStack>

        <YStack gap="$2">
          <XStack justifyContent="space-between">
            <SizableText size="$2" color={colors.textMuted}>Progress</SizableText>
            <SizableText size="$2" color={colors.text} fontWeight="700">{completed}/{total} weeks</SizableText>
          </XStack>
          <Progress value={Math.round(progress * 100)} backgroundColor={colors.surface2} height={6} borderRadius="$10">
            <Progress.Indicator backgroundColor={cfg.color} borderRadius="$10" animation="bouncy" />
          </Progress>
        </YStack>

        {currentWeek && (
          <>
            <Separator borderColor={colors.border} />
            <XStack gap="$2" alignItems="center">
              <SizableText size="$2" color={colors.textMuted}>Week {currentWeek.weekNumber}:</SizableText>
              <SizableText size="$3" color={colors.textSoft} flex={1} numberOfLines={1}>{currentWeek.topic}</SizableText>
            </XStack>
          </>
        )}

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
          Continue
        </Button>
      </YStack>
    </TouchableOpacity>
  );
}

function CreatePlanSheet({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (plan: StudyPlan) => void;
}) {
  const colors = usePremiumTheme();
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

      if (useAI) {
        const profileRaw = await AsyncStorage.getItem('user_profile');
        const profile = profileRaw ? JSON.parse(profileRaw) : {};
        const lang = await AsyncStorage.getItem('selected_language');

        const result = await generateAiText({
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

      if (weekTopics.length < totalWeeks) {
        const manualTopics = topicsText.split('\n').map((t) => t.trim()).filter(Boolean);
        weekTopics = Array.from({ length: totalWeeks }, (_, i) => manualTopics[i] ?? `Week ${i + 1} Study`);
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
      onOpenChange={(o: boolean) => { if (!o) { reset(); onClose(); } }}
      snapPoints={[85]}
      dismissOnSnapToBottom
    >
      <Sheet.Overlay animation="lazy" enterStyle={{ opacity: 0 }} exitStyle={{ opacity: 0 }} backgroundColor={colors.mode === 'dark' ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.2)'} />
      <Sheet.Frame backgroundColor={colors.surface} borderTopLeftRadius="$7" borderTopRightRadius="$7">
        <Sheet.Handle backgroundColor={colors.borderStrong} />
        <ScrollView flex={1} showsVerticalScrollIndicator={false}>
          <YStack padding="$5" gap="$5" paddingBottom={60}>
            <XStack justifyContent="space-between" alignItems="center">
              <SizableText size="$6" color={colors.text} fontWeight="900">New Study Plan</SizableText>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => { reset(); onClose(); }}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: colors.surface2,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <X size={18} color={colors.textMuted} />
              </TouchableOpacity>
            </XStack>

            <YStack gap="$2">
              <SizableText size="$3" color={colors.textMuted} fontWeight="700">Plan Title *</SizableText>
              <Input
                value={title}
                onChangeText={setTitle}
                placeholder="e.g. Strengthening My Faith..."
                placeholderTextColor={colors.textMuted}
                backgroundColor={colors.surface2}
                borderColor={colors.border}
                color={colors.text}
                size="$4"
                borderRadius="$4"
              />
            </YStack>

            <YStack gap="$2">
              <SizableText size="$3" color={colors.textMuted} fontWeight="700">Plan Type</SizableText>
              <BlinkSelect
                items={TYPE_OPTIONS}
                value={planType}
                onValueChange={(v) => setPlanType(v as StudyPlan['type'])}
                placeholder="Select type..."
              />
            </YStack>

            <YStack gap="$2">
              <SizableText size="$3" color={colors.textMuted} fontWeight="700">Topics (one per line)</SizableText>
              <Input
                value={topicsText}
                onChangeText={setTopicsText}
                placeholder={"God's Kingdom\nResurrection hope\nThe Bible's reliability..."}
                placeholderTextColor={colors.textMuted}
                backgroundColor={colors.surface2}
                borderColor={colors.border}
                color={colors.text}
                size="$4"
                borderRadius="$4"
                multiline
                numberOfLines={5}
                textAlignVertical="top"
                style={{ minHeight: 110, paddingTop: 10 }}
                editable={!useAI}
              />
            </YStack>

            <Card backgroundColor={colors.glow} borderRadius="$5" padding="$4" borderWidth={1} borderColor={useAI ? colors.primary : colors.border}>
              <XStack alignItems="center" gap="$3">
                <Brain size={22} color={colors.primary} />
                <YStack flex={1} gap="$1">
                  <SizableText size="$4" color={colors.text} fontWeight="700">AI Suggest Topics</SizableText>
                  <SizableText size="$2" color={colors.textMuted}>Let AI create personalized topics based on your profile</SizableText>
                </YStack>
                <Switch
                  checked={useAI}
                  onCheckedChange={setUseAI}
                  backgroundColor={useAI ? colors.primary : colors.surface3}
                />
              </XStack>
            </Card>

            <GradientButton onPress={handleCreate} disabled={creating} icon={creating ? <Spinner size="small" color="white" /> : <Sparkles size={16} color="white" />}>
              {creating ? (useAI ? 'Generating Plan...' : 'Creating...') : 'Create Plan'}
            </GradientButton>
          </YStack>
        </ScrollView>
      </Sheet.Frame>
    </Sheet>
  );
}

export default function StudyScreen() {
  const router = useRouter();
  const colors = usePremiumTheme();
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

  useFocusEffect(useCallback(() => { loadPlans(); }, [loadPlans]));

  return (
    <AppScreen scroll>
      <PageHeader
        title="Study Plan"
        action={
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setShowCreate(true)}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: colors.primary,
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Plus size={22} color="white" />
          </TouchableOpacity>
        }
      />

      {loading ? (
        <YStack flex={1} justifyContent="center" alignItems="center" paddingTop="$10">
          <Spinner size="large" color={colors.primary} />
        </YStack>
      ) : plans.length === 0 ? (
        <EmptyState
          icon={<BookMarked size={40} color={colors.primary} />}
          title="No study plans yet"
          subtitle="Let AI create a personalized plan based on your profile, or build your own with custom topics."
          action={
            <GradientButton onPress={() => setShowCreate(true)} icon={<Plus size={16} color="white" />}>
              Create First Plan
            </GradientButton>
          }
        />
      ) : (
        <YStack gap="$3">
          <SizableText size="$2" color={colors.textMuted} fontWeight="700" letterSpacing={0.5}>
            {plans.length} ACTIVE PLAN{plans.length !== 1 ? 'S' : ''}
          </SizableText>
          {plans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} onPress={() => router.push(`/study-plan-detail?planId=${plan.id}` as any)} />
          ))}
          <GradientButton onPress={() => setShowCreate(true)} icon={<Brain size={16} color="white" />}>
            Create AI Study Plan
          </GradientButton>
        </YStack>
      )}

      <CreatePlanSheet open={showCreate} onClose={() => setShowCreate(false)} onCreated={(plan) => {
        setPlans((prev) => [plan, ...prev]);
        setShowCreate(false);
        router.push(`/study-plan-detail?planId=${plan.id}` as any);
      }} />
    </AppScreen>
  );
}
