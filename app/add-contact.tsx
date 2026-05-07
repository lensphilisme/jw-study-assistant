import { useState } from 'react';
import { TouchableOpacity, ScrollView as RNScrollView, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  YStack,
  XStack,
  SizableText,
  Card,
  Button,
  Input,
  Switch,
  Separator,
  Spinner,
  ArrowLeft,
  Plus,
  X,
  DatePicker,
  BlinkSelect,
  ScrollView,
} from '@blinkdotnew/mobile-ui';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { MinistryContact } from './(tabs)/ministry';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateId() {
  return `contact_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

const STATUS_OPTIONS = [
  { label: 'First Call',      value: 'first-call' },
  { label: 'Return Visit',    value: 'return-visit' },
  { label: 'Bible Study',     value: 'bible-study' },
  { label: 'Inactive',        value: 'inactive' },
  { label: 'Not Interested',  value: 'not-interested' },
];

// ─── Chip input ───────────────────────────────────────────────────────────────

function ChipInput({
  label,
  chips,
  onAdd,
  onRemove,
  placeholder,
}: {
  label: string;
  chips: string[];
  onAdd: (v: string) => void;
  onRemove: (v: string) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState('');

  const handleAdd = () => {
    const trimmed = draft.trim();
    if (trimmed && !chips.includes(trimmed)) {
      onAdd(trimmed);
      setDraft('');
    }
  };

  return (
    <YStack gap="$2">
      <SizableText size="$3" color="#9CA3AF" fontWeight="600">
        {label}
      </SizableText>
      <XStack gap="$2" alignItems="center">
        <Input
          flex={1}
          value={draft}
          onChangeText={setDraft}
          placeholder={placeholder ?? `Add ${label.toLowerCase()}…`}
          placeholderTextColor="#4B5563"
          backgroundColor="#2C2C2E"
          borderColor="#3A3A3C"
          color="#F2F2F7"
          size="$3"
          borderRadius="$3"
          onSubmitEditing={handleAdd}
          returnKeyType="done"
        />
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={handleAdd}
          style={{
            width: 38,
            height: 38,
            borderRadius: 19,
            backgroundColor: '#5B7E6B',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Plus size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </XStack>
      {chips.length > 0 && (
        <XStack flexWrap="wrap" gap="$2" paddingTop="$1">
          {chips.map(chip => (
            <XStack
              key={chip}
              backgroundColor="rgba(91,126,107,0.15)"
              borderRadius="$10"
              paddingHorizontal="$3"
              paddingVertical="$1"
              borderWidth={1}
              borderColor="rgba(91,126,107,0.25)"
              alignItems="center"
              gap="$1"
            >
              <SizableText size="$2" color="#5B7E6B">
                {chip}
              </SizableText>
              <TouchableOpacity onPress={() => onRemove(chip)} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                <X size={12} color="#5B7E6B" />
              </TouchableOpacity>
            </XStack>
          ))}
        </XStack>
      )}
    </YStack>
  );
}

// ─── Form Field ───────────────────────────────────────────────────────────────

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <YStack gap="$2">
      <XStack gap="$1" alignItems="center">
        <SizableText size="$3" color="#9CA3AF" fontWeight="600">
          {label}
        </SizableText>
        {required && (
          <SizableText size="$3" color="#EF4444">*</SizableText>
        )}
      </XStack>
      {children}
    </YStack>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function AddContactScreen() {
  const router = useRouter();
  const { id: editId } = useLocalSearchParams<{ id?: string }>();

  const [saving, setSaving] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [status, setStatus] = useState<MinistryContact['status']>('first-call');
  const [topics, setTopics] = useState<string[]>([]);
  const [scriptures, setScriptures] = useState<string[]>([]);
  const [publications, setPublications] = useState<string[]>([]);
  const [questions, setQuestions] = useState('');
  const [notes, setNotes] = useState('');
  const [nextVisitDate, setNextVisitDate] = useState<Date | undefined>(undefined);
  const [reminderEnabled, setReminderEnabled] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Name required', 'Please enter a name for this contact.');
      return;
    }

    setSaving(true);
    try {
      const raw = await AsyncStorage.getItem('jw_sa:contacts');
      const contacts: MinistryContact[] = raw ? JSON.parse(raw) : [];

      const contact: MinistryContact = {
        id: editId ?? generateId(),
        name: name.trim(),
        nickname: nickname.trim() || undefined,
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
        status,
        topicsDiscussed: topics,
        scripturesUsed: scriptures,
        publicationsShared: publications,
        questionsAsked: questions.trim() ? [questions.trim()] : [],
        notes: notes.trim() ? [notes.trim()] : [],
        nextVisitDate: nextVisitDate?.toISOString(),
        reminderEnabled,
        visits: [],
      };

      if (editId) {
        const idx = contacts.findIndex(c => c.id === editId);
        if (idx >= 0) {
          contacts[idx] = { ...contacts[idx], ...contact };
        }
      } else {
        contacts.unshift(contact);
      }

      await AsyncStorage.setItem('jw_sa:contacts', JSON.stringify(contacts));
      router.back();
    } catch (err) {
      Alert.alert('Error', 'Could not save contact. Please try again.');
    } finally {
      setSaving(false);
    }
  };

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
        <SizableText size="$6" color="#F2F2F7" fontWeight="700" flex={1}>
          {editId ? 'Edit Contact' : 'Add Contact'}
        </SizableText>
        {saving ? (
          <Spinner size="small" color="#5B7E6B" />
        ) : (
          <Button
            size="$3"
            backgroundColor="#5B7E6B"
            color="#FFFFFF"
            borderRadius="$3"
            onPress={handleSave}
            pressStyle={{ opacity: 0.8 }}
          >
            Save
          </Button>
        )}
      </XStack>

      {/* Form */}
      <ScrollView flex={1} showsVerticalScrollIndicator={false}>
        <YStack padding="$5" gap="$5" paddingBottom={100}>

          {/* Basic Info */}
          <YStack gap="$4">
            <SizableText size="$2" color="#9CA3AF" fontWeight="700" letterSpacing={1.5}>
              BASIC INFO
            </SizableText>

            <Field label="Name" required>
              <Input
                value={name}
                onChangeText={setName}
                placeholder="Full name…"
                placeholderTextColor="#4B5563"
                backgroundColor="#2C2C2E"
                borderColor="#3A3A3C"
                color="#F2F2F7"
                size="$4"
                borderRadius="$3"
              />
            </Field>

            <Field label="Nickname">
              <Input
                value={nickname}
                onChangeText={setNickname}
                placeholder="e.g. Mrs. Johnson…"
                placeholderTextColor="#4B5563"
                backgroundColor="#2C2C2E"
                borderColor="#3A3A3C"
                color="#F2F2F7"
                size="$4"
                borderRadius="$3"
              />
            </Field>

            <Field label="Phone">
              <Input
                value={phone}
                onChangeText={setPhone}
                placeholder="+1 (555) 000-0000"
                placeholderTextColor="#4B5563"
                backgroundColor="#2C2C2E"
                borderColor="#3A3A3C"
                color="#F2F2F7"
                size="$4"
                borderRadius="$3"
                keyboardType="phone-pad"
              />
            </Field>

            <Field label="Address">
              <Input
                value={address}
                onChangeText={setAddress}
                placeholder="Street address…"
                placeholderTextColor="#4B5563"
                backgroundColor="#2C2C2E"
                borderColor="#3A3A3C"
                color="#F2F2F7"
                size="$4"
                borderRadius="$3"
              />
            </Field>

            <Field label="Status">
              <BlinkSelect
                items={STATUS_OPTIONS}
                value={status}
                onValueChange={(v) => setStatus(v as MinistryContact['status'])}
                placeholder="Select status…"
              />
            </Field>
          </YStack>

          <Separator borderColor="#3A3A3C" />

          {/* Ministry Details */}
          <YStack gap="$4">
            <SizableText size="$2" color="#9CA3AF" fontWeight="700" letterSpacing={1.5}>
              MINISTRY DETAILS
            </SizableText>

            <ChipInput
              label="Topics Discussed"
              chips={topics}
              onAdd={v => setTopics(prev => [...prev, v])}
              onRemove={v => setTopics(prev => prev.filter(t => t !== v))}
              placeholder="e.g. Kingdom of God…"
            />

            <ChipInput
              label="Scriptures Used"
              chips={scriptures}
              onAdd={v => setScriptures(prev => [...prev, v])}
              onRemove={v => setScriptures(prev => prev.filter(s => s !== v))}
              placeholder="e.g. John 3:16…"
            />

            <ChipInput
              label="Publications Shared"
              chips={publications}
              onAdd={v => setPublications(prev => [...prev, v])}
              onRemove={v => setPublications(prev => prev.filter(p => p !== v))}
              placeholder="e.g. What Does the Bible Really Teach?…"
            />

            <Field label="Questions Asked">
              <Input
                value={questions}
                onChangeText={setQuestions}
                placeholder="Questions or concerns raised…"
                placeholderTextColor="#4B5563"
                backgroundColor="#2C2C2E"
                borderColor="#3A3A3C"
                color="#F2F2F7"
                size="$4"
                borderRadius="$3"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                style={{ minHeight: 72, paddingTop: 10 }}
              />
            </Field>

            <Field label="Notes">
              <Input
                value={notes}
                onChangeText={setNotes}
                placeholder="General notes about this contact…"
                placeholderTextColor="#4B5563"
                backgroundColor="#2C2C2E"
                borderColor="#3A3A3C"
                color="#F2F2F7"
                size="$4"
                borderRadius="$3"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                style={{ minHeight: 90, paddingTop: 10 }}
              />
            </Field>
          </YStack>

          <Separator borderColor="#3A3A3C" />

          {/* Visit Scheduling */}
          <YStack gap="$4">
            <SizableText size="$2" color="#9CA3AF" fontWeight="700" letterSpacing={1.5}>
              NEXT VISIT
            </SizableText>

            <Field label="Next Visit Date">
              <DatePicker
                value={nextVisitDate}
                onDateChange={setNextVisitDate}
                minDate={new Date()}
              />
            </Field>

            <XStack alignItems="center" justifyContent="space-between">
              <YStack gap="$1" flex={1}>
                <SizableText size="$4" color="#F2F2F7" fontWeight="600">
                  Enable Reminder
                </SizableText>
                <SizableText size="$2" color="#9CA3AF">
                  Get notified before the next visit
                </SizableText>
              </YStack>
              <Switch
                checked={reminderEnabled}
                onCheckedChange={setReminderEnabled}
                backgroundColor={reminderEnabled ? '#5B7E6B' : '#3A3A3C'}
              />
            </XStack>
          </YStack>

          {/* Save button (bottom) */}
          <Button
            backgroundColor="#5B7E6B"
            color="#FFFFFF"
            borderRadius="$4"
            size="$5"
            onPress={handleSave}
            pressStyle={{ opacity: 0.8 }}
            disabled={saving}
            marginTop="$2"
          >
            {saving ? 'Saving…' : editId ? 'Update Contact' : 'Add Contact'}
          </Button>
        </YStack>
      </ScrollView>
    </SafeAreaView>
  );
}
