// ============================================================
// JW Study Assistant — Local Storage Service (AsyncStorage)
// All functions use JSON serialization / deserialization.
// ============================================================
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  UserProfile,
  Language,
  DailyText,
  MinistryContact,
  MeetingWeek,
  PersonalStudyPlan,
  SavedSource,
  Reminder,
} from '../types';

// -----------------------------------------------------------
// Storage keys
// -----------------------------------------------------------
const KEYS = {
  USER_PROFILE:        'jw_sa:user_profile',
  LANGUAGE:            'jw_sa:language',
  DAILY_TEXTS:         'jw_sa:daily_texts',         // JSON object keyed by date
  MEETING_WEEKS:       'jw_sa:meeting_weeks',        // JSON object keyed by "year-week"
  CONTACTS:            'jw_sa:contacts',             // JSON array
  STUDY_PLANS:         'jw_sa:study_plans',          // JSON array
  SAVED_SOURCES:       'jw_sa:saved_sources',        // JSON array
  REMINDERS:           'jw_sa:reminders',            // JSON array
  ONBOARDING_COMPLETE: 'jw_sa:onboarding_complete',  // "true" | "false"
} as const;

// -----------------------------------------------------------
// Internal helpers
// -----------------------------------------------------------

async function getJSON<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw === null) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function setJSON<T>(key: string, value: T): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

// -----------------------------------------------------------
// User Profile
// -----------------------------------------------------------

export async function saveUserProfile(profile: UserProfile): Promise<void> {
  await setJSON(KEYS.USER_PROFILE, profile);
}

export async function loadUserProfile(): Promise<UserProfile | null> {
  return getJSON<UserProfile>(KEYS.USER_PROFILE);
}

// -----------------------------------------------------------
// Language
// -----------------------------------------------------------

export async function saveLanguage(lang: Language): Promise<void> {
  await setJSON(KEYS.LANGUAGE, lang);
}

export async function loadLanguage(): Promise<Language | null> {
  return getJSON<Language>(KEYS.LANGUAGE);
}

// -----------------------------------------------------------
// Daily Text  (stored as a map: { [dateKey]: DailyText })
// -----------------------------------------------------------

export async function saveDailyText(dt: DailyText): Promise<void> {
  const map = (await getJSON<Record<string, DailyText>>(KEYS.DAILY_TEXTS)) ?? {};
  map[dt.date] = dt;
  await setJSON(KEYS.DAILY_TEXTS, map);
}

export async function loadDailyText(date: string): Promise<DailyText | null> {
  const map = await getJSON<Record<string, DailyText>>(KEYS.DAILY_TEXTS);
  return map?.[date] ?? null;
}

// -----------------------------------------------------------
// Ministry Contacts
// -----------------------------------------------------------

export async function saveContact(contact: MinistryContact): Promise<void> {
  const contacts = await loadContacts();
  const idx = contacts.findIndex((c) => c.id === contact.id);
  if (idx >= 0) {
    contacts[idx] = contact;
  } else {
    contacts.push(contact);
  }
  await setJSON(KEYS.CONTACTS, contacts);
}

export async function loadContacts(): Promise<MinistryContact[]> {
  return (await getJSON<MinistryContact[]>(KEYS.CONTACTS)) ?? [];
}

export async function deleteContact(id: string): Promise<void> {
  const contacts = await loadContacts();
  await setJSON(
    KEYS.CONTACTS,
    contacts.filter((c) => c.id !== id)
  );
}

// -----------------------------------------------------------
// Meeting Weeks  (stored as a map: { "year-week": MeetingWeek })
// -----------------------------------------------------------

export async function saveMeetingWeek(week: MeetingWeek): Promise<void> {
  const map = (await getJSON<Record<string, MeetingWeek>>(KEYS.MEETING_WEEKS)) ?? {};
  const key = `${week.year}-${week.week}`;
  map[key] = week;
  await setJSON(KEYS.MEETING_WEEKS, map);
}

export async function loadMeetingWeek(
  year: number,
  week: number
): Promise<MeetingWeek | null> {
  const map = await getJSON<Record<string, MeetingWeek>>(KEYS.MEETING_WEEKS);
  return map?.[`${year}-${week}`] ?? null;
}

// -----------------------------------------------------------
// Saved Sources
// -----------------------------------------------------------

export async function saveSource(source: SavedSource): Promise<void> {
  const sources = await loadSavedSources();
  const idx = sources.findIndex((s) => s.id === source.id);
  if (idx >= 0) {
    sources[idx] = source;
  } else {
    sources.push(source);
  }
  await setJSON(KEYS.SAVED_SOURCES, sources);
}

export async function loadSavedSources(): Promise<SavedSource[]> {
  return (await getJSON<SavedSource[]>(KEYS.SAVED_SOURCES)) ?? [];
}

export async function deleteSource(id: string): Promise<void> {
  const sources = await loadSavedSources();
  await setJSON(
    KEYS.SAVED_SOURCES,
    sources.filter((s) => s.id !== id)
  );
}

// -----------------------------------------------------------
// Study Plans
// -----------------------------------------------------------

export async function saveStudyPlan(plan: PersonalStudyPlan): Promise<void> {
  const plans = await loadStudyPlans();
  const idx = plans.findIndex((p) => p.id === plan.id);
  if (idx >= 0) {
    plans[idx] = plan;
  } else {
    plans.push(plan);
  }
  await setJSON(KEYS.STUDY_PLANS, plans);
}

export async function loadStudyPlans(): Promise<PersonalStudyPlan[]> {
  return (await getJSON<PersonalStudyPlan[]>(KEYS.STUDY_PLANS)) ?? [];
}

// -----------------------------------------------------------
// Onboarding
// -----------------------------------------------------------

export async function saveOnboardingComplete(v: boolean): Promise<void> {
  await AsyncStorage.setItem(KEYS.ONBOARDING_COMPLETE, JSON.stringify(v));
}

export async function loadOnboardingComplete(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.ONBOARDING_COMPLETE);
    if (raw === null) return false;
    return JSON.parse(raw) as boolean;
  } catch {
    return false;
  }
}

// -----------------------------------------------------------
// Reminders
// -----------------------------------------------------------

export async function saveReminders(reminders: Reminder[]): Promise<void> {
  await setJSON(KEYS.REMINDERS, reminders);
}

export async function loadReminders(): Promise<Reminder[]> {
  return (await getJSON<Reminder[]>(KEYS.REMINDERS)) ?? [];
}

// -----------------------------------------------------------
// Utility: clear all JW SA data (for dev/reset)
// -----------------------------------------------------------
export async function clearAllData(): Promise<void> {
  await AsyncStorage.multiRemove(Object.values(KEYS));
}

// -----------------------------------------------------------
// Default export (named functions bundled)
// -----------------------------------------------------------
export default {
  saveUserProfile,
  loadUserProfile,
  saveLanguage,
  loadLanguage,
  saveDailyText,
  loadDailyText,
  saveContact,
  loadContacts,
  deleteContact,
  saveMeetingWeek,
  loadMeetingWeek,
  saveSource,
  loadSavedSources,
  deleteSource,
  saveStudyPlan,
  loadStudyPlans,
  saveOnboardingComplete,
  loadOnboardingComplete,
  saveReminders,
  loadReminders,
  clearAllData,
};
