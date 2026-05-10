// ============================================================
// JW Study Assistant — Settings Screen
// ============================================================
import { useState, useEffect, useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Platform, Linking } from 'react-native';
import {
  YStack,
  XStack,
  SizableText,
  Card,
  Button,
  Input,
  ScrollView,
  Sheet,
  BlinkDialog,
  Switch,
  Spinner,
  Separator,
  toast,
  // Icons
  Globe,
  User,
  Bell,
  Sun,
  Info,
  ExternalLink,
  Trash2,
  Check,
  ChevronRight,
  BookOpen,
} from '@blinkdotnew/mobile-ui';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppStore } from '@/store/appStore';
import { useTheme as useCodexTheme } from '@/constants/theme';
import { clearAllData } from '@/services/storageService';
import { getLanguages } from '@/services/languageService';
import type { Language } from '@/types';

const STORAGE_KEYS = {
  LANGUAGE: 'jw_sa:language',
  NOTIFICATIONS: 'jw_sa:notifications',
  THEME: 'jw_sa:theme',
};

interface NotificationsConfig {
  dailyText: boolean;
  dailyTextTime: string;
  meetingPrep: boolean;
  watchtowerStudy: boolean;
  returnVisits: boolean;
}

const DEFAULT_NOTIFICATIONS: NotificationsConfig = {
  dailyText: true,
  dailyTextTime: '07:00',
  meetingPrep: true,
  watchtowerStudy: true,
  returnVisits: false,
};

// ── Section label ─────────────────────────────────────────────
function SectionLabel({ label }: { label: string }) {
  return (
    <SizableText
      size="$2"
      color="#9CA3AF"
      fontWeight="700"
      letterSpacing={1.5}
      paddingLeft="$2"
      paddingBottom="$1"
    >
      {label.toUpperCase()}
    </SizableText>
  );
}

// ── Row: nav arrow ────────────────────────────────────────────
interface NavRowProps {
  icon: React.ReactNode;
  label: string;
  value?: string;
  onPress: () => void;
  last?: boolean;
  destructive?: boolean;
}
function NavRow({ icon, label, value, onPress, last, destructive }: NavRowProps) {
  return (
    <YStack>
      <XStack
        paddingHorizontal="$4"
        paddingVertical="$3"
        alignItems="center"
        gap="$3"
        pressStyle={{ opacity: 0.7 }}
        onPress={onPress}
      >
        <YStack width={28} alignItems="center">{icon}</YStack>
        <SizableText size="$4" color={destructive ? '#EF4444' : '#F2F2F7'} flex={1}>
          {label}
        </SizableText>
        {value ? <SizableText size="$3" color="#6B7280">{value}</SizableText> : null}
        <ChevronRight size={16} color={destructive ? '#EF4444' : '#6B7280'} />
      </XStack>
      {!last && <Separator borderColor="#3A3A3C" marginLeft={56} />}
    </YStack>
  );
}

// ── Row: toggle ───────────────────────────────────────────────
interface ToggleRowProps {
  icon: React.ReactNode;
  label: string;
  subtitle?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  last?: boolean;
}
function ToggleRow({ icon, label, subtitle, value, onValueChange, last }: ToggleRowProps) {
  return (
    <YStack>
      <XStack paddingHorizontal="$4" paddingVertical="$3" alignItems="center" gap="$3">
        <YStack width={28} alignItems="center">{icon}</YStack>
        <YStack flex={1} gap="$1">
          <SizableText size="$4" color="#F2F2F7">{label}</SizableText>
          {subtitle ? <SizableText size="$2" color="#6B7280">{subtitle}</SizableText> : null}
        </YStack>
        <Switch
          checked={value}
          onCheckedChange={onValueChange}
          size="$3"
          backgroundColor={value ? '$green9' : '$color5'}
        >
          <Switch.Thumb animation="quick" />
        </Switch>
      </XStack>
      {!last && <Separator borderColor="#3A3A3C" marginLeft={56} />}
    </YStack>
  );
}

// ── SettingsCard ──────────────────────────────────────────────
function SettingsCard({ children }: { children: React.ReactNode }) {
  return (
    <Card
      backgroundColor="#2C2C2E"
      borderRadius="$4"
      borderWidth={1}
      borderColor="#3A3A3C"
      overflow="hidden"
    >
      {children}
    </Card>
  );
}

// ── Language Picker Sheet ─────────────────────────────────────
interface LanguagePickerProps {
  open: boolean;
  onClose: () => void;
  currentCode: string;
  onSelect: (lang: Language) => void;
}
function LanguagePicker({ open, onClose, currentCode, onSelect }: LanguagePickerProps) {
  const [languages, setLanguages] = useState<Language[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    getLanguages()
      .then(setLanguages)
      .catch(() => setLanguages([]))
      .finally(() => setLoading(false));
  }, [open]);

  const filtered = languages.filter((l) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return l.englishName.toLowerCase().includes(q) || l.name.toLowerCase().includes(q);
  });

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => { if (!v) onClose(); }}
      snapPoints={[85]}
      modal
      dismissOnSnapToBottom
    >
      <Sheet.Overlay />
      <Sheet.Frame backgroundColor="#1C1C1E" borderTopLeftRadius="$6" borderTopRightRadius="$6">
        <Sheet.Handle backgroundColor="#3A3A3C" />
        <YStack flex={1} padding="$4" gap="$3">
          <SizableText size="$6" color="#F2F2F7" fontWeight="700">Select Language</SizableText>
          <Input
            placeholder="Search languages…"
            value={search}
            onChangeText={setSearch}
            backgroundColor="#2C2C2E"
            borderColor="#3A3A3C"
            color="#F2F2F7"
            placeholderTextColor="#6B7280"
            borderRadius="$4"
            height={42}
            autoFocus={Platform.OS !== 'web'}
          />
          {loading ? (
            <YStack flex={1} justifyContent="center" alignItems="center" paddingTop="$8">
              <Spinner size="large" color="#5B7E6B" />
            </YStack>
          ) : (
            <ScrollView flex={1} showsVerticalScrollIndicator={false}>
              <YStack gap="$1">
                {filtered.map((lang) => {
                  const isSelected = lang.code === currentCode;
                  return (
                    <XStack
                      key={lang.code}
                      backgroundColor={isSelected ? 'rgba(91,126,107,0.15)' : 'transparent'}
                      borderRadius="$3"
                      paddingHorizontal="$3"
                      paddingVertical="$3"
                      alignItems="center"
                      gap="$3"
                      pressStyle={{ opacity: 0.7, backgroundColor: 'rgba(91,126,107,0.1)' }}
                      onPress={() => { onSelect(lang); onClose(); }}
                    >
                      <YStack flex={1} gap="$1">
                        <SizableText size="$4" color={isSelected ? '#5B7E6B' : '#F2F2F7'} fontWeight={isSelected ? '700' : '400'}>
                          {lang.name}
                        </SizableText>
                        {lang.name !== lang.englishName && (
                          <SizableText size="$2" color="#6B7280">{lang.englishName}</SizableText>
                        )}
                      </YStack>
                      {isSelected && <Check size={18} color="#5B7E6B" />}
                    </XStack>
                  );
                })}
                {filtered.length === 0 && (
                  <SizableText color="#6B7280" textAlign="center" paddingTop="$6">
                    No languages found
                  </SizableText>
                )}
              </YStack>
            </ScrollView>
          )}
        </YStack>
      </Sheet.Frame>
    </Sheet>
  );
}

// ── Disclaimer Sheet ──────────────────────────────────────────
interface DisclaimerSheetProps {
  open: boolean;
  onClose: () => void;
}
function DisclaimerSheet({ open, onClose }: DisclaimerSheetProps) {
  return (
    <Sheet
      open={open}
      onOpenChange={(v) => { if (!v) onClose(); }}
      snapPoints={[60]}
      modal
      dismissOnSnapToBottom
    >
      <Sheet.Overlay />
      <Sheet.Frame backgroundColor="#1C1C1E" borderTopLeftRadius="$6" borderTopRightRadius="$6">
        <Sheet.Handle backgroundColor="#3A3A3C" />
        <YStack flex={1} padding="$5" gap="$4">
          <XStack gap="$3" alignItems="center">
            <Info size={22} color="#5B7E6B" />
            <SizableText size="$6" color="#F2F2F7" fontWeight="700">About JW Study Assistant</SizableText>
          </XStack>
          <YStack
            backgroundColor="#2C2C2E"
            borderRadius="$4"
            padding="$4"
            borderWidth={1}
            borderColor="#3A3A3C"
          >
            <SizableText size="$3" color="#D1D5DB" lineHeight={22}>
              This app is not affiliated with or endorsed by Jehovah's Witnesses, JW.org, JW Library, or Watch Tower Bible and Tract Society.{'\n\n'}
              It only helps users organize their personal study using publicly available JW.org/WOL content.{'\n\n'}
              All scripture, article, and publication content is sourced directly from JW.org and Watchtower Online Library (WOL) and belongs to their respective copyright holders.
            </SizableText>
          </YStack>
          <XStack gap="$3">
            <Button
              flex={1}
              backgroundColor="rgba(91,126,107,0.15)"
              borderColor="rgba(91,126,107,0.3)"
              borderWidth={1}
              color="#5B7E6B"
              icon={<ExternalLink size={14} color="#5B7E6B" />}
              onPress={() => Linking.openURL('https://www.jw.org').catch(() => {})}
            >
              JW.org
            </Button>
            <Button
              flex={1}
              backgroundColor="rgba(90,123,158,0.15)"
              borderColor="rgba(90,123,158,0.3)"
              borderWidth={1}
              color="#5A7B9E"
              icon={<ExternalLink size={14} color="#5A7B9E" />}
              onPress={() => Linking.openURL('https://wol.jw.org').catch(() => {})}
            >
              WOL
            </Button>
          </XStack>
          <Button
            onPress={onClose}
            backgroundColor="#2C2C2E"
            borderColor="#3A3A3C"
            borderWidth={1}
            color="#9CA3AF"
          >
            Close
          </Button>
        </YStack>
      </Sheet.Frame>
    </Sheet>
  );
}

// ── Main Screen ───────────────────────────────────────────────
export default function SettingsScreen() {
  const router = useRouter();
  const language = useAppStore((s) => s.language);
  const setLanguage = useAppStore((s) => s.setLanguage);
  const userProfile = useAppStore((s) => s.userProfile);
  const codexTheme = useCodexTheme();

  const [notifications, setNotifications] = useState<NotificationsConfig>(DEFAULT_NOTIFICATIONS);
  const [theme, setTheme] = useState<'dark' | 'light' | 'system'>('dark');
  const [langPickerOpen, setLangPickerOpen] = useState(false);
  const [disclaimerOpen, setDisclaimerOpen] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Load preferences
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEYS.NOTIFICATIONS).then((raw) => {
      if (raw) {
        try { setNotifications(JSON.parse(raw) as NotificationsConfig); } catch { /* use defaults */ }
      }
    });
    AsyncStorage.getItem(STORAGE_KEYS.THEME).then((raw) => {
      if (raw === 'light' || raw === 'dark' || raw === 'system') setTheme(raw);
    });
  }, []);

  const saveNotifications = useCallback(async (config: NotificationsConfig) => {
    await AsyncStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(config));
  }, []);

  const updateNotification = (key: keyof NotificationsConfig, value: boolean | string) => {
    const updated = { ...notifications, [key]: value };
    setNotifications(updated);
    saveNotifications(updated);
  };

  const handleSelectLanguage = async (lang: Language) => {
    setLanguage(lang);
    await AsyncStorage.setItem(STORAGE_KEYS.LANGUAGE, JSON.stringify(lang));
    toast('Language updated', { message: `Switched to ${lang.englishName}`, variant: 'success' });
  };

  const handleTheme = async (t: 'dark' | 'light' | 'system') => {
    setTheme(t);
    await AsyncStorage.setItem(STORAGE_KEYS.THEME, t);
    if (t === 'light' || t === 'dark') codexTheme.setMode(t);
    toast('Theme updated', { variant: 'success' });
  };

  const handleClearAllData = async () => {
    setIsSaving(true);
    try {
      await clearAllData();
      toast('Data cleared', { message: 'All local data has been removed.', variant: 'success' });
    } catch {
      toast('Failed to clear data', { variant: 'error' });
    } finally {
      setIsSaving(false);
      setClearConfirmOpen(false);
    }
  };

  const spiritualLabel: Record<string, string> = {
    publisher: 'Publisher',
    baptized: 'Baptized Publisher',
    pioneer: 'Pioneer',
    elder: 'Elder',
    ms: 'Ministerial Servant',
    'bible-student': 'Bible Student',
    other: 'Interested Person',
  };

  const themeLabel = { dark: 'Dark', light: 'Light', system: 'System' };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: codexTheme.t.bg }} testID="settings-screen">
      <ScrollView flex={1} showsVerticalScrollIndicator={false}>
        <YStack padding="$5" gap="$5" paddingBottom="$10">
          {/* Header */}
          <SizableText size="$8" color="#F2F2F7" fontWeight="800">Settings</SizableText>

          {/* ── 1. Language & Content ── */}
          <YStack gap="$2">
            <SectionLabel label="Language & Content" />
            <SettingsCard>
              <NavRow
                icon={<Globe size={18} color="#5B7E6B" />}
                label="Display Language"
                value={language?.englishName ?? 'English'}
                onPress={() => setLangPickerOpen(true)}
              />
              <NavRow
                icon={<Globe size={18} color="#5A7B9E" />}
                label="Content Language"
                value={language?.englishName ?? 'English'}
                onPress={() => setLangPickerOpen(true)}
                last
              />
            </SettingsCard>
          </YStack>

          {/* ── 2. Spiritual Profile ── */}
          <YStack gap="$2">
            <SectionLabel label="Spiritual Profile" />
            <SettingsCard>
              <NavRow
                icon={<User size={18} color="#7B6B9E" />}
                label="Edit Profile"
                value={userProfile ? spiritualLabel[userProfile.spiritualStatus] ?? '' : 'Not set'}
                onPress={() => router.push('/edit-profile')}
                last
              />
            </SettingsCard>
          </YStack>

          {/* ── 3. Notifications ── */}
          <YStack gap="$2">
            <SectionLabel label="Notifications" />
            <SettingsCard>
              <ToggleRow
                icon={<Bell size={18} color="#F59E0B" />}
                label="Daily Text Reminder"
                subtitle={notifications.dailyText ? `Reminds at ${notifications.dailyTextTime}` : 'Off'}
                value={notifications.dailyText}
                onValueChange={(v) => updateNotification('dailyText', v)}
              />
              <ToggleRow
                icon={<BookOpen size={18} color="#5B7E6B" />}
                label="Meeting Preparation"
                subtitle="Monday reminder"
                value={notifications.meetingPrep}
                onValueChange={(v) => updateNotification('meetingPrep', v)}
              />
              <ToggleRow
                icon={<BookOpen size={18} color="#7B6B9E" />}
                label="Watchtower Study"
                subtitle="Friday reminder"
                value={notifications.watchtowerStudy}
                onValueChange={(v) => updateNotification('watchtowerStudy', v)}
              />
              <ToggleRow
                icon={<User size={18} color="#9E7B5A" />}
                label="Return Visit Reminders"
                value={notifications.returnVisits}
                onValueChange={(v) => updateNotification('returnVisits', v)}
                last
              />
            </SettingsCard>
          </YStack>

          {/* ── 4. Appearance ── */}
          <YStack gap="$2">
            <SectionLabel label="Appearance" />
            <SettingsCard>
              <YStack paddingHorizontal="$4" paddingVertical="$3" gap="$3">
                <XStack gap="$3" alignItems="center">
                  <Sun size={18} color="#F59E0B" />
                  <SizableText size="$4" color="#F2F2F7" flex={1}>Theme</SizableText>
                </XStack>
                <XStack gap="$2">
                  {(['dark', 'light', 'system'] as const).map((t) => (
                    <YStack
                      key={t}
                      flex={1}
                      backgroundColor={theme === t ? '#5B7E6B' : '#1C1C1E'}
                      borderRadius="$3"
                      padding="$2"
                      alignItems="center"
                      borderWidth={1}
                      borderColor={theme === t ? '#5B7E6B' : '#3A3A3C'}
                      pressStyle={{ opacity: 0.75 }}
                      onPress={() => handleTheme(t)}
                    >
                      <SizableText
                        size="$3"
                        color={theme === t ? 'white' : '#9CA3AF'}
                        fontWeight={theme === t ? '700' : '400'}
                      >
                        {themeLabel[t]}
                      </SizableText>
                    </YStack>
                  ))}
                </XStack>
              </YStack>
            </SettingsCard>
          </YStack>

          {/* ── 5. About & Disclaimer ── */}
          <YStack gap="$2">
            <SectionLabel label="About & Disclaimer" />
            <SettingsCard>
              <NavRow
                icon={<Info size={18} color="#9CA3AF" />}
                label="About JW Study Assistant"
                onPress={() => setDisclaimerOpen(true)}
              />
              <YStack paddingHorizontal="$4" paddingVertical="$3" gap="$2">
                <SizableText size="$2" color="#6B7280">App Version</SizableText>
                <SizableText size="$4" color="#9CA3AF">1.0.0</SizableText>
              </YStack>
              <Separator borderColor="#3A3A3C" />
              <XStack paddingHorizontal="$4" paddingVertical="$3" gap="$2">
                <Button
                  flex={1}
                  size="$3"
                  backgroundColor="rgba(91,126,107,0.1)"
                  borderColor="rgba(91,126,107,0.25)"
                  borderWidth={1}
                  color="#5B7E6B"
                  icon={<ExternalLink size={13} color="#5B7E6B" />}
                  onPress={() => Linking.openURL('https://www.jw.org').catch(() => {})}
                >
                  JW.org
                </Button>
                <Button
                  flex={1}
                  size="$3"
                  backgroundColor="rgba(90,123,158,0.1)"
                  borderColor="rgba(90,123,158,0.25)"
                  borderWidth={1}
                  color="#5A7B9E"
                  icon={<ExternalLink size={13} color="#5A7B9E" />}
                  onPress={() => Linking.openURL('https://wol.jw.org').catch(() => {})}
                >
                  WOL
                </Button>
              </XStack>
            </SettingsCard>
          </YStack>

          {/* ── 6. Data ── */}
          <YStack gap="$2">
            <SectionLabel label="Data" />
            <SettingsCard>
              <NavRow
                icon={<ExternalLink size={18} color="#9CA3AF" />}
                label="Export Data"
                value="Coming soon"
                onPress={() => toast('Coming soon', { message: 'Export will be available in a future update.', variant: 'warning' })}
              />
              <BlinkDialog
                trigger={
                  <YStack>
                    <XStack
                      paddingHorizontal="$4"
                      paddingVertical="$3"
                      alignItems="center"
                      gap="$3"
                      pressStyle={{ opacity: 0.7 }}
                    >
                      <YStack width={28} alignItems="center">
                        <Trash2 size={18} color="#EF4444" />
                      </YStack>
                      <SizableText size="$4" color="#EF4444" flex={1}>Clear All Data</SizableText>
                      {isSaving
                        ? <Spinner size="small" color="#EF4444" />
                        : <ChevronRight size={16} color="#EF4444" />}
                    </XStack>
                  </YStack>
                }
                title="Clear all data?"
                description="This will permanently delete all your saved items, profile, meeting notes, and study plans. This cannot be undone."
                onConfirm={handleClearAllData}
                onCancel={() => setClearConfirmOpen(false)}
                open={clearConfirmOpen}
                onOpenChange={setClearConfirmOpen}
              />
            </SettingsCard>
          </YStack>

          {/* Footer */}
          <YStack alignItems="center" paddingTop="$4" gap="$1">
            <SizableText size="$3" color="#4B5563">JW Study Assistant</SizableText>
            <SizableText size="$2" color="#374151" textAlign="center" maxWidth={280}>
              Not affiliated with or endorsed by Jehovah's Witnesses, JW.org, or Watch Tower Society
            </SizableText>
          </YStack>
        </YStack>
      </ScrollView>

      {/* Language picker sheet */}
      <LanguagePicker
        open={langPickerOpen}
        onClose={() => setLangPickerOpen(false)}
        currentCode={language?.code ?? 'E'}
        onSelect={handleSelectLanguage}
      />

      {/* Disclaimer sheet */}
      <DisclaimerSheet
        open={disclaimerOpen}
        onClose={() => setDisclaimerOpen(false)}
      />
    </SafeAreaView>
  );
}
