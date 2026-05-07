import { useState, useCallback } from 'react';
import { FlatList, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  YStack,
  XStack,
  SizableText,
  Card,
  Button,
  Input,
  Progress,
  Separator,
  Spinner,
  ArrowLeft,
  CheckSquare,
  Square,
  Brain,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Check,
  ScrollView,
} from '@blinkdotnew/mobile-ui';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@blinkdotnew/sdk';
import type { StudyPlan, StudyWeek } from './(tabs)/study';

// ─── AI Client ────────────────────────────────────────────────────────────────

let blinkClient: ReturnType<typeof createClient> | null = null;
try {
  const projectId = process.env.EXPO_PUBLIC_BLINK_PROJECT_ID;
  const publishableKey = process.env.EXPO_PUBLIC_BLINK_PUBLISHABLE_KEY;
  if (projectId && publishableKey) {
    blinkClient = createClient({ projectId, publishableKey });
  }
} catch {}

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_CONFIG = {
  weekly:  { label: 'Weekly',  color: '#3B82F6', bg: 'rgba(59,130,246,0.15)' },
  monthly: { label: 'Monthly', color: '#F59E0B', bg: 'rgba(245,158,11,0.15)' },
  annual:  { label: 'Annual',  color: '#5B7E6B', bg: 'rgba(91,126,107,0.15)' },
};

// ─── AI Week Guide ────────────────────────────────────────────────────────────

interface WeekGuide {
  keyPoints: string[];
  suggestedScriptures: string[];
  discussionQuestions: string[];
  personalApplication: string;
  jwSource: string;
}

async function generateWeekGuide(week: StudyWeek): Promise<WeekGuide> {
  if (!blinkClient) throw new Error('AI not configured.');

  const result = await (blinkClient as any).ai.generateText({
    system: `You are a JW Study Assistant. Generate a study guide for a personal study session based on a topic from JW.org materials. Only reference official Jehovah's Witnesses publications and scriptures. Respond in JSON with keys: keyPoints (string[]), suggestedScriptures (string[]), discussionQuestions (string[]), personalApplication (string), jwSource (string).`,
    messages: [{
      role: 'user',
      content: `Generate a study guide for Week ${week.weekNumber}: "${week.topic}". Include key points from JW.org, scriptures, discussion questions, and a personal application point.`,
    }],
  });

  const jsonMatch = result.text?.match(/```(?:json)?\n?([\s\S]*?)\n?```/) ||
                    result.text?.match(/\{[\s\S]*\}/);
  const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : result.text;
  return JSON.parse(jsonStr);
}

// ─── Week Card ────────────────────────────────────────────────────────────────

function WeekCard({
  week,
  onToggleComplete,
  onSaveNotes,
}: {
  week: StudyWeek;
  onToggleComplete: (weekNumber: number) => void;
  onSaveNotes: (weekNumber: number, notes: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [notes, setNotes] = useState(week.notes ?? '');
  const [guide, setGuide] = useState<WeekGuide | null>(null);
  const [loadingGuide, setLoadingGuide] = useState(false);
  const [guideError, setGuideError] = useState<string | null>(null);

  const handleGetHelp = async () => {
    setLoadingGuide(true);
    setGuideError(null);
    try {
      const g = await generateWeekGuide(week);
      setGuide(g);
    } catch (err: any) {
      setGuideError(err?.message ?? 'Could not generate guide.');
    } finally {
      setLoadingGuide(false);
    }
  };

  return (
    <Card
      backgroundColor={week.completed ? 'rgba(91,126,107,0.08)' : '#2C2C2E'}
      borderRadius="$4"
      borderWidth={1}
      borderColor={week.completed ? 'rgba(91,126,107,0.3)' : '#3A3A3C'}
      marginBottom="$3"
      overflow="hidden"
    >
      {/* Week header row */}
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => setExpanded(v => !v)}
        style={{ padding: 16 }}
      >
        <XStack alignItems="center" gap="$3">
          {/* Completion toggle */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => onToggleComplete(week.weekNumber)}
            hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
          >
            {week.completed ? (
              <YStack
                width={24}
                height={24}
                borderRadius={12}
                backgroundColor="#5B7E6B"
                justifyContent="center"
                alignItems="center"
              >
                <Check size={14} color="#FFFFFF" />
              </YStack>
            ) : (
              <YStack
                width={24}
                height={24}
                borderRadius={12}
                borderWidth={2}
                borderColor="#4B5563"
              />
            )}
          </TouchableOpacity>

          <YStack flex={1} gap="$1">
            <XStack alignItems="center" gap="$2">
              <SizableText size="$2" color="#9CA3AF" fontWeight="600">
                WEEK {week.weekNumber}
              </SizableText>
              {week.completed && (
                <YStack
                  backgroundColor="rgba(91,126,107,0.15)"
                  paddingHorizontal="$2"
                  paddingVertical={1}
                  borderRadius="$10"
                >
                  <SizableText size="$1" color="#5B7E6B" fontWeight="700">
                    DONE
                  </SizableText>
                </YStack>
              )}
            </XStack>
            <SizableText size="$4" color={week.completed ? '#9CA3AF' : '#F2F2F7'} fontWeight="600">
              {week.topic}
            </SizableText>
          </YStack>

          {expanded
            ? <ChevronUp size={18} color="#4B5563" />
            : <ChevronDown size={18} color="#4B5563" />
          }
        </XStack>
      </TouchableOpacity>

      {/* Expanded content */}
      {expanded && (
        <YStack borderTopWidth={1} borderTopColor="#3A3A3C">

          {/* JW Sources */}
          {week.jwSources?.length > 0 && (
            <YStack padding="$4" gap="$2" borderBottomWidth={1} borderBottomColor="#3A3A3C">
              <XStack alignItems="center" gap="$2">
                <BookOpen size={14} color="#5B7E6B" />
                <SizableText size="$2" color="#5B7E6B" fontWeight="700" letterSpacing={0.5}>
                  JW SOURCES
                </SizableText>
              </XStack>
              {week.jwSources.map((src, i) => (
                <SizableText key={i} size="$3" color="#D1D5DB" lineHeight={18}>
                  • {src}
                </SizableText>
              ))}
            </YStack>
          )}

          {/* Scriptures */}
          {week.scriptures?.length > 0 && (
            <YStack padding="$4" gap="$2" borderBottomWidth={1} borderBottomColor="#3A3A3C">
              <SizableText size="$2" color="#9CA3AF" fontWeight="700" letterSpacing={0.5}>
                SCRIPTURES
              </SizableText>
              <XStack flexWrap="wrap" gap="$2">
                {week.scriptures.map((s, i) => (
                  <YStack
                    key={i}
                    backgroundColor="rgba(123,107,158,0.15)"
                    paddingHorizontal="$3"
                    paddingVertical="$1"
                    borderRadius="$10"
                    borderWidth={1}
                    borderColor="rgba(123,107,158,0.25)"
                  >
                    <SizableText size="$2" color="#9B8DC4">
                      {s}
                    </SizableText>
                  </YStack>
                ))}
              </XStack>
            </YStack>
          )}

          {/* Study questions */}
          {week.studyQuestions?.length > 0 && (
            <YStack padding="$4" gap="$2" borderBottomWidth={1} borderBottomColor="#3A3A3C">
              <SizableText size="$2" color="#9CA3AF" fontWeight="700" letterSpacing={0.5}>
                STUDY QUESTIONS
              </SizableText>
              {week.studyQuestions.map((q, i) => (
                <SizableText key={i} size="$3" color="#D1D5DB" lineHeight={18}>
                  {i + 1}. {q}
                </SizableText>
              ))}
            </YStack>
          )}

          {/* AI Guide */}
          {guide && (
            <YStack
              padding="$4"
              gap="$3"
              backgroundColor="rgba(91,126,107,0.06)"
              borderBottomWidth={1}
              borderBottomColor="#3A3A3C"
            >
              <SizableText size="$2" color="#5B7E6B" fontWeight="700" letterSpacing={0.5}>
                ✨ AI STUDY GUIDE
              </SizableText>

              {guide.keyPoints?.length > 0 && (
                <YStack gap="$1">
                  <SizableText size="$3" color="#F2F2F7" fontWeight="600">Key Points</SizableText>
                  {guide.keyPoints.map((p, i) => (
                    <SizableText key={i} size="$3" color="#D1D5DB" lineHeight={18}>• {p}</SizableText>
                  ))}
                </YStack>
              )}

              {guide.suggestedScriptures?.length > 0 && (
                <YStack gap="$1">
                  <SizableText size="$3" color="#F2F2F7" fontWeight="600">Suggested Scriptures</SizableText>
                  <XStack flexWrap="wrap" gap="$2">
                    {guide.suggestedScriptures.map((s, i) => (
                      <YStack
                        key={i}
                        backgroundColor="rgba(123,107,158,0.15)"
                        paddingHorizontal="$3"
                        paddingVertical="$1"
                        borderRadius="$10"
                        borderWidth={1}
                        borderColor="rgba(123,107,158,0.25)"
                      >
                        <SizableText size="$2" color="#9B8DC4">{s}</SizableText>
                      </YStack>
                    ))}
                  </XStack>
                </YStack>
              )}

              {guide.discussionQuestions?.length > 0 && (
                <YStack gap="$1">
                  <SizableText size="$3" color="#F2F2F7" fontWeight="600">Discussion Questions</SizableText>
                  {guide.discussionQuestions.map((q, i) => (
                    <SizableText key={i} size="$3" color="#D1D5DB" lineHeight={18}>{i + 1}. {q}</SizableText>
                  ))}
                </YStack>
              )}

              {guide.personalApplication && (
                <YStack
                  backgroundColor="rgba(245,158,11,0.08)"
                  borderRadius="$3"
                  padding="$3"
                  borderWidth={1}
                  borderColor="rgba(245,158,11,0.2)"
                  gap="$1"
                >
                  <SizableText size="$2" color="#F59E0B" fontWeight="700">PERSONAL APPLICATION</SizableText>
                  <SizableText size="$3" color="#D1D5DB" lineHeight={18}>{guide.personalApplication}</SizableText>
                </YStack>
              )}

              {guide.jwSource && (
                <SizableText size="$2" color="#4B5563">
                  Source: {guide.jwSource}
                </SizableText>
              )}
            </YStack>
          )}

          {guideError && (
            <YStack
              padding="$4"
              backgroundColor="rgba(239,68,68,0.08)"
              borderBottomWidth={1}
              borderBottomColor="#3A3A3C"
            >
              <SizableText size="$2" color="#EF4444">{guideError}</SizableText>
            </YStack>
          )}

          {/* Notes */}
          <YStack padding="$4" gap="$2" borderBottomWidth={1} borderBottomColor="#3A3A3C">
            <SizableText size="$2" color="#9CA3AF" fontWeight="700" letterSpacing={0.5}>
              MY NOTES
            </SizableText>
            <Input
              value={notes}
              onChangeText={setNotes}
              placeholder="Write your study notes here…"
              placeholderTextColor="#4B5563"
              backgroundColor="#1C1C1E"
              borderColor="#3A3A3C"
              color="#F2F2F7"
              size="$3"
              borderRadius="$3"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              style={{ minHeight: 80, paddingTop: 8 }}
            />
            <Button
              size="$2"
              backgroundColor="rgba(91,126,107,0.15)"
              color="#5B7E6B"
              borderColor="rgba(91,126,107,0.25)"
              borderWidth={1}
              borderRadius="$3"
              onPress={() => onSaveNotes(week.weekNumber, notes)}
              pressStyle={{ opacity: 0.75 }}
              alignSelf="flex-end"
            >
              Save Notes
            </Button>
          </YStack>

          {/* Action buttons */}
          <XStack padding="$3" gap="$2">
            <Button
              flex={1}
              size="$2"
              backgroundColor={guide ? 'rgba(91,126,107,0.12)' : 'rgba(91,126,107,0.15)'}
              color="#5B7E6B"
              borderColor="rgba(91,126,107,0.25)"
              borderWidth={1}
              borderRadius="$3"
              onPress={handleGetHelp}
              disabled={loadingGuide}
              pressStyle={{ opacity: 0.75 }}
              icon={loadingGuide ? <Spinner size="small" color="#5B7E6B" /> : <Brain size={14} color="#5B7E6B" />}
            >
              {loadingGuide ? 'Generating…' : guide ? 'Regenerate' : 'Get AI Help'}
            </Button>
            <Button
              flex={1}
              size="$2"
              backgroundColor={week.completed ? 'rgba(239,68,68,0.1)' : 'rgba(91,126,107,0.15)'}
              color={week.completed ? '#EF4444' : '#5B7E6B'}
              borderColor={week.completed ? 'rgba(239,68,68,0.25)' : 'rgba(91,126,107,0.25)'}
              borderWidth={1}
              borderRadius="$3"
              onPress={() => onToggleComplete(week.weekNumber)}
              pressStyle={{ opacity: 0.75 }}
            >
              {week.completed ? 'Mark Incomplete' : 'Mark Complete'}
            </Button>
          </XStack>
        </YStack>
      )}
    </Card>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function StudyPlanDetailScreen() {
  const router = useRouter();
  const { planId } = useLocalSearchParams<{ planId: string }>();
  const [plan, setPlan] = useState<StudyPlan | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    const load = async () => {
      setLoading(true);
      try {
        const raw = await AsyncStorage.getItem('jw_sa:studyPlans');
        const plans: StudyPlan[] = raw ? JSON.parse(raw) : [];
        const found = plans.find(p => p.id === planId);
        setPlan(found ?? null);
      } catch {
        setPlan(null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [planId]));

  const savePlan = async (updated: StudyPlan) => {
    try {
      const raw = await AsyncStorage.getItem('jw_sa:studyPlans');
      const plans: StudyPlan[] = raw ? JSON.parse(raw) : [];
      const idx = plans.findIndex(p => p.id === updated.id);
      if (idx >= 0) plans[idx] = updated;
      await AsyncStorage.setItem('jw_sa:studyPlans', JSON.stringify(plans));
      setPlan(updated);
    } catch {
      Alert.alert('Error', 'Could not save changes. Please try again.');
    }
  };

  const handleToggleComplete = useCallback((weekNumber: number) => {
    if (!plan) return;
    const updated: StudyPlan = {
      ...plan,
      weeks: plan.weeks.map(w =>
        w.weekNumber === weekNumber ? { ...w, completed: !w.completed } : w
      ),
    };
    savePlan(updated);
  }, [plan]);

  const handleSaveNotes = useCallback((weekNumber: number, notes: string) => {
    if (!plan) return;
    const updated: StudyPlan = {
      ...plan,
      weeks: plan.weeks.map(w =>
        w.weekNumber === weekNumber ? { ...w, notes } : w
      ),
    };
    savePlan(updated);
  }, [plan]);

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#1C1C1E' }}>
        <YStack flex={1} justifyContent="center" alignItems="center">
          <Spinner size="large" color="#5B7E6B" />
        </YStack>
      </SafeAreaView>
    );
  }

  if (!plan) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#1C1C1E' }}>
        <YStack flex={1} justifyContent="center" alignItems="center" gap="$4" padding="$6">
          <SizableText size="$5" color="#F2F2F7" fontWeight="700">Plan not found</SizableText>
          <Button
            backgroundColor="#5B7E6B"
            color="#FFFFFF"
            borderRadius="$4"
            onPress={() => router.back()}
          >
            Go Back
          </Button>
        </YStack>
      </SafeAreaView>
    );
  }

  const cfg = TYPE_CONFIG[plan.type];
  const completed = plan.weeks.filter(w => w.completed).length;
  const total = plan.weeks.length;
  const progress = total > 0 ? completed / total : 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#1C1C1E' }}>
      {/* Header */}
      <XStack
        paddingHorizontal="$5"
        paddingTop="$3"
        paddingBottom="$3"
        alignItems="center"
        gap="$3"
        borderBottomWidth={1}
        borderBottomColor="#2C2C2E"
      >
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => router.back()}
          style={{ width: 36, height: 36, justifyContent: 'center' }}
        >
          <ArrowLeft size={22} color="#9CA3AF" />
        </TouchableOpacity>
        <YStack flex={1} gap="$1">
          <SizableText size="$5" color="#F2F2F7" fontWeight="700" numberOfLines={1}>
            {plan.title}
          </SizableText>
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
      </XStack>

      <FlatList
        data={plan.weeks}
        keyExtractor={item => String(item.weekNumber)}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}
        ListHeaderComponent={
          <YStack gap="$4" paddingTop="$4" paddingBottom="$2">
            {/* Overall progress */}
            <Card
              backgroundColor="#2C2C2E"
              borderRadius="$4"
              padding="$4"
              borderWidth={1}
              borderColor="#3A3A3C"
              gap="$3"
            >
              <XStack justifyContent="space-between" alignItems="center">
                <SizableText size="$4" color="#F2F2F7" fontWeight="600">
                  Overall Progress
                </SizableText>
                <SizableText size="$5" color={cfg.color} fontWeight="800">
                  {Math.round(progress * 100)}%
                </SizableText>
              </XStack>
              <Progress value={Math.round(progress * 100)} backgroundColor="#3A3A3C" height={8} borderRadius="$10">
                <Progress.Indicator backgroundColor={cfg.color} borderRadius="$10" animation="bouncy" />
              </Progress>
              <SizableText size="$2" color="#9CA3AF">
                {completed} of {total} weeks completed
              </SizableText>
            </Card>

            <SizableText size="$2" color="#9CA3AF" fontWeight="600" letterSpacing={0.5}>
              ALL WEEKS
            </SizableText>
          </YStack>
        }
        renderItem={({ item }) => (
          <WeekCard
            week={item}
            onToggleComplete={handleToggleComplete}
            onSaveNotes={handleSaveNotes}
          />
        )}
      />
    </SafeAreaView>
  );
}
