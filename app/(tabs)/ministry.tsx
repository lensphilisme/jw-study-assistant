import { useEffect, useState, useCallback } from 'react';
import { FlatList, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  YStack,
  XStack,
  SizableText,
  Card,
  Button,
  Separator,
  Spinner,
  Users,
  ChevronRight,
  Plus,
  Calendar,
  Bell,
} from '@blinkdotnew/mobile-ui';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePremiumTheme } from '@/hooks/usePremiumTheme';
import { AppScreen, PageHeader, PremiumCard, GradientButton, EmptyState, StatCard, FilterChip } from '@/components/premium';

export interface MinistryContact {
  id: string;
  name: string;
  nickname?: string;
  phone?: string;
  address?: string;
  status: 'first-call' | 'return-visit' | 'bible-study' | 'inactive' | 'not-interested';
  topicsDiscussed: string[];
  scripturesUsed: string[];
  publicationsShared: string[];
  questionsAsked: string[];
  notes: string[];
  nextVisitDate?: string;
  reminderEnabled: boolean;
  visits: Array<{ id: string; date: string; notes: string; duration?: number }>;
}

type FilterType = 'all' | 'return-visit' | 'bible-study' | 'first-call';

const STATUS_CONFIG: Record<MinistryContact['status'], { label: string; color: string; bg: string }> = {
  'first-call': { label: 'First Call', color: '#F59E0B', bg: 'rgba(245,158,11,0.15)' },
  'return-visit': { label: 'Return Visit', color: '#3B82F6', bg: 'rgba(59,130,246,0.15)' },
  'bible-study': { label: 'Bible Study', color: '#5B7E6B', bg: 'rgba(91,126,107,0.15)' },
  'inactive': { label: 'Inactive', color: '#9CA3AF', bg: 'rgba(156,163,175,0.15)' },
  'not-interested': { label: 'Not Interested', color: '#EF4444', bg: 'rgba(239,68,68,0.15)' },
};

function formatDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function isOverdue(iso?: string): boolean {
  if (!iso) return false;
  return new Date(iso) < new Date();
}

const FILTER_TABS: { key: FilterType; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'return-visit', label: 'Return Visits' },
  { key: 'bible-study', label: 'Bible Studies' },
  { key: 'first-call', label: 'First Call' },
];

function ContactCard({
  contact,
  onPress,
  onVisit,
  onPrepare,
}: {
  contact: MinistryContact;
  onPress: () => void;
  onVisit: () => void;
  onPrepare: () => void;
}) {
  const colors = usePremiumTheme();
  const cfg = STATUS_CONFIG[contact.status];
  const lastVisit = contact.visits?.[contact.visits.length - 1]?.date;
  const overdue = isOverdue(contact.nextVisitDate);

  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress}>
      <YStack
        backgroundColor={colors.surface}
        borderRadius="$6"
        borderWidth={1}
        borderColor={colors.border}
        overflow="hidden"
        marginBottom="$3"
      >
        <XStack padding="$4" gap="$3" alignItems="center">
          <YStack
            width={48}
            height={48}
            borderRadius={24}
            backgroundColor={colors.glow}
            justifyContent="center"
            alignItems="center"
          >
            <SizableText size="$5" color={colors.primary} fontWeight="900">
              {contact.name?.charAt(0).toUpperCase() || '?'}
            </SizableText>
          </YStack>

          <YStack flex={1} gap="$1">
            <XStack alignItems="center" gap="$2">
              <SizableText size="$5" color={colors.text} fontWeight="800">
                {contact.name || 'Anonymous'}
              </SizableText>
              {contact.nickname && (
                <SizableText size="$3" color={colors.textMuted}>"{contact.nickname}"</SizableText>
              )}
            </XStack>
            <XStack gap="$2" flexWrap="wrap" alignItems="center">
              <YStack backgroundColor={cfg.bg} paddingHorizontal="$2" paddingVertical={2} borderRadius="$10">
                <SizableText size="$1" color={cfg.color} fontWeight="700">{cfg.label.toUpperCase()}</SizableText>
              </YStack>
              {lastVisit && (
                <SizableText size="$2" color={colors.textMuted}>Last: {formatDate(lastVisit)}</SizableText>
              )}
            </XStack>
            {contact.topicsDiscussed?.length > 0 && (
              <SizableText size="$2" color={colors.textMuted} numberOfLines={1}>
                Topics: {contact.topicsDiscussed.slice(0, 2).join(', ')}
              </SizableText>
            )}
          </YStack>

          <ChevronRight size={18} color={colors.textMuted} />
        </XStack>

        {contact.nextVisitDate && (
          <>
            <Separator borderColor={colors.border} />
            <XStack
              paddingHorizontal="$4"
              paddingVertical="$2"
              gap="$2"
              alignItems="center"
              backgroundColor={overdue ? 'rgba(239,68,68,0.06)' : 'transparent'}
            >
              <Calendar size={14} color={overdue ? colors.danger : colors.textMuted} />
              <SizableText size="$2" color={overdue ? colors.danger : colors.textMuted}>
                {overdue ? 'Overdue' : 'Next visit'}: {formatDate(contact.nextVisitDate)}
              </SizableText>
            </XStack>
          </>
        )}

        <Separator borderColor={colors.border} />
        <XStack padding="$2" gap="$2">
          <Button
            flex={1}
            size="$2"
            backgroundColor={colors.glow}
            color={colors.primary}
            borderRadius="$3"
            onPress={(e) => { e.stopPropagation?.(); onVisit(); }}
            pressStyle={{ opacity: 0.75 }}
          >
            Log Visit
          </Button>
          <Button
            flex={1}
            size="$2"
            backgroundColor={colors.glowBlue}
            color={colors.accent}
            borderRadius="$3"
            onPress={(e) => { e.stopPropagation?.(); onPrepare(); }}
            pressStyle={{ opacity: 0.75 }}
          >
            Prepare
          </Button>
        </XStack>
      </YStack>
    </TouchableOpacity>
  );
}

export default function MinistryScreen() {
  const router = useRouter();
  const colors = usePremiumTheme();
  const [contacts, setContacts] = useState<MinistryContact[]>([]);
  const [filter, setFilter] = useState<FilterType>('all');
  const [loading, setLoading] = useState(true);

  const loadContacts = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem('jw_sa:contacts');
      setContacts(raw ? JSON.parse(raw) : []);
    } catch {
      setContacts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadContacts(); }, [loadContacts]));

  const filtered = filter === 'all' ? contacts : contacts.filter((c) => c.status === filter);

  const total = contacts.length;
  const rvCount = contacts.filter((c) => c.status === 'return-visit').length;
  const bsCount = contacts.filter((c) => c.status === 'bible-study').length;
  const overdueCount = contacts.filter((c) => isOverdue(c.nextVisitDate)).length;

  return (
    <AppScreen scroll>
      <PageHeader
        title="Field Ministry"
        action={
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => router.push('/add-contact' as any)}
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
      ) : (
        <YStack gap="$4">
          {/* Stats */}
          <XStack gap="$2">
            <StatCard value={total} label="Total" />
            <StatCard value={rvCount} label="Return Visits" color="#3B82F6" />
            <StatCard value={bsCount} label="Bible Studies" color={colors.primary} />
            <StatCard value={overdueCount} label="Overdue" color={overdueCount > 0 ? colors.danger : colors.textMuted} />
          </XStack>

          {/* Filter Chips */}
          <XStack gap="$2" flexWrap="wrap">
            {FILTER_TABS.map((tab) => (
              <FilterChip
                key={tab.key}
                label={tab.label}
                active={filter === tab.key}
                onPress={() => setFilter(tab.key)}
              />
            ))}
          </XStack>

          {/* Contacts List */}
          {filtered.length === 0 ? (
            <EmptyState
              icon={<Users size={40} color={colors.primary} />}
              title={filter === 'all' ? 'No ministry contacts yet' : `No ${FILTER_TABS.find((t) => t.key === filter)?.label.toLowerCase()}`}
              subtitle="Add your first contact to track your return visits, bible studies, and field service progress."
              action={
                <GradientButton onPress={() => router.push('/add-contact' as any)} icon={<Plus size={16} color="white" />}>
                  Add First Contact
                </GradientButton>
              }
            />
          ) : (
            <YStack gap="$2">
              <SizableText size="$2" color={colors.textMuted} fontWeight="700" letterSpacing={0.5}>
                {filtered.length} CONTACT{filtered.length !== 1 ? 'S' : ''}
              </SizableText>
              {filtered.map((contact) => (
                <ContactCard
                  key={contact.id}
                  contact={contact}
                  onPress={() => router.push(`/contact-detail?id=${contact.id}` as any)}
                  onVisit={() => router.push(`/add-visit?contactId=${contact.id}` as any)}
                  onPrepare={() => router.push(`/ministry-prep?contactId=${contact.id}` as any)}
                />
              ))}
            </YStack>
          )}
        </YStack>
      )}
    </AppScreen>
  );
}
