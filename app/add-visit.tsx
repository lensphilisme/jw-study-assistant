// JW Study Assistant — Add Visit Screen
import { useState } from 'react';
import { SafeAreaView, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  YStack, XStack, SizableText, Card, Button, Input, Separator, toast
} from '@blinkdotnew/mobile-ui';
import { ChevronLeft, Check, Plus, X } from '@blinkdotnew/mobile-ui';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PRIMARY = '#5B7E6B';
const BG = '#1C1C1E';
const CARD_BG = '#2C2C2E';
const CARD_BORDER = '#3A3A3C';
const TEXT_PRIMARY = '#F2F2F7';
const TEXT_SECONDARY = '#9CA3AF';

function generateId() {
  return `vis_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export default function AddVisitScreen() {
  const router = useRouter();
  const { contactId } = useLocalSearchParams<{ contactId: string }>();

  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [topic, setTopic] = useState('');
  const [scriptures, setScriptures] = useState('');
  const [publications, setPublications] = useState('');
  const [notes, setNotes] = useState('');
  const [duration, setDuration] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!contactId) return;
    setSaving(true);
    try {
      const raw = await AsyncStorage.getItem('jw_sa:contacts');
      const contacts = raw ? JSON.parse(raw) : [];
      const idx = contacts.findIndex((c: any) => c.id === contactId);
      if (idx !== -1) {
        const visit = {
          id: generateId(),
          date,
          notes,
          topicDiscussed: topic,
          scripturesUsed: scriptures.split(',').map((s: string) => s.trim()).filter(Boolean),
          publicationsShared: publications.split(',').map((p: string) => p.trim()).filter(Boolean),
          duration: duration ? parseInt(duration) : undefined,
        };
        if (!contacts[idx].visits) contacts[idx].visits = [];
        contacts[idx].visits.unshift(visit);
        await AsyncStorage.setItem('jw_sa:contacts', JSON.stringify(contacts));
        toast('Visit recorded', { message: 'Visit saved successfully', variant: 'success' });
        router.back();
      }
    } catch (e) {
      toast('Error', { message: 'Could not save visit', variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BG }}>
      {/* Header */}
      <XStack paddingHorizontal="$5" paddingTop="$4" paddingBottom="$2" alignItems="center" gap="$3">
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <ChevronLeft size={24} color={TEXT_PRIMARY} />
        </TouchableOpacity>
        <SizableText size="$5" color={TEXT_PRIMARY} fontWeight="700" flex={1}>
          Record Visit
        </SizableText>
      </XStack>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, gap: 16 }}
        keyboardShouldPersistTaps="handled">
        
        {/* Date */}
        <YStack gap="$2">
          <SizableText size="$3" color={TEXT_SECONDARY} fontWeight="600">Visit Date</SizableText>
          <Input
            value={date}
            onChangeText={setDate}
            placeholder="YYYY-MM-DD"
            backgroundColor={CARD_BG}
            borderColor={CARD_BORDER}
            color={TEXT_PRIMARY}
            placeholderTextColor={TEXT_SECONDARY}
          />
        </YStack>

        {/* Topic */}
        <YStack gap="$2">
          <SizableText size="$3" color={TEXT_SECONDARY} fontWeight="600">Topic Discussed</SizableText>
          <Input
            value={topic}
            onChangeText={setTopic}
            placeholder="e.g. Hope of resurrection"
            backgroundColor={CARD_BG}
            borderColor={CARD_BORDER}
            color={TEXT_PRIMARY}
            placeholderTextColor={TEXT_SECONDARY}
          />
        </YStack>

        {/* Scriptures */}
        <YStack gap="$2">
          <SizableText size="$3" color={TEXT_SECONDARY} fontWeight="600">Scriptures Used (comma separated)</SizableText>
          <Input
            value={scriptures}
            onChangeText={setScriptures}
            placeholder="e.g. John 3:16, Rev 21:4"
            backgroundColor={CARD_BG}
            borderColor={CARD_BORDER}
            color={TEXT_PRIMARY}
            placeholderTextColor={TEXT_SECONDARY}
          />
        </YStack>

        {/* Publications */}
        <YStack gap="$2">
          <SizableText size="$3" color={TEXT_SECONDARY} fontWeight="600">Publications/Videos Shared</SizableText>
          <Input
            value={publications}
            onChangeText={setPublications}
            placeholder="e.g. Good News from God brochure"
            backgroundColor={CARD_BG}
            borderColor={CARD_BORDER}
            color={TEXT_PRIMARY}
            placeholderTextColor={TEXT_SECONDARY}
          />
        </YStack>

        {/* Duration */}
        <YStack gap="$2">
          <SizableText size="$3" color={TEXT_SECONDARY} fontWeight="600">Duration (minutes, optional)</SizableText>
          <Input
            value={duration}
            onChangeText={setDuration}
            placeholder="e.g. 30"
            keyboardType="numeric"
            backgroundColor={CARD_BG}
            borderColor={CARD_BORDER}
            color={TEXT_PRIMARY}
            placeholderTextColor={TEXT_SECONDARY}
          />
        </YStack>

        {/* Notes */}
        <YStack gap="$2">
          <SizableText size="$3" color={TEXT_SECONDARY} fontWeight="600">Notes</SizableText>
          <Input
            value={notes}
            onChangeText={setNotes}
            placeholder="How did it go? What was the response?"
            multiline
            numberOfLines={4}
            backgroundColor={CARD_BG}
            borderColor={CARD_BORDER}
            color={TEXT_PRIMARY}
            placeholderTextColor={TEXT_SECONDARY}
            style={{ minHeight: 100, textAlignVertical: 'top', paddingTop: 12 }}
          />
        </YStack>

        {/* Save */}
        <TouchableOpacity
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.8}
          style={{
            backgroundColor: PRIMARY,
            borderRadius: 12,
            paddingVertical: 14,
            alignItems: 'center',
            marginTop: 8,
            opacity: saving ? 0.7 : 1,
          }}
        >
          <SizableText size="$4" color="#fff" fontWeight="700">
            {saving ? 'Saving...' : 'Save Visit Record'}
          </SizableText>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
