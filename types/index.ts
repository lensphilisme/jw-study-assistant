// ============================================================
// JW Study Assistant — Central TypeScript Type Definitions
// ============================================================

// -----------------------------------------------------------
// Language
// -----------------------------------------------------------
export interface Language {
  code: string;           // e.g. "E", "F", "S"
  symbol: string;         // URL symbol e.g. "en", "fr", "es"
  name: string;           // Native name e.g. "English", "Français"
  englishName: string;    // English name e.g. "English", "French"
  direction: 'ltr' | 'rtl';
  wolRegion: string;      // e.g. "r1" — used in WOL URLs
  wolLangParam: string;   // e.g. "lp-e" — used in WOL URLs
}

// -----------------------------------------------------------
// User Profile
// -----------------------------------------------------------
export type AgeRange = 'under-18' | '18-25' | '26-35' | '36-45' | '46-55' | '56-65' | '65+';
export type Gender = 'male' | 'female' | 'prefer-not-to-say';
export type MaritalStatus = 'single' | 'married' | 'divorced' | 'widowed';
export type WorkSituation = 'employed-full' | 'employed-part' | 'self-employed' | 'student' | 'homemaker' | 'retired' | 'unemployed';
export type SpiritualStatus =
  | 'publisher'
  | 'baptized'
  | 'pioneer'
  | 'elder'
  | 'ms'
  | 'bible-student'
  | 'other';

export interface UserProfile {
  id: string;
  ageRange: AgeRange;
  gender: Gender;
  maritalStatus: MaritalStatus;
  hasChildren: boolean;
  childrenAges: number[];
  workSituation: WorkSituation;
  spiritualStatus: SpiritualStatus;
  spiritualGoals: string[];
  studyInterests: string[];
  personalChallenges: string[];
  preferredStudyStyle: 'visual' | 'audio' | 'reading' | 'interactive';
}

// -----------------------------------------------------------
// Daily Text
// -----------------------------------------------------------
export interface DailyText {
  id: string;
  date: string;           // ISO date string "YYYY-MM-DD"
  scripture: string;      // e.g. "John 3:16"
  scriptureText: string;  // Full scripture text
  comment: string;        // The commentary / meditation
  sourceUrl: string;
  language: string;       // language code
  savedAt?: string;       // ISO timestamp
  notes?: string;
}

// -----------------------------------------------------------
// Meeting Week & Parts
// -----------------------------------------------------------
export type MeetingPartType =
  | 'treasures'
  | 'gems'
  | 'reading'
  | 'ministry'
  | 'living'
  | 'congregation-study';

export interface GeneratedAnswer {
  id: string;
  parentId: string;
  parentType: 'meeting-part' | 'watchtower-article' | 'daily-text' | 'ministry' | 'general';
  length: 'short' | 'medium' | 'long';
  tone: 'natural' | 'heartfelt' | 'scriptural';
  content: string;
  sources: SourceCitation[];
  createdAt: string;      // ISO timestamp
  saved: boolean;
}

export interface SourceCitation {
  title: string;
  url?: string;
  publication?: string;
  paragraph?: string;
  scripture?: string;
}

export interface MeetingPart {
  id: string;
  weekId: string;
  type: MeetingPartType;
  title: string;
  timeMinutes: number;
  bibleReading?: string;
  questions: string[];
  references: string[];
  videoUrl?: string;
  imageUrl?: string;
  generatedAnswers: GeneratedAnswer[];
}

export interface WatchtowerArticle {
  id: string;
  issueId: string;
  docId: string;
  title: string;
  themeScripture: string;
  studyWeekStart: string;   // ISO date
  studyWeekEnd: string;     // ISO date
  paragraphs: Paragraph[];
  questions: ArticleQuestion[];
  language: string;
}

export interface MeetingWeek {
  id: string;
  year: number;
  week: number;
  startDate: string;        // ISO date
  endDate: string;          // ISO date
  language: string;
  midweekTitle: string;
  weekendTitle: string;
  parts: MeetingPart[];
  watchtowerArticle?: WatchtowerArticle;
}

// -----------------------------------------------------------
// Watchtower
// -----------------------------------------------------------
export interface Paragraph {
  id: string;
  articleId: string;
  number: number;
  text: string;
  dataPid?: string;
  audioMarker?: string;
}

export interface ArticleQuestion {
  id: string;
  articleId: string;
  paragraphNumbers: number[];
  questionText: string;
  generatedAnswers: GeneratedAnswer[];
}

export interface WatchtowerIssue {
  id: string;
  pub: string;              // e.g. "w"
  issue: string;            // e.g. "202602"
  title: string;
  language: string;
  coverUrl?: string;
  articles: WatchtowerArticle[];
}

// -----------------------------------------------------------
// Ministry Contacts
// -----------------------------------------------------------
export type ContactStatus =
  | 'first-call'
  | 'return-visit'
  | 'bible-study'
  | 'inactive'
  | 'not-interested';

export interface LessonRecord {
  lesson: string;
  date: string;             // ISO date
  notes: string;
  questionsAsked: string[];
}

export interface BibleStudy {
  id: string;
  contactId: string;
  publication: string;
  currentLesson: string;
  lessonHistory: LessonRecord[];
  studentInterests: string[];
  notes: string[];
}

export interface Visit {
  id: string;
  contactId: string;
  date: string;             // ISO date
  duration?: number;        // minutes
  topicDiscussed: string;
  scripturesUsed: string[];
  publicationsShared: string[];
  notes: string;
  outcome: string;
}

export interface MinistryContact {
  id: string;
  name: string;
  nickname?: string;
  phone?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  status: ContactStatus;
  topicsDiscussed: string[];
  scripturesUsed: string[];
  publicationsShared: string[];
  videosShared: string[];
  questionsAsked: string[];
  notes: string[];
  nextVisitDate?: string;   // ISO date
  reminderEnabled: boolean;
  visits: Visit[];
  bibleStudy?: BibleStudy;
}

// -----------------------------------------------------------
// Personal Study Plans
// -----------------------------------------------------------
export interface StudyWeek {
  id: string;
  planId: string;
  weekNumber: number;
  topic: string;
  jwSources: string[];
  scriptures: string[];
  questions: string[];
  reflections: string[];
  notes: string;
  completed: boolean;
}

export interface PersonalStudyPlan {
  id: string;
  title: string;
  type: 'weekly' | 'monthly' | 'annual';
  topics: string[];
  weeks: StudyWeek[];
  createdAt: string;        // ISO timestamp
  completedAt?: string;     // ISO timestamp
}

// -----------------------------------------------------------
// Saved Sources
// -----------------------------------------------------------
export type SavedSourceType =
  | 'article'
  | 'daily-text'
  | 'meeting-part'
  | 'watchtower'
  | 'answer'
  | 'note';

export type SyncStatus = 'saved' | 'updated' | 'needs-refresh';

export interface SavedSource {
  id: string;
  type: SavedSourceType;
  title: string;
  content: string;
  url?: string;
  docId?: string;
  language: string;
  savedAt: string;          // ISO timestamp
  syncStatus: SyncStatus;
  metadata?: Record<string, unknown>;
}

// -----------------------------------------------------------
// Search
// -----------------------------------------------------------
export type SearchResultType =
  | 'article'
  | 'bible'
  | 'publication'
  | 'video'
  | 'meeting'
  | 'watchtower';

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  docId?: string;
  type: SearchResultType;
}

// -----------------------------------------------------------
// Bible
// -----------------------------------------------------------
export interface BibleBook {
  number: number;
  standardName: string;
  standardAbbreviation: string;
  chapterCount: number;
  url: string;
}

// -----------------------------------------------------------
// Reminders
// -----------------------------------------------------------
export type ReminderType =
  | 'daily-text'
  | 'meeting-prep'
  | 'watchtower-prep'
  | 'study-plan'
  | 'return-visit'
  | 'bible-study';

export interface Reminder {
  id: string;
  type: ReminderType;
  title: string;
  time: string;             // HH:MM 24h format
  enabled: boolean;
  relatedId?: string;
}
