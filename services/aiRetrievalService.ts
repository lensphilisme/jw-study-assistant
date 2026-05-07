// ============================================================
// JW Study Assistant — AI Retrieval Service
// Uses Blink SDK AI (google/gemini-2.5-flash) with JW-only rules.
// ALL answers are grounded in provided JW source content —
// the model is forbidden from using general AI knowledge.
// ============================================================
import { createClient, AsyncStorageAdapter } from '@blinkdotnew/sdk';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  UserProfile,
  DailyText,
  MinistryContact,
  GeneratedAnswer,
  PersonalStudyPlan,
  StudyWeek,
  SourceCitation,
} from '../types';

// -----------------------------------------------------------
// Blink client (headless auth, AsyncStorage persistence)
// -----------------------------------------------------------
const blink = createClient({
  projectId: process.env.EXPO_PUBLIC_BLINK_PROJECT_ID!,
  auth: { mode: 'headless' },
  storage: new AsyncStorageAdapter(AsyncStorage),
});

// -----------------------------------------------------------
// JW Sources Only system prompt
// -----------------------------------------------------------
const JW_SYSTEM_PROMPT = `You are a JW Study Assistant. You ONLY answer using the JW.org/WOL/JW Library source content provided to you.

CRITICAL RULES:
1. NEVER invent scripture references, publication names, paragraph numbers, or dates.
2. NEVER answer from general AI knowledge about doctrine or scripture.
3. If provided sources do not contain enough information, say: "I could not find a JW.org/WOL source for that. Please try another search or open JW.org directly."
4. Always show your sources: "Based on sources: [list]"
5. Answer respectfully, simply, and in the same language as the user's question.
6. If video content is the only source, say: "This topic has video content on JW.org. Please view it directly."`;

// -----------------------------------------------------------
// Internal helpers
// -----------------------------------------------------------

function generateId(): string {
  return `ans_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function nowISO(): string {
  return new Date().toISOString();
}

function lengthInstruction(length: 'short' | 'medium' | 'long'): string {
  switch (length) {
    case 'short':  return 'Respond in 1–2 concise sentences (under 80 words).';
    case 'long':   return 'Respond in 4–6 detailed sentences (150–250 words), covering key points thoroughly.';
    default:       return 'Respond in 2–4 sentences (80–150 words).';
  }
}

function toneInstruction(tone: 'natural' | 'heartfelt' | 'scriptural'): string {
  switch (tone) {
    case 'heartfelt':  return 'Use a warm, personal, emotionally engaging tone — speak from the heart.';
    case 'scriptural': return 'Use a direct scriptural tone — closely reference the Bible text and publications.';
    default:           return 'Use a natural, conversational tone — as if speaking at a meeting.';
  }
}

function profileContext(profile?: UserProfile): string {
  if (!profile) return '';
  return (
    `\n\nADAPT FOR THIS PERSON:\n` +
    `- Spiritual status: ${profile.spiritualStatus}\n` +
    `- Study style: ${profile.preferredStudyStyle}\n` +
    (profile.spiritualGoals.length ? `- Goals: ${profile.spiritualGoals.join(', ')}\n` : '') +
    (profile.studyInterests.length ? `- Interests: ${profile.studyInterests.join(', ')}\n` : '')
  );
}

function sourcesBlock(retrievedContent: string): string {
  if (!retrievedContent.trim()) return '';
  return `\n\n---\nJW SOURCE CONTENT (use ONLY this):\n${retrievedContent}\n---`;
}

// -----------------------------------------------------------
// answerFromJWSources
// -----------------------------------------------------------

/**
 * Answer a general question grounded in retrieved JW source content.
 */
export async function answerFromJWSources(
  question: string,
  retrievedContent: string,
  sources: SourceCitation[],
  profile?: UserProfile,
  language?: string
): Promise<GeneratedAnswer> {
  const langNote = language ? `\nUser's language preference: ${language}` : '';

  const prompt =
    `${JW_SYSTEM_PROMPT}${profileContext(profile)}${langNote}` +
    sourcesBlock(retrievedContent) +
    `\n\nQUESTION: ${question}\n\n` +
    `${lengthInstruction('medium')} ${toneInstruction('natural')}\n` +
    `After your answer, append "Based on sources:" followed by the source titles.`;

  const { text } = await blink.ai.generateText({
    prompt,
    model: 'google/gemini-2.5-flash',
  });

  return {
    id: generateId(),
    parentId: 'general',
    parentType: 'general',
    length: 'medium',
    tone: 'natural',
    content: text,
    sources,
    createdAt: nowISO(),
    saved: false,
  };
}

// -----------------------------------------------------------
// generateMeetingAnswer
// -----------------------------------------------------------

/**
 * Generate a meeting-part answer for a given question/references.
 */
export async function generateMeetingAnswer(
  partTitle: string,
  questions: string[],
  references: string[],
  retrievedContent: string,
  sources: SourceCitation[],
  length: 'short' | 'medium' | 'long',
  tone: 'natural' | 'heartfelt' | 'scriptural'
): Promise<GeneratedAnswer> {
  const refsText = references.length
    ? `\nRelevant references: ${references.join(', ')}`
    : '';
  const questionsText = questions.length
    ? `\nQuestions to answer:\n${questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}`
    : '';

  const prompt =
    `${JW_SYSTEM_PROMPT}` +
    sourcesBlock(retrievedContent) +
    `\n\nMEETING PART: "${partTitle}"${refsText}${questionsText}\n\n` +
    `Prepare a spoken answer for this meeting part.\n` +
    `${lengthInstruction(length)} ${toneInstruction(tone)}\n` +
    `End with: "Based on sources: [list source titles]"`;

  const { text } = await blink.ai.generateText({
    prompt,
    model: 'google/gemini-2.5-flash',
  });

  return {
    id: generateId(),
    parentId: partTitle,
    parentType: 'meeting-part',
    length,
    tone,
    content: text,
    sources,
    createdAt: nowISO(),
    saved: false,
  };
}

// -----------------------------------------------------------
// generateWatchtowerAnswer
// -----------------------------------------------------------

/**
 * Generate an answer for a Watchtower paragraph study question.
 */
export async function generateWatchtowerAnswer(
  paragraphText: string,
  question: string,
  articleContext: string,
  sources: SourceCitation[],
  length: 'short' | 'medium' | 'long',
  tone: 'natural' | 'heartfelt' | 'scriptural'
): Promise<GeneratedAnswer> {
  const prompt =
    `${JW_SYSTEM_PROMPT}` +
    `\n\nARTICLE CONTEXT:\n${articleContext}` +
    `\n\nPARAGRAPH TEXT:\n${paragraphText}` +
    `\n\nSTUDY QUESTION: ${question}\n\n` +
    `Prepare a thoughtful answer for the Watchtower study.\n` +
    `${lengthInstruction(length)} ${toneInstruction(tone)}\n` +
    `End with: "Based on sources: [list source titles]"`;

  const { text } = await blink.ai.generateText({
    prompt,
    model: 'google/gemini-2.5-flash',
  });

  return {
    id: generateId(),
    parentId: question,
    parentType: 'watchtower-article',
    length,
    tone,
    content: text,
    sources,
    createdAt: nowISO(),
    saved: false,
  };
}

// -----------------------------------------------------------
// generateMinistrySuggestion
// -----------------------------------------------------------

/**
 * Generate a ministry suggestion / approach for a specific contact.
 */
export async function generateMinistrySuggestion(
  contactInfo: MinistryContact,
  retrievedContent: string,
  sources: SourceCitation[]
): Promise<GeneratedAnswer> {
  const history = contactInfo.visits.length
    ? `\nPrevious visits (${contactInfo.visits.length}):\n` +
      contactInfo.visits
        .slice(-3) // last 3 visits for context
        .map((v) => `  - ${v.date}: "${v.topicDiscussed}" — ${v.outcome}`)
        .join('\n')
    : '';

  const topics = contactInfo.topicsDiscussed.length
    ? `\nTopics already discussed: ${contactInfo.topicsDiscussed.join(', ')}`
    : '';

  const questions = contactInfo.questionsAsked.length
    ? `\nQuestions they have asked: ${contactInfo.questionsAsked.join(', ')}`
    : '';

  const prompt =
    `${JW_SYSTEM_PROMPT}` +
    sourcesBlock(retrievedContent) +
    `\n\nMINISTRY CONTACT:\n` +
    `- Status: ${contactInfo.status}\n` +
    `- Name: ${contactInfo.name}${history}${topics}${questions}\n\n` +
    `Suggest a specific approach for the next visit: what topic to discuss, ` +
    `which scripture to use (from provided sources only), and how to open the conversation.\n` +
    `${lengthInstruction('medium')} ${toneInstruction('natural')}\n` +
    `End with: "Based on sources: [list source titles]"`;

  const { text } = await blink.ai.generateText({
    prompt,
    model: 'google/gemini-2.5-flash',
  });

  return {
    id: generateId(),
    parentId: contactInfo.id,
    parentType: 'ministry',
    length: 'medium',
    tone: 'natural',
    content: text,
    sources,
    createdAt: nowISO(),
    saved: false,
  };
}

// -----------------------------------------------------------
// explainDailyText
// -----------------------------------------------------------

/**
 * Explain and meditate on a daily text using provided JW source content.
 */
export async function explainDailyText(
  dailyText: DailyText,
  retrievedContent: string,
  sources: SourceCitation[],
  profile?: UserProfile
): Promise<GeneratedAnswer> {
  const prompt =
    `${JW_SYSTEM_PROMPT}${profileContext(profile)}` +
    sourcesBlock(retrievedContent) +
    `\n\nDAILY TEXT (${dailyText.date}):\n` +
    `Scripture: ${dailyText.scripture}\n` +
    `"${dailyText.scriptureText}"\n\n` +
    `Commentary from JW.org:\n${dailyText.comment}\n\n` +
    `Provide a personal reflection and application of this daily text, ` +
    `drawing only from the provided JW source content above.\n` +
    `${lengthInstruction('medium')} ${toneInstruction('heartfelt')}\n` +
    `End with: "Based on sources: [list source titles]"`;

  const { text } = await blink.ai.generateText({
    prompt,
    model: 'google/gemini-2.5-flash',
  });

  return {
    id: generateId(),
    parentId: dailyText.id,
    parentType: 'daily-text',
    length: 'medium',
    tone: 'heartfelt',
    content: text,
    sources,
    createdAt: nowISO(),
    saved: false,
  };
}

// -----------------------------------------------------------
// generateStudyPlan
// -----------------------------------------------------------

/**
 * Generate a structured personal study plan using JW source content.
 * Returns a fully populated PersonalStudyPlan.
 */
export async function generateStudyPlan(
  profile: UserProfile,
  topics: string[],
  planType: 'weekly' | 'monthly' | 'annual',
  retrievedContent: string
): Promise<PersonalStudyPlan> {
  const weekCount = planType === 'weekly' ? 1 : planType === 'monthly' ? 4 : 52;
  const topicsText = topics.join(', ');

  const prompt =
    `${JW_SYSTEM_PROMPT}${profileContext(profile)}` +
    sourcesBlock(retrievedContent) +
    `\n\nCREATE A ${planType.toUpperCase()} STUDY PLAN:\n` +
    `Topics: ${topicsText}\n` +
    `Number of weeks: ${weekCount}\n\n` +
    `Return a JSON object ONLY (no markdown, no explanation) with this exact structure:\n` +
    `{\n` +
    `  "title": "string",\n` +
    `  "weeks": [\n` +
    `    {\n` +
    `      "weekNumber": number,\n` +
    `      "topic": "string",\n` +
    `      "jwSources": ["string"],\n` +
    `      "scriptures": ["string"],\n` +
    `      "questions": ["string"],\n` +
    `      "reflections": ["string"],\n` +
    `      "notes": "string"\n` +
    `    }\n` +
    `  ]\n` +
    `}\n` +
    `All jwSources and scriptures must come from the provided JW source content above.\n` +
    `Do NOT invent publication names or scripture references not present in the sources.`;

  const { text } = await blink.ai.generateText({
    prompt,
    model: 'google/gemini-2.5-flash',
  });

  // Parse JSON response
  let parsed: { title?: string; weeks?: Array<Partial<StudyWeek>> } = {};
  try {
    // Strip any markdown code fences if present
    const clean = text.replace(/```(?:json)?\n?/g, '').replace(/```/g, '').trim();
    parsed = JSON.parse(clean) as typeof parsed;
  } catch {
    // Fallback: create a minimal plan from the text
    parsed = {
      title: `Study Plan: ${topicsText}`,
      weeks: Array.from({ length: weekCount }, (_, i) => ({
        weekNumber: i + 1,
        topic: topics[i % topics.length] ?? topics[0],
        jwSources: [],
        scriptures: [],
        questions: [],
        reflections: [],
        notes: text,
      })),
    };
  }

  const planId = `plan_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  const weeks: StudyWeek[] = (parsed.weeks ?? []).map((w, i) => ({
    id: `week_${planId}_${i + 1}`,
    planId,
    weekNumber: w.weekNumber ?? i + 1,
    topic: w.topic ?? topics[i % topics.length] ?? '',
    jwSources: w.jwSources ?? [],
    scriptures: w.scriptures ?? [],
    questions: w.questions ?? [],
    reflections: w.reflections ?? [],
    notes: w.notes ?? '',
    completed: false,
  }));

  return {
    id: planId,
    title: parsed.title ?? `${planType.charAt(0).toUpperCase() + planType.slice(1)} Study Plan`,
    type: planType,
    topics,
    weeks,
    createdAt: nowISO(),
  };
}

// -----------------------------------------------------------
// Default export
// -----------------------------------------------------------
export default {
  answerFromJWSources,
  generateMeetingAnswer,
  generateWatchtowerAnswer,
  generateMinistrySuggestion,
  explainDailyText,
  generateStudyPlan,
};
