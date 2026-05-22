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
import { clearAllData } from '@/services/storageService';
import { getLanguages } from '@/services/languageService';
import { createTranslator, DISPLAY_LANGUAGES, saveLanguagePair } from '@/services/i18nService';
import type { Language } from '@/types';
import { usePremiumTheme } from '@/hooks/usePremiumTheme';
import { AppScreen, AppHeader, PremiumCard, SectionHeader, ThemeToggle } from '@/components/premium';

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
  return <SectionHeader title={label} />;
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
  const colors = usePremiumTheme();
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
        <SizableText size="$4" color={destructive ? colors.rose : colors.text} fontWeight="700" flex={1}>
          {label}
        </SizableText>
        {value ? <SizableText size="$3" color={colors.textMuted}>{value}</SizableText> : null}
        <ChevronRight size={16} color={destructive ? colors.rose : colors.textMuted} />
      </XStack>
      {!last && <Separator borderColor={colors.border} marginLeft={56} />}
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
  const colors = usePremiumTheme();
  return (
    <YStack>
      <XStack paddingHorizontal="$4" paddingVertical="$3" alignItems="center" gap="$3">
        <YStack width={28} alignItems="center">{icon}</YStack>
        <YStack flex={1} gap="$1">
          <SizableText size="$4" color={colors.text} fontWeight="700">{label}</SizableText>
          {subtitle ? <SizableText size="$2" color={colors.textMuted}>{subtitle}</SizableText> : null}
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
  return <PremiumCard padded={false}>{children}</PremiumCard>;
}

// ── Language Picker Sheet ─────────────────────────────────────
interface LanguagePickerProps {
  open: boolean;
  onClose: () => void;
  currentCode: string;
  onSelect: (lang: Language) => void;
  title: string;
  placeholder: string;
  emptyText: string;
  fixedLanguages?: Language[];
}
function LanguagePicker({ open, onClose, currentCode, onSelect, title, placeholder, emptyText, fixedLanguages }: LanguagePickerProps) {
  const colors = usePremiumTheme();
  const [languages, setLanguages] = useState<Language[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    if (fixedLanguages) {
      setLanguages(fixedLanguages);
      setLoading(false);
      return;
    }
    getLanguages()
      .then(setLanguages)
      .catch(() => setLanguages([]))
      .finally(() => setLoading(false));
  }, [open, fixedLanguages]);

  const filtered = languages.filter((l) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return l.englishName.toLowerCase().includes(q) || l.name.toLowerCase().includes(q);
  });

  return (
    <Sheet
      open={open}
      onOpenChange={(v: boolean) => { if (!v) onClose(); }}
      snapPoints={[85]}
      modal
      dismissOnSnapToBottom
    >
      <Sheet.Overlay backgroundColor={colors.mode === 'dark' ? 'rgba(0,0,0,0.45)' : 'rgba(24,33,47,0.18)'} />
      <Sheet.Frame backgroundColor={colors.surface} borderTopLeftRadius="$8" borderTopRightRadius="$8">
        <Sheet.Handle backgroundColor={colors.borderStrong} />
        <YStack flex={1} padding="$4" gap="$3">
          <SizableText size="$6" color={colors.text} fontWeight="900">{title}</SizableText>
          <Input
            placeholder={placeholder}
            value={search}
            onChangeText={setSearch}
            backgroundColor={colors.surface2}
            borderColor={colors.border}
            color={colors.text}
            placeholderTextColor={colors.textMuted}
            borderRadius="$4"
            height={42}
            autoFocus={Platform.OS !== 'web'}
          />
          {loading ? (
            <YStack flex={1} justifyContent="center" alignItems="center" paddingTop="$8">
              <Spinner size="large" color={colors.primary} />
            </YStack>
          ) : (
            <ScrollView flex={1} showsVerticalScrollIndicator={false}>
              <YStack gap="$1">
                {filtered.map((lang) => {
                  const isSelected = lang.code === currentCode;
                  return (
                    <XStack
                      key={lang.code}
                      backgroundColor={isSelected ? colors.glow : 'transparent'}
                      borderRadius="$3"
                      paddingHorizontal="$3"
                      paddingVertical="$3"
                      alignItems="center"
                      gap="$3"
                      pressStyle={{ opacity: 0.7, backgroundColor: colors.glow }}
                      onPress={() => { onSelect(lang); onClose(); }}
                    >
                      <YStack flex={1} gap="$1">
                        <SizableText size="$4" color={isSelected ? colors.primary : colors.text} fontWeight={isSelected ? '900' : '600'}>
                          {lang.name}
                        </SizableText>
                        {lang.name !== lang.englishName && (
                          <SizableText size="$2" color={colors.textMuted}>{lang.englishName}</SizableText>
                        )}
                      </YStack>
                      {isSelected && <Check size={18} color={colors.primary} />}
                    </XStack>
                  );
                })}
                {filtered.length === 0 && (
                  <SizableText color={colors.textMuted} textAlign="center" paddingTop="$6">
                    {emptyText}
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
function DisclaimerSheet({ open, onClose, t }: DisclaimerSheetProps & { t: ReturnType<typeof createTranslator> }) {
  const colors = usePremiumTheme();
  return (
    <Sheet
      open={open}
      onOpenChange={(v: boolean) => { if (!v) onClose(); }}
      snapPoints={[60]}
      modal
      dismissOnSnapToBottom
    >
      <Sheet.Overlay backgroundColor={colors.mode === 'dark' ? 'rgba(0,0,0,0.45)' : 'rgba(24,33,47,0.18)'} />
      <Sheet.Frame backgroundColor={colors.surface} borderTopLeftRadius="$8" borderTopRightRadius="$8">
        <Sheet.Handle backgroundColor={colors.borderStrong} />
        <YStack flex={1} padding="$5" gap="$4">
          <XStack gap="$3" alignItems="center">
            <Info size={22} color={colors.primary} />
            <SizableText size="$6" color={colors.text} fontWeight="900">{t('about_app')}</SizableText>
          </XStack>
          <YStack
            backgroundColor={colors.surface2}
            borderRadius="$6"
            padding="$4"
            borderWidth={1}
            borderColor={colors.border}
          >
            <SizableText size="$3" color={colors.textSoft} lineHeight={22}>
              {t('disclaimer_full')}
            </SizableText>
          </YStack>
          <XStack gap="$3">
            <Button
              flex={1}
              backgroundColor={colors.glow}
              borderColor={colors.borderStrong}
              borderWidth={1}
              color={colors.primary}
              icon={<ExternalLink size={14} color={colors.primary} />}
              onPress={() => Linking.openURL('https://www.jw.org').catch(() => {})}
            >
              JW.org
            </Button>
            <Button
              flex={1}
              backgroundColor={colors.glowBlue}
              borderColor={colors.borderStrong}
              borderWidth={1}
              color={colors.accent}
              icon={<ExternalLink size={14} color={colors.accent} />}
              onPress={() => Linking.openURL('https://wol.jw.org').catch(() => {})}
            >
              WOL
            </Button>
          </XStack>
          <Button
            onPress={onClose}
            backgroundColor={colors.surface2}
            borderColor={colors.border}
            borderWidth={1}
            color={colors.textMuted}
          >
            {t('close')}
          </Button>
        </YStack>
      </Sheet.Frame>
    </Sheet>
  );
}

// ── Main Screen ───────────────────────────────────────────────
export default function SettingsScreen() {
  const router = useRouter();
  const colors = usePremiumTheme();
  const language = useAppStore((s) => s.language);
  const setLanguage = useAppStore((s) => s.setLanguage);
  const appLanguage = useAppStore((s) => s.appLanguage);
  const setAppLanguage = useAppStore((s) => s.setAppLanguage);
  const contentLanguage = useAppStore((s) => s.contentLanguage);
  const setContentLanguage = useAppStore((s) => s.setContentLanguage);
  const userProfile = useAppStore((s) => s.userProfile);
  const appTheme = useAppStore((s) => s.theme);
  const setAppTheme = useAppStore((s) => s.setTheme);
  const displaySymbol = appLanguage?.symbol || language?.symbol || 'en';
  const t = createTranslator(displaySymbol);

  const [notifications, setNotifications] = useState<NotificationsConfig>(DEFAULT_NOTIFICATIONS);
  const [theme, setTheme] = useState<'dark' | 'light' | 'system'>(appTheme);
  const [displayLangPickerOpen, setDisplayLangPickerOpen] = useState(false);
  const [contentLangPickerOpen, setContentLangPickerOpen] = useState(false);
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
      if (raw === 'light' || raw === 'dark' || raw === 'system') {
        setTheme(raw);
        setAppTheme(raw);
      }
    });
  }, [setAppTheme]);

  const saveNotifications = useCallback(async (config: NotificationsConfig) => {
    await AsyncStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(config));
  }, []);

  const updateNotification = (key: keyof NotificationsConfig, value: boolean | string) => {
    const updated = { ...notifications, [key]: value };
    setNotifications(updated);
    saveNotifications(updated);
  };

  const handleSelectDisplayLanguage = async (lang: Language) => {
    setAppLanguage(lang);
    const currentContent = contentLanguage ?? language ?? lang;
    await saveLanguagePair(lang, currentContent);
    toast(t('language_updated'), { message: t('switched_to_language', { language: lang.name }), variant: 'success' });
  };

  const handleSelectContentLanguage = async (lang: Language) => {
    setContentLanguage(lang);
    setLanguage(lang);
    const currentDisplay = appLanguage ?? DISPLAY_LANGUAGES[0];
    await saveLanguagePair(currentDisplay, lang);
    await AsyncStorage.setItem(STORAGE_KEYS.LANGUAGE, JSON.stringify(lang));
    toast(t('content_language_updated'), { message: t('switched_to_language', { language: lang.englishName }), variant: 'success' });
  };

  const handleTheme = async (nextTheme: 'dark' | 'light' | 'system') => {
    setTheme(nextTheme);
    setAppTheme(nextTheme);
    await AsyncStorage.setItem(STORAGE_KEYS.THEME, nextTheme);
    toast(t('theme_updated'), { variant: 'success' });
  };

  const handleClearAllData = async () => {
    setIsSaving(true);
    try {
      await clearAllData();
      toast(t('data_cleared'), { message: t('all_local_data_removed'), variant: 'success' });
    } catch {
      toast(t('failed_clear_data'), { variant: 'error' });
    } finally {
      setIsSaving(false);
      setClearConfirmOpen(false);
    }
  };

  const spiritualLabel: Record<string, string> = {
    publisher: t('publisher'),
    baptized: t('baptized_publisher'),
    pioneer: t('pioneer'),
    elder: t('elder'),
    ms: t('ministerial_servant'),
    'bible-student': t('bible_student'),
    other: t('interested_person'),
  };

  const themeLabel = { dark: t('dark'), light: t('light'), system: t('system') };

  return (
    <AppScreen scroll>
          {/* Header */}
          <AppHeader title={t('settings')} subtitle={`${t('language_content')} · ${t('appearance')} · ${t('data')}`} />

          {/* ── 1. Language & Content ── */}
          <YStack gap="$2">
            <SectionLabel label={t('language_content')} />
            <SettingsCard>
              <NavRow
                icon={<Globe size={18} color="#5B7E6B" />}
                label={t('display_language')}
                value={appLanguage?.name ?? 'English'}
                onPress={() => setDisplayLangPickerOpen(true)}
              />
              <NavRow
                icon={<Globe size={18} color="#5A7B9E" />}
                label={t('content_language')}
                value={contentLanguage?.englishName ?? language?.englishName ?? 'English'}
                onPress={() => setContentLangPickerOpen(true)}
                last
              />
            </SettingsCard>
          </YStack>

          {/* ── 2. Spiritual Profile ── */}
          <YStack gap="$2">
            <SectionLabel label={t('spiritual_profile')} />
            <SettingsCard>
              <NavRow
                icon={<User size={18} color="#7B6B9E" />}
                label={t('edit_profile')}
                value={userProfile ? spiritualLabel[userProfile.spiritualStatus] ?? '' : t('not_set')}
                onPress={() => router.push('/edit-profile')}
                last
              />
            </SettingsCard>
          </YStack>

          {/* ── 3. Notifications ── */}
          <YStack gap="$2">
            <SectionLabel label={t('notifications')} />
            <SettingsCard>
              <ToggleRow
                icon={<Bell size={18} color="#F59E0B" />}
                label={t('daily_text_reminder')}
                subtitle={notifications.dailyText ? t('reminds_at_time', { time: notifications.dailyTextTime }) : t('off')}
                value={notifications.dailyText}
                onValueChange={(v) => updateNotification('dailyText', v)}
              />
              <ToggleRow
                icon={<BookOpen size={18} color="#5B7E6B" />}
                label={t('meeting_preparation')}
                subtitle={t('monday_reminder')}
                value={notifications.meetingPrep}
                onValueChange={(v) => updateNotification('meetingPrep', v)}
              />
              <ToggleRow
                icon={<BookOpen size={18} color="#7B6B9E" />}
                label={t('watchtower_study')}
                subtitle={t('friday_reminder')}
                value={notifications.watchtowerStudy}
                onValueChange={(v) => updateNotification('watchtowerStudy', v)}
              />
              <ToggleRow
                icon={<User size={18} color="#9E7B5A" />}
                label={t('return_visit_reminders')}
                value={notifications.returnVisits}
                onValueChange={(v) => updateNotification('returnVisits', v)}
                last
              />
            </SettingsCard>
          </YStack>

          {/* ── 4. Appearance ── */}
          <YStack gap="$2">
            <SectionLabel label={t('appearance')} />
            <SettingsCard>
              <YStack paddingHorizontal="$4" paddingVertical="$3" gap="$3">
                <XStack gap="$3" alignItems="center">
                  <Sun size={18} color="#F59E0B" />
                  <SizableText size="$4" color={colors.text} fontWeight="800" flex={1}>{t('theme')}</SizableText>
                </XStack>
                <ThemeToggle value={theme} onChange={handleTheme} />
              </YStack>
            </SettingsCard>
          </YStack>

          {/* ── 5. About & Disclaimer ── */}
          <YStack gap="$2">
            <SectionLabel label={t('about_disclaimer')} />
            <SettingsCard>
              <NavRow
                icon={<Info size={18} color="#9CA3AF" />}
                label={t('about_app')}
                onPress={() => setDisclaimerOpen(true)}
              />
              <YStack paddingHorizontal="$4" paddingVertical="$3" gap="$2">
                <SizableText size="$2" color="#6B7280">{t('app_version')}</SizableText>
                <SizableText size="$4" color="#9CA3AF">1.0.14</SizableText>
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
            <SectionLabel label={t('data')} />
            <SettingsCard>
              <NavRow
                icon={<ExternalLink size={18} color="#9CA3AF" />}
                label={t('export_data')}
                value={t('coming_soon')}
                onPress={() => toast(t('coming_soon'), { message: t('export_future_update'), variant: 'warning' })}
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
                      <SizableText size="$4" color="#EF4444" flex={1}>{t('clear_all_data')}</SizableText>
                      {isSaving
                        ? <Spinner size="small" color="#EF4444" />
                        : <ChevronRight size={16} color="#EF4444" />}
                    </XStack>
                  </YStack>
                }
                title={t('clear_all_data_question')}
                description={t('clear_all_data_description')}
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
              {t('short_disclaimer')}
            </SizableText>
          </YStack>
      {/* Language picker sheet */}
      <LanguagePicker
        open={displayLangPickerOpen}
        onClose={() => setDisplayLangPickerOpen(false)}
        currentCode={appLanguage?.code ?? 'E'}
        onSelect={handleSelectDisplayLanguage}
        title={t('select_display_language')}
        placeholder={t('search_languages')}
        emptyText={t('no_languages_found')}
        fixedLanguages={DISPLAY_LANGUAGES}
      />

      <LanguagePicker
        open={contentLangPickerOpen}
        onClose={() => setContentLangPickerOpen(false)}
        currentCode={contentLanguage?.code ?? language?.code ?? 'E'}
        onSelect={handleSelectContentLanguage}
        title={t('select_content_language')}
        placeholder={t('search_languages')}
        emptyText={t('no_languages_found')}
      />

      {/* Disclaimer sheet */}
      <DisclaimerSheet
        open={disclaimerOpen}
        onClose={() => setDisclaimerOpen(false)}
        t={t}
      />
    </AppScreen>
  );
}
