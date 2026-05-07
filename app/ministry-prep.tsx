// JW Study Assistant — Ministry AI Preparation Screen
import { useState } from 'react';
import { SafeAreaView, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  YStack, XStack, SizableText, Card, Spinner, Separator, toast
} from '@blinkdotnew/mobile-ui';
import { ChevronLeft, Sparkles, Bookmark, Copy, RefreshCw } from '@blinkdotnew/mobile-ui';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, AsyncStorageAdapter } from '@blinkdotnew/sdk';

const PRIMARY = '#5B7E6B';
const BG = '#1C1C1E';
const CARD_BG = '#2C2C2E';
const CARD_BORDER = '#3A3A3C';
const TEXT_PRIMARY = '#F2F2F7';
const TEXT_SECONDARY = '#9CA3AF';
const PRIMARY_SUBTLE = 'rgba(91,126,107,0.15)';

const blink = createClient({
  projectId: process.env.EXPO_PUBLIC_BLINK_PROJECT_ID!,
  auth: { mode: 'headless' },
  storage: new AsyncStorageAdapter(AsyncStorage),
});

const JW_SYSTEM_PROMPT = `You are a JW Study Assistant. You ONLY help Jehovah's Witnesses with their ministry using JW.org and Watchtower sources.

CRITICAL RULES:
1. NEVER invent scripture references, publication names, or doctrine.
2. Always cite sources as "Based on JW.org sources:".
3. If no JW source applies, say: "I could not find a JW.org source. Please search JW.org directly."
4. Keep suggestions practical, warm, and scripturally sound.
5. Answer in a respectful, humble tone.`;

export default function MinistryPrepScreen() {
  const router = useRouter();
  const { contactId } = useLocalSearchParams<{ contactId: string }>();

  const [contact, setContact] = useState<any>(null);
  const [aiSuggestion, setAiSuggestion] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Load contact
  useState(() => {
    if (contactId) {
      AsyncStorage.getItem('jw_sa:contacts').then(raw => {
        const contacts = raw ? JSON.parse(raw) : [];
        const found = contacts.find((c: any) => c.id === contactId);
        setContact(found || null);
        setLoaded(true);
      });
    } else {
      setLoaded(true);
    }
  });

  const handleGenerate = async () => {
    setIsGenerating(true);
    setAiSuggestion('');
    try {
      const contactInfo = contact
        ? `Contact: ${contact.name}\nStatus: ${contact.status}\nTopics discussed: ${contact.topicsDiscussed?.join(', ') || 'None'}\nScriptures used: ${contact.scripturesUsed?.join(', ') || 'None'}\nPublications shared: ${contact.publicationsShared?.join(', ') || 'None'}\nQuestions asked: ${contact.questionsAsked?.join(', ') || 'None'}\nNotes: ${contact.notes?.join('; ') || 'None'}`
        : 'No specific contact selected. Give general ministry suggestions.';

      const { text } = await blink.ai.generateText({
        model: 'google/gemini-3-flash',
        messages: [
          { role: 'system', content: JW_SYSTEM_PROMPT },
          {
            role: 'user',
            content: `Please suggest ministry preparation for the following:\n\n${contactInfo}\n\nProvide:\n1. Suggested conversation opener\n2. Scripture to use (from the Bible)\n3. JW.org article or video to share\n4. How to move toward a Bible study\n\nBase all suggestions on JW.org/WOL content. Be warm and practical.`,
          },
        ],
      });
      setAiSuggestion(text || '');
    } catch (e) {
      toast('Error', { message: 'Could not generate suggestion. Check your connection.', variant: 'error' });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!aiSuggestion) return;
    try {
      const saved = {
        id: `saved_${Date.now()}`,
        type: 'answer',
        title: `Ministry suggestion for ${contact?.name || 'contact'}`,
        content: aiSuggestion,
        language: 'en',
        savedAt: new Date().toISOString(),
        syncStatus: 'saved',
      };
      const raw = await AsyncStorage.getItem('jw_sa:saved_sources');
      const sources = raw ? JSON.parse(raw) : [];
      sources.unshift(saved);
      await AsyncStorage.setItem('jw_sa:saved_sources', JSON.stringify(sources));
      toast('Saved', { message: 'Suggestion saved to library', variant: 'success' });
    } catch {
      toast('Error', { message: 'Could not save suggestion', variant: 'error' });
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
          Ministry Preparation
        </SizableText>
      </XStack>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, gap: 16 }}>
        {/* Contact info */}
        {contact && (
          <Card backgroundColor={CARD_BG} borderRadius="$4" padding="$4" borderWidth={1} borderColor={CARD_BORDER}>
            <SizableText size="$4" color={TEXT_PRIMARY} fontWeight="700">{contact.name}</SizableText>
            <SizableText size="$3" color={TEXT_SECONDARY}>Status: {contact.status?.replace('-', ' ')}</SizableText>
            {contact.topicsDiscussed?.length > 0 && (
              <SizableText size="$3" color={TEXT_SECONDARY}>Topics: {contact.topicsDiscussed.join(', ')}</SizableText>
            )}
          </Card>
        )}

        {/* JW Sources notice */}
        <Card backgroundColor={PRIMARY_SUBTLE} borderRadius="$4" padding="$3" borderWidth={1} borderColor="rgba(91,126,107,0.3)">
          <XStack alignItems="center" gap="$2">
            <Sparkles size={16} color={PRIMARY} />
            <SizableText size="$2" color={PRIMARY} fontWeight="600">JW Sources Only Mode</SizableText>
          </XStack>
          <SizableText size="$2" color={TEXT_SECONDARY} marginTop="$1">
            AI suggestions are based only on JW.org/WOL content. All suggestions will include source references.
          </SizableText>
        </Card>

        {/* Generate button */}
        <TouchableOpacity
          onPress={handleGenerate}
          disabled={isGenerating}
          activeOpacity={0.8}
          style={{
            backgroundColor: PRIMARY,
            borderRadius: 12,
            paddingVertical: 14,
            alignItems: 'center',
            opacity: isGenerating ? 0.7 : 1,
            flexDirection: 'row',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          {isGenerating ? (
            <Spinner size="small" color="#fff" />
          ) : (
            <Sparkles size={18} color="#fff" />
          )}
          <SizableText size="$4" color="#fff" fontWeight="700">
            {isGenerating ? 'Generating...' : 'Get AI Ministry Suggestions'}
          </SizableText>
        </TouchableOpacity>

        {/* AI Answer */}
        {aiSuggestion !== '' && (
          <Card backgroundColor={CARD_BG} borderRadius="$4" padding="$4" borderWidth={1} borderColor={CARD_BORDER} gap="$3">
            <XStack alignItems="center" gap="$2">
              <Sparkles size={16} color={PRIMARY} />
              <SizableText size="$3" color={PRIMARY} fontWeight="700">Ministry Suggestions</SizableText>
            </XStack>
            <Separator borderColor={CARD_BORDER} />
            <SizableText size="$3" color={TEXT_PRIMARY} lineHeight={22}>
              {aiSuggestion}
            </SizableText>
            <XStack gap="$2" marginTop="$2">
              <TouchableOpacity
                onPress={handleSave}
                activeOpacity={0.7}
                style={{
                  flex: 1, backgroundColor: PRIMARY, borderRadius: 8,
                  paddingVertical: 10, alignItems: 'center', flexDirection: 'row',
                  justifyContent: 'center', gap: 6,
                }}
              >
                <Bookmark size={14} color="#fff" />
                <SizableText size="$3" color="#fff" fontWeight="600">Save</SizableText>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleGenerate}
                activeOpacity={0.7}
                style={{
                  flex: 1, backgroundColor: CARD_BORDER, borderRadius: 8,
                  paddingVertical: 10, alignItems: 'center', flexDirection: 'row',
                  justifyContent: 'center', gap: 6,
                }}
              >
                <RefreshCw size={14} color={TEXT_SECONDARY} />
                <SizableText size="$3" color={TEXT_SECONDARY} fontWeight="600">Regenerate</SizableText>
              </TouchableOpacity>
            </XStack>
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
