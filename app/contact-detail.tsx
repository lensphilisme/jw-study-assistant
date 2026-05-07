import { useState, useCallback } from 'react';
import { TouchableOpacity, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  YStack,
  XStack,
  SizableText,
  Card,
  Button,
  Separator,
  Spinner,
  ScrollView,
  ArrowLeft,
  Edit3,
  Phone,
  MapPin,
  Calendar,
  BookOpen,
  MessageSquare,
  Lightbulb,
  ChevronRight,
  Bell,
  BellOff,
  Check,
} from '@blinkdotnew/mobile-ui';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@blinkdotnew/sdk';
import type { MinistryContact } from './(tabs)/ministry';

// ─── Blink AI client (visual layer only — wired by backendDeveloper) ──────────

let blinkClient: ReturnType<typeof createClient> | null = null;
try {
  const projectId = process.env.EXPO_PUBLIC_BLINK_PROJECT_ID;
  const publishableKey = process.env.EXPO_PUBLIC_BLINK_PUBLISHABLE_KEY;
  if (projectId && publishableKey) {
    blinkClient = createClient({ projectId, publishableKey });
  }
} catch {}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  MinistryContact['status'],
  { label: string; color: string; bg: string }
> = {
  'first-call':     { label: 'First Call',     color: '#F59E0B', bg: 'rgba(245,158,11,0.15)' },
  'return-visit':   { label: 'Return Visit',   color: '#3B82F6', bg: 'rgba(59,130,246,0.15)' },
  'bible-study':    { label: 'Bible Study',    color: '#5B7E6B', bg: 'rgba(91,126,107,0.15)' },
  'inactive':       { label: 'Inactive',       color: '#9CA3AF', bg: 'rgba(156,163,175,0.15)' },
  'not-interested': { label: 'Not Interested', color: '#EF4444', bg: 'rgba(239,68,68,0.15)' },
};

function formatDate(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });
}

function isOverdue(iso?: string): boolean {
  if (!iso) return false;
  return new Date(iso) < new Date();
}

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return (
    <SizableText size="$2" color="#9CA3AF" fontWeight="700" letterSpacing={1.5} paddingTop="$2">
      {title}
    </SizableText>
  );
}

// ─── Info Row ─────────────────────────────────────────────────────────────────

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
}) {
  if (!value) return null;
  return (
    <XStack gap="$3" alignItems="flex-start" paddingVertical="$2">
      <YStack width={22} alignItems="center" paddingTop={1}>
        {icon}
      </YStack>
      <YStack flex={1} gap="$0">
        <SizableText size="$2" color="#9CA3AF">
          {label}
        </SizableText>
        <SizableText size="$3" color="#F2F2F7">
          {value}
        </SizableText>
      </YStack>
    </XStack>
  );
}

// ─── Tag List ─────────────────────────────────────────────────────────────────

function TagList({ items, color }: { items: string[]; color?: string }) {
  if (!items?.length) {
    return (
      <SizableText size="$3" color="#4B5563" fontStyle="italic">
        None recorded
      </SizableText>
    );
  }
  return (
    <XStack flexWrap="wrap" gap="$2" paddingTop="$1">
      {items.map(item => (
        <YStack
          key={item}
          backgroundColor={color ? `${color}18` : 'rgba(91,126,107,0.12)'}
          borderRadius="$10"
          paddingHorizontal="$3"
          paddingVertical="$1"
          borderWidth={1}
          borderColor={color ? `${color}30` : 'rgba(91,126,107,0.22)'}
        >
          <SizableText size="$2" color={color ?? '#5B7E6B'}>
            {item}
          </SizableText>
        </YStack>
      ))}
    </XStack>
  );
}

// ─── AI Suggestions Panel ─────────────────────────────────────────────────────

function AISuggestionsPanel({ contact }: { contact: MinistryContact }) {
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!blinkClient) {
      setError('AI not configured. Please set EXPO_PUBLIC_BLINK_PROJECT_ID and EXPO_PUBLIC_BLINK_PUBLISHABLE_KEY.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const topicsList = contact.topicsDiscussed.join(', ') || 'general spiritual topics';
      const scripturesList = contact.scripturesUsed.join(', ') || 'none yet';
      const pubList = contact.publicationsShared.join(', ') || 'none yet';

      const result = await (blinkClient as any).ai.generateText({
        system: `You are a JW Study Assistant helping a Jehovah's Witness prepare for their next visit with a bible student or return visit. Only suggest topics, scriptures, and materials from JW.org official sources (jw.org, Watchtower, Awake!, Bible Teach book, Enjoy Life Forever, etc.). Be practical, warm, and encouraging. Respond in structured JSON format with these keys: nextTopic (string), scripture (object with reference and text), jwOrgResource (object with title, type, and url), studyTip (string), conversationStarter (string).`,
        messages: [{
          role: 'user',
          content: `Contact: ${contact.name} (${STATUS_CONFIG[contact.status].label}).\nTopics already discussed: ${topicsList}.\nScriptures used: ${scripturesList}.\nPublications shared: ${pubList}.\nStatus: ${contact.status}.\n\nPlease suggest what to focus on for the next visit to help them progress toward or deepen their Bible study.`,
        }],
      });

      let parsed: any = null;
      try {
        // Extract JSON from markdown code blocks if present
        const jsonMatch = result.text?.match(/```(?:json)?\n?([\s\S]*?)\n?```/) ||
                          result.text?.match(/\{[\s\S]*\}/);
        const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : result.text;
        parsed = JSON.parse(jsonStr);
      } catch {
        setSuggestions(result.text ?? 'No suggestions generated.');
        return;
      }

      const formatted = [
        parsed.nextTopic && `💬 Next Topic\n${parsed.nextTopic}`,
        parsed.scripture && `📖 Scripture\n${parsed.scripture.reference} — "${parsed.scripture.text}"`,
        parsed.jwOrgResource && `🌐 JW.org Resource\n${parsed.jwOrgResource.title} (${parsed.jwOrgResource.type})`,
        parsed.conversationStarter && `🗣 Conversation Starter\n${parsed.conversationStarter}`,
        parsed.studyTip && `✨ Study Tip\n${parsed.studyTip}`,
      ].filter(Boolean).join('\n\n');

      setSuggestions(formatted);
    } catch (err: any) {
      setError(err?.message ?? 'Could not generate suggestions. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card
      backgroundColor="#2C2C2E"
      borderRadius="$4"
      padding="$4"
      borderWidth={1}
      borderColor="#3A3A3C"
      gap="$3"
    >
      <XStack alignItems="center" gap="$2">
        <Lightbulb size={18} color="#F59E0B" />
        <SizableText size="$4" color="#F2F2F7" fontWeight="700">
          AI Suggestions
        </SizableText>
      </XStack>

      {!suggestions && !error && (
        <SizableText size="$3" color="#9CA3AF" lineHeight={20}>
          Let AI analyze this contact's history and suggest the best approach, scriptures, and JW.org resources for your next visit.
        </SizableText>
      )}

      {error && (
        <YStack
          backgroundColor="rgba(239,68,68,0.1)"
          borderRadius="$3"
          padding="$3"
          borderWidth={1}
          borderColor="rgba(239,68,68,0.2)"
        >
          <SizableText size="$2" color="#EF4444">
            {error}
          </SizableText>
        </YStack>
      )}

      {suggestions && (
        <YStack
          backgroundColor="rgba(91,126,107,0.08)"
          borderRadius="$3"
          padding="$3"
          borderWidth={1}
          borderColor="rgba(91,126,107,0.2)"
          gap="$2"
        >
          {suggestions.split('\n\n').map((block, i) => {
            const [title, ...rest] = block.split('\n');
            return (
              <YStack key={i} gap="$1" paddingBottom={i < suggestions.split('\n\n').length - 1 ? '$2' : 0}>
                <SizableText size="$3" color="#5B7E6B" fontWeight="700">
                  {title}
                </SizableText>
                {rest.length > 0 && (
                  <SizableText size="$3" color="#D1D5DB" lineHeight={20}>
                    {rest.join('\n')}
                  </SizableText>
                )}
                {i < suggestions.split('\n\n').length - 1 && (
                  <Separator borderColor="rgba(91,126,107,0.15)" marginTop="$2" />
                )}
              </YStack>
            );
          })}
        </YStack>
      )}

      <Button
        backgroundColor={suggestions ? 'rgba(91,126,107,0.15)' : '#5B7E6B'}
        color={suggestions ? '#5B7E6B' : '#FFFFFF'}
        borderRadius="$3"
        size="$3"
        onPress={handleGenerate}
        disabled={loading}
        pressStyle={{ opacity: 0.8 }}
        icon={loading ? <Spinner size="small" color={suggestions ? '#5B7E6B' : '#FFFFFF'} /> : undefined}
      >
        {loading ? 'Generating…' : suggestions ? 'Regenerate Suggestions' : 'Get AI Suggestions'}
      </Button>
    </Card>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ContactDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [contact, setContact] = useState<MinistryContact | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    const load = async () => {
      setLoading(true);
      try {
        const raw = await AsyncStorage.getItem('jw_sa:contacts');
        const contacts: MinistryContact[] = raw ? JSON.parse(raw) : [];
        const found = contacts.find(c => c.id === id);
        setContact(found ?? null);
      } catch {
        setContact(null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]));

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#1C1C1E' }}>
        <YStack flex={1} justifyContent="center" alignItems="center">
          <Spinner size="large" color="#5B7E6B" />
        </YStack>
      </SafeAreaView>
    );
  }

  if (!contact) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#1C1C1E' }}>
        <YStack flex={1} justifyContent="center" alignItems="center" gap="$4" padding="$6">
          <SizableText size="$5" color="#F2F2F7" fontWeight="700">Contact not found</SizableText>
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

  const cfg = STATUS_CONFIG[contact.status];
  const overdue = isOverdue(contact.nextVisitDate);

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
          <SizableText size="$6" color="#F2F2F7" fontWeight="700" numberOfLines={1}>
            {contact.name}
          </SizableText>
          <YStack
            backgroundColor={cfg.bg}
            paddingHorizontal="$2"
            paddingVertical={2}
            borderRadius="$10"
            alignSelf="flex-start"
          >
            <SizableText size="$1" color={cfg.color} fontWeight="700">
              {cfg.label.toUpperCase()}
            </SizableText>
          </YStack>
        </YStack>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => router.push(`/add-contact?id=${contact.id}` as any)}
          style={{
            width: 38,
            height: 38,
            borderRadius: 19,
            backgroundColor: '#2C2C2E',
            borderWidth: 1,
            borderColor: '#3A3A3C',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Edit3 size={16} color="#9CA3AF" />
        </TouchableOpacity>
      </XStack>

      <ScrollView flex={1} showsVerticalScrollIndicator={false}>
        <YStack padding="$5" gap="$5" paddingBottom={100}>

          {/* Action buttons */}
          <XStack gap="$3">
            <Button
              flex={1}
              backgroundColor="rgba(91,126,107,0.15)"
              color="#5B7E6B"
              borderColor="rgba(91,126,107,0.3)"
              borderWidth={1}
              borderRadius="$4"
              size="$4"
              onPress={() => router.push(`/add-visit?contactId=${contact.id}` as any)}
              pressStyle={{ opacity: 0.75 }}
            >
              Record Visit
            </Button>
            <Button
              flex={1}
              backgroundColor="rgba(59,130,246,0.12)"
              color="#3B82F6"
              borderColor="rgba(59,130,246,0.25)"
              borderWidth={1}
              borderRadius="$4"
              size="$4"
              onPress={() => router.push(`/ministry-prep?contactId=${contact.id}` as any)}
              pressStyle={{ opacity: 0.75 }}
            >
              Prepare
            </Button>
          </XStack>

          {/* Contact Info */}
          <YStack gap="$3">
            <SectionHeader title="CONTACT INFO" />
            <Card
              backgroundColor="#2C2C2E"
              borderRadius="$4"
              padding="$4"
              borderWidth={1}
              borderColor="#3A3A3C"
            >
              <InfoRow
                icon={<Phone size={16} color="#9CA3AF" />}
                label="Phone"
                value={contact.phone}
              />
              {contact.phone && contact.address && <Separator borderColor="#3A3A3C" />}
              <InfoRow
                icon={<MapPin size={16} color="#9CA3AF" />}
                label="Address"
                value={contact.address}
              />
              {(contact.phone || contact.address) && (
                <Separator borderColor="#3A3A3C" />
              )}
              <InfoRow
                icon={
                  <YStack width={16} height={16} borderRadius={8} backgroundColor={cfg.color} />
                }
                label="Status"
                value={cfg.label}
              />
            </Card>
          </YStack>

          {/* Ministry History */}
          <YStack gap="$3">
            <SectionHeader title="MINISTRY HISTORY" />
            <Card
              backgroundColor="#2C2C2E"
              borderRadius="$4"
              padding="$4"
              borderWidth={1}
              borderColor="#3A3A3C"
              gap="$4"
            >
              <YStack gap="$2">
                <SizableText size="$3" color="#F2F2F7" fontWeight="600">
                  Topics Discussed
                </SizableText>
                <TagList items={contact.topicsDiscussed} color="#5B7E6B" />
              </YStack>
              <Separator borderColor="#3A3A3C" />
              <YStack gap="$2">
                <SizableText size="$3" color="#F2F2F7" fontWeight="600">
                  Scriptures Used
                </SizableText>
                <TagList items={contact.scripturesUsed} color="#7B6B9E" />
              </YStack>
              <Separator borderColor="#3A3A3C" />
              <YStack gap="$2">
                <SizableText size="$3" color="#F2F2F7" fontWeight="600">
                  Publications Shared
                </SizableText>
                <TagList items={contact.publicationsShared} color="#9E7B5A" />
              </YStack>
            </Card>
          </YStack>

          {/* Questions & Notes */}
          {(contact.questionsAsked?.length > 0 || contact.notes?.length > 0) && (
            <YStack gap="$3">
              <SectionHeader title="QUESTIONS & NOTES" />
              <Card
                backgroundColor="#2C2C2E"
                borderRadius="$4"
                padding="$4"
                borderWidth={1}
                borderColor="#3A3A3C"
                gap="$3"
              >
                {contact.questionsAsked?.map((q, i) => (
                  <YStack key={`q-${i}`} gap="$1">
                    <XStack gap="$2" alignItems="flex-start">
                      <MessageSquare size={14} color="#F59E0B" style={{ marginTop: 3 }} />
                      <SizableText size="$3" color="#D1D5DB" flex={1} lineHeight={20}>
                        {q}
                      </SizableText>
                    </XStack>
                    {i < contact.questionsAsked.length - 1 && (
                      <Separator borderColor="#3A3A3C" marginTop="$2" />
                    )}
                  </YStack>
                ))}
                {contact.questionsAsked?.length > 0 && contact.notes?.length > 0 && (
                  <Separator borderColor="#3A3A3C" />
                )}
                {contact.notes?.map((n, i) => (
                  <SizableText key={`n-${i}`} size="$3" color="#D1D5DB" lineHeight={20}>
                    {n}
                  </SizableText>
                ))}
              </Card>
            </YStack>
          )}

          {/* Visit History */}
          <YStack gap="$3">
            <XStack justifyContent="space-between" alignItems="center">
              <SectionHeader title="VISIT HISTORY" />
              <SizableText size="$2" color="#9CA3AF">
                {contact.visits?.length ?? 0} visit{(contact.visits?.length ?? 0) !== 1 ? 's' : ''}
              </SizableText>
            </XStack>
            {contact.visits?.length > 0 ? (
              <Card
                backgroundColor="#2C2C2E"
                borderRadius="$4"
                borderWidth={1}
                borderColor="#3A3A3C"
                overflow="hidden"
              >
                {contact.visits.map((v, i) => (
                  <YStack key={v.id ?? i}>
                    <XStack padding="$4" gap="$3" alignItems="flex-start">
                      <YStack
                        width={8}
                        height={8}
                        borderRadius={4}
                        backgroundColor="#5B7E6B"
                        marginTop={7}
                        flexShrink={0}
                      />
                      <YStack flex={1} gap="$1">
                        <SizableText size="$3" color="#F2F2F7" fontWeight="600">
                          {formatDate(v.date)}
                        </SizableText>
                        {v.notes ? (
                          <SizableText size="$3" color="#9CA3AF" lineHeight={18}>
                            {v.notes}
                          </SizableText>
                        ) : null}
                        {v.duration ? (
                          <SizableText size="$2" color="#6B7280">
                            {v.duration} min
                          </SizableText>
                        ) : null}
                      </YStack>
                    </XStack>
                    {i < contact.visits.length - 1 && (
                      <Separator borderColor="#3A3A3C" marginLeft={28} />
                    )}
                  </YStack>
                ))}
              </Card>
            ) : (
              <Card
                backgroundColor="#2C2C2E"
                borderRadius="$4"
                padding="$4"
                borderWidth={1}
                borderColor="#3A3A3C"
                alignItems="center"
              >
                <SizableText size="$3" color="#4B5563" fontStyle="italic">
                  No visits recorded yet
                </SizableText>
              </Card>
            )}
          </YStack>

          {/* Bible Study Progress */}
          {contact.status === 'bible-study' && (
            <YStack gap="$3">
              <SectionHeader title="BIBLE STUDY PROGRESS" />
              <Card
                backgroundColor="#2C2C2E"
                borderRadius="$4"
                padding="$4"
                borderWidth={1}
                borderColor="rgba(91,126,107,0.3)"
                gap="$3"
              >
                <XStack gap="$3" alignItems="center">
                  <BookOpen size={20} color="#5B7E6B" />
                  <YStack flex={1} gap="$1">
                    <SizableText size="$3" color="#F2F2F7" fontWeight="600">
                      Active Bible Study
                    </SizableText>
                    <SizableText size="$2" color="#9CA3AF">
                      {contact.publicationsShared?.[0] ?? 'Publication not set'}
                    </SizableText>
                  </YStack>
                </XStack>
                <Separator borderColor="#3A3A3C" />
                <SizableText size="$3" color="#9CA3AF" lineHeight={18}>
                  {contact.visits?.length ?? 0} study session{(contact.visits?.length ?? 0) !== 1 ? 's' : ''} completed
                </SizableText>
              </Card>
            </YStack>
          )}

          {/* Next Visit */}
          <YStack gap="$3">
            <SectionHeader title="NEXT VISIT" />
            <Card
              backgroundColor="#2C2C2E"
              borderRadius="$4"
              padding="$4"
              borderWidth={1}
              borderColor={overdue && contact.nextVisitDate ? 'rgba(239,68,68,0.3)' : '#3A3A3C'}
              gap="$3"
            >
              <XStack alignItems="center" gap="$3">
                <Calendar
                  size={20}
                  color={overdue && contact.nextVisitDate ? '#EF4444' : '#5B7E6B'}
                />
                <YStack flex={1}>
                  <SizableText size="$3" color="#F2F2F7" fontWeight="600">
                    {contact.nextVisitDate
                      ? formatDate(contact.nextVisitDate)
                      : 'No date set'}
                  </SizableText>
                  {overdue && contact.nextVisitDate && (
                    <SizableText size="$2" color="#EF4444">
                      This visit is overdue
                    </SizableText>
                  )}
                </YStack>
                {contact.reminderEnabled ? (
                  <Bell size={16} color="#5B7E6B" />
                ) : (
                  <BellOff size={16} color="#4B5563" />
                )}
              </XStack>
            </Card>
          </YStack>

          {/* AI Suggestions */}
          <YStack gap="$3">
            <SectionHeader title="AI ASSISTANCE" />
            <AISuggestionsPanel contact={contact} />
          </YStack>

        </YStack>
      </ScrollView>
    </SafeAreaView>
  );
}
