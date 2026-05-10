import { useState, useEffect, useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  YStack, XStack, ScrollView, SizableText, Card, Input, Spinner, Separator,
} from '@blinkdotnew/mobile-ui';
import {
  BookOpen, Search, Users, ChevronRight, Globe, Zap, AlertTriangle,
  RefreshCw, Sun, Moon, ArrowUpRight,
} from '@blinkdotnew/mobile-ui';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TouchableOpacity, Platform } from 'react-native';
import { useTheme, fonts } from '@/constants/theme';

interface DailyText { date: string; scripture: string; comment: string; fullUrl?: string; }
interface Contact   { id: string; name: string; address?: string; nextVisit?: string; notes?: string; }

const LANG_CONFIG: Record<string, { region: string; param: string }> = {
  en: { region: 'r1',  param: 'lp-e' },
  fr: { region: 'r30', param: 'lp-f' },
  es: { region: 'r4',  param: 'lp-s' },
  de: { region: 'r10', param: 'lp-g' },
  pt: { region: 'r5',  param: 'lp-p' },
  it: { region: 'r6',  param: 'lp-i' },
};

function fmtLong(d: Date) {
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}
function fmtShort(d: Date) {
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}
function getMidweekDate(): string {
  const d = new Date(); const day = d.getDay();
  const diff = day <= 2 ? 2 - day : 9 - day; d.setDate(d.getDate() + diff);
  return fmtShort(d);
}
function getWeekendDate(): string {
  const d = new Date(); const day = d.getDay();
  const diff = day === 0 ? 6 : 6 - day; d.setDate(d.getDate() + diff);
  return fmtShort(d);
}

async function fetchDailyText(lang: string): Promise<DailyText | null> {
  const cfg = LANG_CONFIG[lang] ?? LANG_CONFIG['en'];
  const now = new Date();
  const url = `https://wol.jw.org/${lang}/wol/dt/${cfg.region}/${cfg.param}/${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()}`;
  const res = await fetch(url, { headers: { Accept: 'text/html' } });
  if (!res.ok) throw new Error('nope');
  const html = await res.text();
  const scrMatch = html.match(/<p[^>]*class="[^"]*themeScrp[^"]*"[^>]*>([\s\S]*?)<\/p>/i);
  const scripture = scrMatch ? scrMatch[1].replace(/<[^>]+>/g, '').replace(/&[a-z]+;/g, ' ').trim() : '';
  const bodyMatch = html.match(/<div[^>]*class="[^"]*body[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
  const comment = bodyMatch ? bodyMatch[1].replace(/<[^>]+>/g, '').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim() : '';
  if (!scripture && !comment) return null;
  return { date: fmtLong(now), scripture, comment, fullUrl: url };
}

export default function HomeScreen() {
  const router = useRouter();
  const { t, mode, toggle } = useTheme();

  const [language, setLanguage] = useState('en');
  const [dailyText, setDailyText] = useState<DailyText | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loadingText, setLoadingText] = useState(true);
  const [textError, setTextError] = useState(false);
  const [aiQuery, setAiQuery] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    AsyncStorage.getItem('selected_language').then((val) => {
      if (val) {
        try {
          const p = JSON.parse(val);
          if (p && typeof p === 'object') setLanguage(p.symbol || p.langCode?.toLowerCase() || 'en');
          else setLanguage(String(val).toLowerCase());
        } catch { setLanguage(val.toLowerCase()); }
      }
    });
  }, []);

  useEffect(() => {
    AsyncStorage.getItem('jw_sa:contacts').then((raw) => { if (raw) setContacts(JSON.parse(raw)); }).catch(() => {});
  }, []);

  const loadDailyText = useCallback(async () => {
    setLoadingText(true); setTextError(false);
    const today = new Date().toISOString().slice(0, 10);
    const cacheKey = `daily_text_${today}`;
    try {
      const cached = await AsyncStorage.getItem(cacheKey);
      if (cached) { setDailyText(JSON.parse(cached)); setLoadingText(false); return; }
      const data = await fetchDailyText(language);
      if (data) { setDailyText(data); await AsyncStorage.setItem(cacheKey, JSON.stringify(data)); }
      else setTextError(true);
    } catch { setTextError(true); } finally { setLoadingText(false); }
  }, [language, retry]);

  useEffect(() => { loadDailyText(); }, [loadDailyText]);

  const now = new Date();
  const greeting = now.getHours() < 5 ? 'Late hours' : now.getHours() < 12 ? 'Good morning' : now.getHours() < 17 ? 'Good afternoon' : 'Good evening';
  const dayNum = now.getDate();
  const monthAbbr = now.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
  const weekdayAbbr = now.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} testID="home-screen">
      <ScrollView flex={1} showsVerticalScrollIndicator={false} backgroundColor={t.bg}>
        <YStack paddingHorizontal="$5" paddingTop="$3" paddingBottom="$8" gap="$5">

          {/* ═══ MASTHEAD ═══ */}
          <YStack gap="$2" paddingTop="$1">
            <XStack justifyContent="space-between" alignItems="center">
              <XStack alignItems="center" gap="$3">
                <YStack
                  width={2} height={28} backgroundColor={t.copper}
                />
                <YStack>
                  <SizableText style={{ fontFamily: fonts.mono, fontSize: 9, letterSpacing: 2, color: t.inkSubtle }}>
                    JW · CODEX · VOL. I
                  </SizableText>
                  <SizableText style={{ fontFamily: fonts.display, fontSize: 18, fontWeight: '600', color: t.ink, letterSpacing: -0.3 }}>
                    Study Assistant
                  </SizableText>
                </YStack>
              </XStack>

              <XStack gap="$2" alignItems="center">
                <TouchableOpacity
                  data-testid="theme-toggle-btn"
                  onPress={toggle}
                  activeOpacity={0.7}
                  style={{
                    width: 36, height: 36, borderRadius: 18,
                    borderWidth: 1, borderColor: t.border, backgroundColor: t.surface,
                    justifyContent: 'center', alignItems: 'center',
                  }}
                >
                  {mode === 'dark' ? <Sun size={15} color={t.copper} /> : <Moon size={15} color={t.moss} />}
                </TouchableOpacity>
                <TouchableOpacity
                  data-testid="lang-btn"
                  onPress={() => router.push('/(tabs)/settings')}
                  activeOpacity={0.7}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 6,
                    backgroundColor: t.copperSoft, borderRadius: 18,
                    paddingHorizontal: 12, paddingVertical: 8,
                    borderWidth: 1, borderColor: t.copperBorder,
                  }}
                >
                  <Globe size={12} color={t.copper} />
                  <SizableText style={{ fontFamily: fonts.mono, fontSize: 11, color: t.copper, fontWeight: '700', letterSpacing: 1 }}>
                    {language.toUpperCase()}
                  </SizableText>
                </TouchableOpacity>
              </XStack>
            </XStack>
            <YStack height={1} backgroundColor={t.border} marginTop="$2" />
          </YStack>

          {/* ═══ EDITORIAL HERO ═══ */}
          <XStack justifyContent="space-between" alignItems="flex-end" paddingTop="$3">
            <YStack flex={1} gap="$1">
              <SizableText style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: 2, color: t.inkSubtle }}>
                {weekdayAbbr} · {monthAbbr} {dayNum}
              </SizableText>
              <SizableText style={{ fontFamily: fonts.display, fontSize: 44, lineHeight: 48, fontWeight: '500', color: t.ink, letterSpacing: -1.2, fontStyle: 'italic' }}>
                {greeting}.
              </SizableText>
              <SizableText style={{ fontFamily: fonts.body, fontSize: 14, color: t.inkMuted, marginTop: 4 }}>
                Today's word, your meetings, and the field at a glance.
              </SizableText>
            </YStack>
            <YStack alignItems="flex-end" paddingLeft="$3">
              <SizableText style={{ fontFamily: fonts.display, fontSize: 56, lineHeight: 56, fontWeight: '900', color: t.copper, letterSpacing: -3 }}>
                {dayNum}
              </SizableText>
              <SizableText style={{ fontFamily: fonts.mono, fontSize: 9, color: t.inkSubtle, letterSpacing: 1.5, marginTop: -4 }}>
                {monthAbbr}
              </SizableText>
            </YStack>
          </XStack>

          {/* ═══ DAILY TEXT — EDITORIAL BLOCKQUOTE ═══ */}
          <YStack gap="$2" marginTop="$3">
            <XStack alignItems="center" gap="$2">
              <YStack width={20} height={1} backgroundColor={t.copper} />
              <SizableText style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: 2, color: t.copper, fontWeight: '700' }}>
                I · DAILY TEXT
              </SizableText>
            </XStack>

            {loadingText ? (
              <Card backgroundColor={t.surface} borderRadius="$5" padding="$5" borderWidth={1} borderColor={t.border} gap="$3">
                <YStack height={12} width="40%" backgroundColor={t.border} borderRadius="$2" />
                <YStack height={20} width="92%" backgroundColor={t.border} borderRadius="$2" />
                <YStack height={14} width="70%" backgroundColor={t.border} borderRadius="$2" />
              </Card>
            ) : textError ? (
              <Card backgroundColor={t.surface} borderRadius="$5" padding="$5" borderWidth={1} borderColor={t.border} gap="$3">
                <XStack alignItems="center" gap="$2">
                  <AlertTriangle size={14} color={t.amber} />
                  <SizableText style={{ fontSize: 13, color: t.amber, fontFamily: fonts.body, fontWeight: '600' }}>
                    Could not load today's text
                  </SizableText>
                </XStack>
                <TouchableOpacity onPress={() => setRetry((c) => c + 1)} activeOpacity={0.7}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
                    backgroundColor: t.mossSoft, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8,
                    borderWidth: 1, borderColor: t.mossBorder,
                  }}
                >
                  <RefreshCw size={12} color={t.moss} />
                  <SizableText style={{ fontFamily: fonts.mono, fontSize: 11, color: t.moss, fontWeight: '700', letterSpacing: 1 }}>RETRY</SizableText>
                </TouchableOpacity>
              </Card>
            ) : dailyText ? (
              <Card
                backgroundColor={t.surfaceRaised}
                borderRadius="$5"
                padding="$5"
                borderWidth={1}
                borderColor={t.border}
                gap="$4"
                style={Platform.OS === 'web' ? { boxShadow: `0 8px 24px ${t.shadow}` } : undefined}
              >
                {/* Pull quote drop cap */}
                <XStack gap="$3" alignItems="flex-start">
                  <SizableText style={{ fontFamily: fonts.display, fontSize: 56, lineHeight: 48, color: t.copper, fontWeight: '900', marginTop: -8 }}>
                    “
                  </SizableText>
                  <YStack flex={1} gap="$2">
                    <SizableText style={{ fontFamily: fonts.display, fontSize: 18, lineHeight: 26, color: t.ink, fontStyle: 'italic', fontWeight: '500' }}>
                      {dailyText.scripture}
                    </SizableText>
                  </YStack>
                </XStack>

                <YStack height={1} backgroundColor={t.border} />

                {dailyText.comment ? (
                  <SizableText style={{ fontFamily: fonts.body, fontSize: 14, lineHeight: 22, color: t.inkMuted }}>
                    {dailyText.comment.slice(0, 180)}{dailyText.comment.length > 180 ? '…' : ''}
                  </SizableText>
                ) : null}

                <TouchableOpacity
                  data-testid="read-daily-text-btn"
                  onPress={() => router.push({ pathname: '/daily-text', params: { date: new Date().toISOString().slice(0, 10) } })}
                  activeOpacity={0.85}
                  style={{
                    backgroundColor: t.ink, borderRadius: 999, paddingVertical: 12, paddingHorizontal: 18,
                    alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8,
                  }}
                >
                  <SizableText style={{ fontFamily: fonts.mono, fontSize: 11, color: t.inkInverse, fontWeight: '700', letterSpacing: 1.5 }}>
                    READ THE FULL ENTRY
                  </SizableText>
                  <ArrowUpRight size={14} color={t.inkInverse} />
                </TouchableOpacity>
              </Card>
            ) : null}
          </YStack>

          {/* ═══ MEETINGS ═══ */}
          <YStack gap="$2" marginTop="$2">
            <XStack alignItems="center" gap="$2">
              <YStack width={20} height={1} backgroundColor={t.moss} />
              <SizableText style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: 2, color: t.moss, fontWeight: '700' }}>
                II · THIS WEEK'S MEETINGS
              </SizableText>
            </XStack>

            <XStack gap="$3">
              {[
                { tag: 'MID', label: 'Midweek', sub: 'Life & Ministry', date: getMidweekDate(), color: t.copper, soft: t.copperSoft, border: t.copperBorder },
                { tag: 'WT',  label: 'Watchtower', sub: 'Weekend Study', date: getWeekendDate(), color: t.moss, soft: t.mossSoft, border: t.mossBorder },
              ].map((m) => (
                <TouchableOpacity
                  key={m.tag}
                  data-testid={`meeting-${m.tag}`}
                  onPress={() => router.push('/(tabs)/meetings')}
                  activeOpacity={0.85}
                  style={{ flex: 1 }}
                >
                  <Card
                    backgroundColor={t.surface}
                    borderRadius="$5"
                    padding="$4"
                    borderWidth={1}
                    borderColor={t.border}
                    gap="$3"
                  >
                    <XStack justifyContent="space-between" alignItems="flex-start">
                      <YStack
                        backgroundColor={m.soft} borderColor={m.border} borderWidth={1}
                        paddingHorizontal="$2" paddingVertical={3} borderRadius="$2"
                      >
                        <SizableText style={{ fontFamily: fonts.mono, fontSize: 10, color: m.color, fontWeight: '800', letterSpacing: 1.5 }}>
                          {m.tag}
                        </SizableText>
                      </YStack>
                      <ArrowUpRight size={14} color={t.inkSubtle} />
                    </XStack>
                    <YStack gap="$1">
                      <SizableText style={{ fontFamily: fonts.display, fontSize: 18, color: t.ink, fontWeight: '600', letterSpacing: -0.3 }}>
                        {m.label}
                      </SizableText>
                      <SizableText style={{ fontFamily: fonts.body, fontSize: 12, color: t.inkSubtle }}>
                        {m.sub}
                      </SizableText>
                    </YStack>
                    <YStack height={1} backgroundColor={t.border} />
                    <SizableText style={{ fontFamily: fonts.mono, fontSize: 10, color: t.inkMuted, letterSpacing: 1, fontWeight: '600' }}>
                      {m.date.toUpperCase()}
                    </SizableText>
                  </Card>
                </TouchableOpacity>
              ))}
            </XStack>
          </YStack>

          {/* ═══ QUICK AI ═══ */}
          <YStack gap="$2" marginTop="$2">
            <XStack alignItems="center" gap="$2">
              <YStack width={20} height={1} backgroundColor={t.copper} />
              <SizableText style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: 2, color: t.copper, fontWeight: '700' }}>
                III · ASK FROM SOURCES
              </SizableText>
            </XStack>
            <Card
              backgroundColor={t.surface}
              borderRadius="$5"
              padding="$1"
              borderWidth={1}
              borderColor={t.border}
            >
              <XStack
                alignItems="center"
                paddingHorizontal="$3"
                paddingVertical="$2"
                gap="$2"
              >
                <Search size={16} color={t.inkSubtle} />
                <Input
                  flex={1}
                  data-testid="ai-query-input"
                  value={aiQuery}
                  onChangeText={setAiQuery}
                  placeholder="What does the Bible say about…"
                  placeholderTextColor={t.inkSubtle}
                  color={t.ink}
                  backgroundColor="transparent"
                  borderWidth={0}
                  size="$4"
                  focusStyle={{ borderWidth: 0, outlineWidth: 0 } as any}
                  onSubmitEditing={() => aiQuery.trim() && router.push({ pathname: '/(tabs)/search', params: { query: aiQuery.trim() } })}
                  returnKeyType="search"
                  style={{ fontFamily: fonts.body }}
                />
                <TouchableOpacity
                  data-testid="ai-ask-btn"
                  disabled={!aiQuery.trim()}
                  onPress={() => router.push({ pathname: '/(tabs)/search', params: { query: aiQuery.trim() } })}
                  activeOpacity={0.85}
                  style={{
                    backgroundColor: aiQuery.trim() ? t.copper : t.surfaceAlt,
                    borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9,
                    flexDirection: 'row', alignItems: 'center', gap: 5,
                  }}
                >
                  <Zap size={12} color={aiQuery.trim() ? t.inkInverse : t.inkSubtle} />
                  <SizableText style={{ fontFamily: fonts.mono, fontSize: 11, color: aiQuery.trim() ? t.inkInverse : t.inkSubtle, fontWeight: '700', letterSpacing: 1.2 }}>
                    ASK
                  </SizableText>
                </TouchableOpacity>
              </XStack>
            </Card>
            <SizableText style={{ fontFamily: fonts.body, fontSize: 11, color: t.inkSubtle, fontStyle: 'italic', paddingHorizontal: 4 }}>
              Answers drawn only from JW.org & WOL — never invented.
            </SizableText>
          </YStack>

          {/* ═══ RETURN VISITS ═══ */}
          <YStack gap="$2" marginTop="$2">
            <XStack alignItems="center" gap="$2" justifyContent="space-between">
              <XStack alignItems="center" gap="$2">
                <YStack width={20} height={1} backgroundColor={t.moss} />
                <SizableText style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: 2, color: t.moss, fontWeight: '700' }}>
                  IV · RETURN VISITS
                </SizableText>
              </XStack>
              <TouchableOpacity onPress={() => router.push('/(tabs)/ministry')} activeOpacity={0.7}>
                <SizableText style={{ fontFamily: fonts.mono, fontSize: 10, color: t.copper, fontWeight: '700', letterSpacing: 1.5 }}>
                  ALL →
                </SizableText>
              </TouchableOpacity>
            </XStack>

            {contacts.length === 0 ? (
              <Card backgroundColor={t.surface} borderRadius="$5" padding="$5" borderWidth={1} borderColor={t.border} alignItems="center" gap="$3">
                <Users size={28} color={t.inkSubtle} />
                <SizableText style={{ fontFamily: fonts.display, fontSize: 16, color: t.ink, fontStyle: 'italic', textAlign: 'center' }}>
                  No return visits recorded yet
                </SizableText>
                <TouchableOpacity onPress={() => router.push('/(tabs)/ministry')} activeOpacity={0.85}
                  style={{
                    backgroundColor: t.mossSoft, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 9,
                    borderWidth: 1, borderColor: t.mossBorder,
                  }}
                >
                  <SizableText style={{ fontFamily: fonts.mono, fontSize: 11, color: t.moss, fontWeight: '700', letterSpacing: 1.2 }}>
                    GO TO MINISTRY
                  </SizableText>
                </TouchableOpacity>
              </Card>
            ) : (
              <Card backgroundColor={t.surface} borderRadius="$5" borderWidth={1} borderColor={t.border} overflow="hidden">
                {contacts.slice(0, 3).map((c, idx) => (
                  <YStack key={c.id}>
                    <TouchableOpacity onPress={() => router.push('/(tabs)/ministry')} activeOpacity={0.7}>
                      <XStack paddingHorizontal="$4" paddingVertical="$3" gap="$3" alignItems="center">
                        <YStack
                          width={42} height={42} borderRadius={21}
                          backgroundColor={t.copperSoft}
                          borderWidth={1} borderColor={t.copperBorder}
                          justifyContent="center" alignItems="center"
                        >
                          <SizableText style={{ fontFamily: fonts.display, fontSize: 18, color: t.copper, fontWeight: '700' }}>
                            {c.name.charAt(0).toUpperCase()}
                          </SizableText>
                        </YStack>
                        <YStack flex={1}>
                          <SizableText style={{ fontFamily: fonts.display, fontSize: 16, color: t.ink, fontWeight: '600' }}>
                            {c.name}
                          </SizableText>
                          <SizableText style={{ fontFamily: fonts.body, fontSize: 12, color: t.inkMuted }} numberOfLines={1}>
                            {c.nextVisit ? `Next · ${c.nextVisit}` : c.address ?? 'No date set'}
                          </SizableText>
                        </YStack>
                        <ChevronRight size={16} color={t.inkSubtle} />
                      </XStack>
                    </TouchableOpacity>
                    {idx < Math.min(contacts.length, 3) - 1 && <Separator borderColor={t.border} />}
                  </YStack>
                ))}
              </Card>
            )}
          </YStack>

          {/* footer mark */}
          <YStack alignItems="center" paddingTop="$5" gap="$1">
            <YStack width={32} height={1} backgroundColor={t.borderStrong} />
            <SizableText style={{ fontFamily: fonts.mono, fontSize: 9, color: t.inkSubtle, letterSpacing: 2, marginTop: 4 }}>
              ◆ {now.getFullYear()} ◆
            </SizableText>
          </YStack>

        </YStack>
      </ScrollView>
    </SafeAreaView>
  );
}
