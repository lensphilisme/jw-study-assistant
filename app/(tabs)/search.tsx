import { useState, useCallback, useRef } from 'react';
import { FlatList, Linking, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  YStack,
  XStack,
  SizableText,
  H2,
  Card,
  Button,
  ScrollView,
  SearchBar,
  BlinkToggleGroup,
  ChipGroup,
  Separator,
  Spinner,
  Badge,
  Globe,
  Sparkles,
  ExternalLink,
  Bookmark,
  BrainCircuit,
  AlertCircle,
  ChevronRight,
  Search,
  Languages,
  Plus,
} from '@blinkdotnew/mobile-ui';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, AsyncStorageAdapter } from '@blinkdotnew/sdk';

// ─── Blink client ────────────────────────────────────────────────────────────
const blink = createClient({
  projectId: process.env.EXPO_PUBLIC_BLINK_PROJECT_ID!,
  publishableKey: process.env.EXPO_PUBLIC_BLINK_PUBLISHABLE_KEY!,
  storage: new AsyncStorageAdapter(AsyncStorage),
});

// ─── Types ───────────────────────────────────────────────────────────────────
interface SearchResult {
  id: string;
  title: string;
  snippet: string;
  url: string;
  sourceTag: string;
  sourceColor: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────
const SEARCH_TYPES = [
  { value: 'jw', label: 'JW.org' },
  { value: 'wol', label: 'WOL' },
  { value: 'bible', label: 'Bible' },
  { value: 'media', label: 'Media' },
];

const FILTER_CHIPS = [
  { id: 'all', label: 'All' },
  { id: 'bible', label: 'Bible' },
  { id: 'watchtower', label: 'Watchtower' },
  { id: 'awake', label: 'Awake!' },
  { id: 'books', label: 'Books' },
  { id: 'mwb', label: 'Meeting Workbook' },
  { id: 'videos', label: 'Videos' },
];

const SOURCE_COLORS: Record<string, string> = {
  Bible: '#7B6B9E',
  Watchtower: '#5B7E6B',
  'Awake!': '#6B7E9E',
  Book: '#9E7B5B',
  'Meeting Workbook': '#7E9E6B',
  Video: '#9E6B6B',
  Article: '#5B7E6B',
  Insight: '#7B9E5B',
  Other: '#6B7280',
};

function tagFromUrl(url: string): string {
  const u = url.toLowerCase();
  if (u.includes('/bible/')) return 'Bible';
  if (u.includes('w_') || u.includes('/w/')) return 'Watchtower';
  if (u.includes('g_') || u.includes('/g/')) return 'Awake!';
  if (u.includes('mwb_')) return 'Meeting Workbook';
  if (u.includes('lmd') || u.includes('sjjm')) return 'Video';
  if (u.includes('/pub-media/') || u.includes('nwt')) return 'Bible';
  return 'Article';
}

// ─── Parse JW.org HTML ───────────────────────────────────────────────────────
function parseJWResults(html: string, baseUrl: string): SearchResult[] {
  const results: SearchResult[] = [];
  // Match result blocks: <article ...> or <div class="...result...">
  const blockRe = /<(?:article|div)[^>]*class="[^"]*(?:result|searchResult|synopsis)[^"]*"[^>]*>([\s\S]*?)<\/(?:article|div)>/gi;
  let blockMatch;
  let idx = 0;
  while ((blockMatch = blockRe.exec(html)) !== null && idx < 20) {
    const block = blockMatch[1];
    // Extract href
    const hrefM = block.match(/href="([^"]+)"/);
    const rawUrl = hrefM ? hrefM[1] : '';
    const url = rawUrl.startsWith('http') ? rawUrl : `https://www.jw.org${rawUrl}`;
    // Extract title: first <a> or <h3>/<h4> text
    const titleM = block.match(/<(?:h[234]|a)[^>]*>([\s\S]*?)<\/(?:h[234]|a)>/i);
    const title = titleM ? titleM[1].replace(/<[^>]+>/g, '').trim() : '';
    // Extract snippet: first <p> text
    const snippetM = block.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
    const snippet = snippetM ? snippetM[1].replace(/<[^>]+>/g, '').trim() : '';
    if (title) {
      const tag = tagFromUrl(rawUrl);
      results.push({
        id: String(idx),
        title,
        snippet: snippet || 'Tap to read more',
        url,
        sourceTag: tag,
        sourceColor: SOURCE_COLORS[tag] ?? SOURCE_COLORS.Other,
      });
      idx++;
    }
  }
  return results;
}

function parseWOLResults(html: string): SearchResult[] {
  const results: SearchResult[] = [];
  const itemRe = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  let match;
  let idx = 0;
  while ((match = itemRe.exec(html)) !== null && idx < 20) {
    const block = match[1];
    const hrefM = block.match(/href="([^"]+)"/);
    const rawUrl = hrefM ? hrefM[1] : '';
    const url = rawUrl.startsWith('http') ? rawUrl : `https://wol.jw.org${rawUrl}`;
    const titleM = block.match(/<(?:span|a|strong)[^>]*>([\s\S]*?)<\/(?:span|a|strong)>/i);
    const title = titleM ? titleM[1].replace(/<[^>]+>/g, '').trim() : '';
    const snippetM = block.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
    const snippet = snippetM ? snippetM[1].replace(/<[^>]+>/g, '').trim() : '';
    if (title) {
      const tag = tagFromUrl(rawUrl);
      results.push({
        id: String(idx),
        title,
        snippet: snippet || 'Tap to read more',
        url,
        sourceTag: tag,
        sourceColor: SOURCE_COLORS[tag] ?? SOURCE_COLORS.Other,
      });
      idx++;
    }
  }
  return results;
}

// ─── Skeleton card ────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <Card
      backgroundColor="#2C2C2E"
      borderRadius="$4"
      padding="$4"
      borderWidth={1}
      borderColor="#3A3A3C"
      gap="$2"
    >
      <YStack height={16} width="70%" backgroundColor="#3A3A3C" borderRadius="$2" />
      <YStack height={12} width="90%" backgroundColor="#3A3A3C" borderRadius="$2" />
      <YStack height={12} width="60%" backgroundColor="#3A3A3C" borderRadius="$2" />
    </Card>
  );
}

// ─── Result Card ─────────────────────────────────────────────────────────────
function ResultCard({
  item,
  onSave,
  onUseForAI,
}: {
  item: SearchResult;
  onSave: (item: SearchResult) => void;
  onUseForAI: (item: SearchResult) => void;
}) {
  const handleOpen = () => {
    Linking.openURL(item.url).catch(() => {});
  };

  return (
    <Card
      backgroundColor="#2C2C2E"
      borderRadius="$4"
      padding="$4"
      borderWidth={1}
      borderColor="#3A3A3C"
      gap="$3"
      pressStyle={{ opacity: 0.85 }}
    >
      {/* Tag + title */}
      <XStack alignItems="center" gap="$2">
        <YStack
          paddingHorizontal="$2"
          paddingVertical="$1"
          borderRadius="$2"
          backgroundColor={`${item.sourceColor}30`}
        >
          <SizableText size="$1" color={item.sourceColor} fontWeight="700">
            {item.sourceTag.toUpperCase()}
          </SizableText>
        </YStack>
      </XStack>
      <SizableText size="$4" color="#F2F2F7" fontWeight="700" numberOfLines={2}>
        {item.title}
      </SizableText>
      {item.snippet ? (
        <SizableText size="$3" color="#9CA3AF" numberOfLines={3} lineHeight={18}>
          {item.snippet}
        </SizableText>
      ) : null}
      {/* Actions */}
      <XStack gap="$2" flexWrap="wrap">
        <Button
          size="$2"
          backgroundColor="#3A3A3C"
          color="#F2F2F7"
          borderRadius="$3"
          onPress={handleOpen}
          icon={<ExternalLink size={12} color="#9CA3AF" />}
        >
          Open
        </Button>
        <Button
          size="$2"
          backgroundColor="#3A3A3C"
          color="#F2F2F7"
          borderRadius="$3"
          onPress={() => onSave(item)}
          icon={<Bookmark size={12} color="#9CA3AF" />}
        >
          Save
        </Button>
        <Button
          size="$2"
          backgroundColor={`${SOURCE_COLORS.Article}20`}
          color="#5B7E6B"
          borderRadius="$3"
          onPress={() => onUseForAI(item)}
          icon={<Plus size={12} color="#5B7E6B" />}
        >
          Use for AI
        </Button>
      </XStack>
    </Card>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function SearchScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [searchType, setSearchType] = useState('jw');
  const [activeFilters, setActiveFilters] = useState<string[]>(['all']);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [corsBlocked, setCorsBlocked] = useState(false);
  const [aiMode, setAiMode] = useState(false);
  const [aiAnswer, setAiAnswer] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiContext, setAiContext] = useState<SearchResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  // ── Build URL ──────────────────────────────────────────────────────────────
  const buildUrl = useCallback(
    async (q: string, type: string): Promise<string> => {
      const raw = await AsyncStorage.getItem('selected_language');
      let lang = 'en';
      try {
        if (raw) {
          const parsed = JSON.parse(raw);
          lang = parsed?.symbol ?? parsed?.code ?? 'en';
        }
      } catch {}

      if (type === 'jw') {
        return `https://www.jw.org/${lang}/search/results/all?q=${encodeURIComponent(q)}&sort=rel`;
      }
      if (type === 'wol') {
        const wolRegion = 'r1';
        const wolLangParam = 'lp-e';
        return `https://wol.jw.org/${lang}/wol/s/${wolRegion}/${wolLangParam}?q=${encodeURIComponent(q)}&p=par&r=occ&st=a`;
      }
      if (type === 'bible') {
        return `https://wol.jw.org/en/wol/s/r1/lp-e?q=${encodeURIComponent(q)}&p=par&r=occ&st=a`;
      }
      // media
      return `https://www.jw.org/${lang}/search/results/videos?q=${encodeURIComponent(q)}&sort=rel`;
    },
    []
  );

  // ── Run Search ─────────────────────────────────────────────────────────────
  const handleSearch = useCallback(async () => {
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setError(null);
    setCorsBlocked(false);
    setResults([]);
    setAiAnswer(null);
    setHasSearched(true);

    try {
      const url = await buildUrl(q, searchType);
      const resp = await fetch(url, {
        headers: { Accept: 'text/html,application/json' },
        signal: AbortSignal.timeout(12000),
      });

      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
      }

      const contentType = resp.headers.get('content-type') ?? '';
      let parsed: SearchResult[] = [];

      if (contentType.includes('json')) {
        const json = await resp.json();
        // Try to extract results from common JW JSON shapes
        const items: any[] = json?.results ?? json?.data ?? json?.items ?? [];
        parsed = items.slice(0, 20).map((it: any, i: number) => {
          const rawUrl = it.url ?? it.link ?? it.href ?? '';
          const tag = tagFromUrl(rawUrl);
          return {
            id: String(i),
            title: it.title ?? it.name ?? 'Untitled',
            snippet: it.snippet ?? it.description ?? it.content ?? '',
            url: rawUrl.startsWith('http') ? rawUrl : `https://www.jw.org${rawUrl}`,
            sourceTag: tag,
            sourceColor: SOURCE_COLORS[tag] ?? SOURCE_COLORS.Other,
          };
        });
      } else {
        const html = await resp.text();
        parsed = searchType === 'wol' ? parseWOLResults(html) : parseJWResults(html, url);
      }

      setResults(parsed);

      // AI Research Mode
      if (aiMode && parsed.length > 0) {
        setAiLoading(true);
        try {
          const resultsText = parsed
            .slice(0, 8)
            .map((r, i) => `[${i + 1}] ${r.title}\n${r.snippet}\nURL: ${r.url}`)
            .join('\n\n');

          const response = await blink.ai.generateText({
            model: 'google/gemini-flash-1.5',
            messages: [
              {
                role: 'system',
                content:
                  'You are a JW Study Assistant. Answer ONLY using the following JW source content. Never invent references. Always cite sources by their number [1], [2], etc.',
              },
              {
                role: 'user',
                content: `Question: ${q}\n\nJW Sources found:\n${resultsText}\n\nSynthesize a clear, concise answer using only these sources. Cite each source you use.`,
              },
            ],
          });
          setAiAnswer(
            typeof response === 'string'
              ? response
              : (response as any)?.text ?? (response as any)?.content ?? ''
          );
        } catch (aiErr) {
          setAiAnswer('AI synthesis unavailable. Please review the sources above.');
        } finally {
          setAiLoading(false);
        }
      }
    } catch (err: any) {
      const msg = err?.message ?? '';
      if (
        msg.includes('Failed to fetch') ||
        msg.includes('CORS') ||
        msg.includes('NetworkError') ||
        msg.includes('network')
      ) {
        setCorsBlocked(true);
        setError('cors');
      } else if (msg.includes('timeout') || msg.includes('abort')) {
        setError('timeout');
      } else {
        setError(msg || 'unknown');
      }
    } finally {
      setLoading(false);
    }
  }, [query, searchType, aiMode, buildUrl]);

  // ── Save result ────────────────────────────────────────────────────────────
  const handleSave = useCallback(async (item: SearchResult) => {
    try {
      const raw = await AsyncStorage.getItem('saved_sources');
      const saved: SearchResult[] = raw ? JSON.parse(raw) : [];
      if (!saved.find((s) => s.id === item.id && s.url === item.url)) {
        saved.unshift(item);
        await AsyncStorage.setItem('saved_sources', JSON.stringify(saved.slice(0, 200)));
      }
    } catch {}
  }, []);

  const handleUseForAI = useCallback((item: SearchResult) => {
    setAiContext((prev) => (prev.find((r) => r.id === item.id) ? prev : [item, ...prev]));
  }, []);

  // ── Open JW.org fallback ───────────────────────────────────────────────────
  const openJWOrg = useCallback(async () => {
    const q = query.trim();
    const url = `https://www.jw.org/en/search/results/all?q=${encodeURIComponent(q)}&sort=rel`;
    Linking.openURL(url).catch(() => {});
  }, [query]);

  // ── Filter chips ───────────────────────────────────────────────────────────
  const handleFilterChange = useCallback((selected: string[]) => {
    if (selected.length === 0) {
      setActiveFilters(['all']);
      return;
    }
    const last = selected[selected.length - 1];
    if (last === 'all') {
      setActiveFilters(['all']);
    } else {
      setActiveFilters(selected.filter((s) => s !== 'all'));
    }
  }, []);

  const filteredResults = results.filter((r) => {
    if (activeFilters.includes('all') || activeFilters.length === 0) return true;
    const tag = r.sourceTag.toLowerCase();
    return activeFilters.some(
      (f) => tag.includes(f) || r.url.toLowerCase().includes(f)
    );
  });

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#1C1C1E' }}>
      <YStack flex={1}>
        {/* ── Header ── */}
        <XStack
          paddingHorizontal="$5"
          paddingTop="$4"
          paddingBottom="$3"
          alignItems="center"
          justifyContent="space-between"
        >
          <XStack alignItems="center" gap="$2">
            <Globe size={22} color="#5B7E6B" />
            <H2 color="#F2F2F7" fontWeight="800" fontSize={24}>
              Search JW Sources
            </H2>
          </XStack>
          <Button
            size="$3"
            backgroundColor="transparent"
            color="#9CA3AF"
            borderWidth={0}
            onPress={() => router.push('/(tabs)/settings')}
            icon={<Languages size={18} color="#9CA3AF" />}
          >
            Lang
          </Button>
        </XStack>

        {/* ── Search Type Toggle ── */}
        <YStack paddingHorizontal="$5" paddingBottom="$3">
          <BlinkToggleGroup
            options={SEARCH_TYPES}
            value={searchType}
            onValueChange={(v) => v && setSearchType(v)}
          />
        </YStack>

        {/* ── Search Input ── */}
        <YStack paddingHorizontal="$5" paddingBottom="$3">
          <XStack gap="$2" alignItems="center">
            <YStack flex={1}>
              <SearchBar
                value={query}
                onChangeText={setQuery}
                placeholder="Search scriptures, articles, videos…"
                onSubmitEditing={handleSearch}
                returnKeyType="search"
              />
            </YStack>
            <Button
              size="$3"
              backgroundColor="#5B7E6B"
              color="white"
              borderRadius="$3"
              onPress={handleSearch}
              disabled={!query.trim() || loading}
              icon={loading ? <Spinner size="small" color="white" /> : <Search size={16} color="white" />}
              minWidth={70}
            >
              {loading ? '' : 'Go'}
            </Button>
          </XStack>
        </YStack>

        {/* ── Filter Chips ── */}
        <YStack paddingBottom="$3">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} paddingHorizontal="$5">
            <ChipGroup
              chips={FILTER_CHIPS}
              selected={activeFilters}
              onSelectionChange={handleFilterChange}
            />
          </ScrollView>
        </YStack>

        {/* ── AI Toggle ── */}
        <XStack
          paddingHorizontal="$5"
          paddingBottom="$3"
          alignItems="center"
          justifyContent="space-between"
        >
          <XStack alignItems="center" gap="$2">
            <BrainCircuit size={16} color="#5B7E6B" />
            <SizableText size="$3" color="#9CA3AF" fontWeight="600">
              AI Research Mode
            </SizableText>
          </XStack>
          <XStack
            backgroundColor={aiMode ? '#5B7E6B' : '#3A3A3C'}
            borderRadius="$10"
            width={44}
            height={26}
            alignItems="center"
            paddingHorizontal={3}
            justifyContent={aiMode ? 'flex-end' : 'flex-start'}
            pressStyle={{ opacity: 0.8 }}
            onPress={() => setAiMode((v) => !v)}
          >
            <YStack
              width={20}
              height={20}
              borderRadius={10}
              backgroundColor="white"
            />
          </XStack>
        </XStack>

        <Separator borderColor="#2C2C2E" />

        {/* ── Results Area ── */}
        <YStack flex={1}>
          {/* Loading skeletons */}
          {loading && (
            <YStack padding="$5" gap="$3">
              {[1, 2, 3].map((i) => (
                <SkeletonCard key={i} />
              ))}
            </YStack>
          )}

          {/* CORS / error states */}
          {!loading && corsBlocked && (
            <YStack padding="$5" gap="$4" alignItems="center">
              <YStack
                backgroundColor="#2C2C2E"
                borderRadius="$4"
                padding="$5"
                borderWidth={1}
                borderColor="#3A3A3C"
                alignItems="center"
                gap="$3"
                width="100%"
              >
                <Globe size={36} color="#5B7E6B" />
                <SizableText size="$5" color="#F2F2F7" fontWeight="700" textAlign="center">
                  Results on JW.org
                </SizableText>
                <SizableText size="$3" color="#9CA3AF" textAlign="center" lineHeight={20}>
                  Search results are available on JW.org. Tap below to open your search there directly.
                </SizableText>
                <Button
                  backgroundColor="#5B7E6B"
                  color="white"
                  borderRadius="$3"
                  onPress={openJWOrg}
                  icon={<ExternalLink size={14} color="white" />}
                  size="$4"
                >
                  Open in JW.org
                </Button>
              </YStack>
            </YStack>
          )}

          {!loading && error && !corsBlocked && (
            <YStack padding="$5" gap="$4" alignItems="center">
              <YStack
                backgroundColor="#2C2C2E"
                borderRadius="$4"
                padding="$5"
                borderWidth={1}
                borderColor="#3A3A3C"
                alignItems="center"
                gap="$3"
                width="100%"
              >
                <AlertCircle size={36} color="#EF4444" />
                <SizableText size="$5" color="#F2F2F7" fontWeight="700">
                  Search Failed
                </SizableText>
                <SizableText size="$3" color="#9CA3AF" textAlign="center" lineHeight={20}>
                  {error === 'timeout'
                    ? 'Request timed out. Check your connection and try again.'
                    : 'Could not reach JW.org. Check your connection or try opening JW.org directly.'}
                </SizableText>
                <XStack gap="$2">
                  <Button
                    size="$3"
                    backgroundColor="#3A3A3C"
                    color="#F2F2F7"
                    borderRadius="$3"
                    onPress={handleSearch}
                  >
                    Try Again
                  </Button>
                  <Button
                    size="$3"
                    backgroundColor="#5B7E6B"
                    color="white"
                    borderRadius="$3"
                    onPress={openJWOrg}
                    icon={<ExternalLink size={12} color="white" />}
                  >
                    JW.org
                  </Button>
                </XStack>
              </YStack>
            </YStack>
          )}

          {/* Empty state */}
          {!loading && !error && hasSearched && filteredResults.length === 0 && (
            <YStack padding="$5" gap="$4" alignItems="center">
              <YStack
                backgroundColor="#2C2C2E"
                borderRadius="$4"
                padding="$5"
                borderWidth={1}
                borderColor="#3A3A3C"
                alignItems="center"
                gap="$3"
                width="100%"
              >
                <Search size={36} color="#6B7280" />
                <SizableText size="$5" color="#F2F2F7" fontWeight="700">
                  No Results Found
                </SizableText>
                <SizableText size="$3" color="#9CA3AF" textAlign="center" lineHeight={20}>
                  No results for "{query}". Try different keywords or search on JW.org directly.
                </SizableText>
                <Button
                  size="$3"
                  backgroundColor="#5B7E6B"
                  color="white"
                  borderRadius="$3"
                  onPress={openJWOrg}
                  icon={<ExternalLink size={12} color="white" />}
                >
                  Search on JW.org
                </Button>
              </YStack>
            </YStack>
          )}

          {/* Initial empty prompt */}
          {!loading && !hasSearched && (
            <YStack flex={1} justifyContent="center" alignItems="center" gap="$3" padding="$5">
              <Globe size={52} color="#3A3A3C" />
              <SizableText size="$5" color="#F2F2F7" fontWeight="700" textAlign="center">
                Search JW Sources
              </SizableText>
              <SizableText size="$3" color="#9CA3AF" textAlign="center" maxWidth={280} lineHeight={20}>
                Search articles, scriptures, meeting materials, and videos from JW.org and the Watchtower Online Library.
              </SizableText>
            </YStack>
          )}

          {/* AI Answer Card */}
          {(aiLoading || aiAnswer) && (
            <YStack paddingHorizontal="$5" paddingTop="$4">
              <Card
                backgroundColor="#1A2E24"
                borderRadius="$4"
                padding="$4"
                borderWidth={1}
                borderColor="#2D5A40"
                gap="$3"
              >
                <XStack alignItems="center" gap="$2">
                  <Sparkles size={16} color="#5B7E6B" />
                  <SizableText size="$3" color="#5B7E6B" fontWeight="700">
                    AI RESEARCH SYNTHESIS
                  </SizableText>
                </XStack>
                <SizableText size="$2" color="#9CA3AF" fontStyle="italic">
                  Based on JW Sources:
                </SizableText>
                {aiLoading ? (
                  <XStack gap="$2" alignItems="center">
                    <Spinner size="small" color="#5B7E6B" />
                    <SizableText size="$3" color="#9CA3AF">
                      Synthesizing answer…
                    </SizableText>
                  </XStack>
                ) : (
                  <SizableText size="$3" color="#E5E7EB" lineHeight={20}>
                    {aiAnswer}
                  </SizableText>
                )}
                {aiAnswer && !aiLoading && (
                  <Button
                    size="$2"
                    backgroundColor="#2D5A40"
                    color="#5B7E6B"
                    borderRadius="$3"
                    onPress={async () => {
                      try {
                        const raw = await AsyncStorage.getItem('saved_ai_answers');
                        const saved = raw ? JSON.parse(raw) : [];
                        saved.unshift({ query, answer: aiAnswer, date: new Date().toISOString() });
                        await AsyncStorage.setItem(
                          'saved_ai_answers',
                          JSON.stringify(saved.slice(0, 50))
                        );
                      } catch {}
                    }}
                    icon={<Bookmark size={12} color="#5B7E6B" />}
                    alignSelf="flex-start"
                  >
                    Save Answer
                  </Button>
                )}
              </Card>
            </YStack>
          )}

          {/* Results list */}
          {!loading && filteredResults.length > 0 && (
            <FlatList
              data={filteredResults}
              keyExtractor={(item) => item.id + item.url}
              contentContainerStyle={{ padding: 20, gap: 12, paddingTop: 16 }}
              ItemSeparatorComponent={() => <YStack height={12} />}
              renderItem={({ item }) => (
                <ResultCard item={item} onSave={handleSave} onUseForAI={handleUseForAI} />
              )}
              showsVerticalScrollIndicator={false}
              ListHeaderComponent={
                <XStack alignItems="center" justifyContent="space-between" paddingBottom="$2">
                  <SizableText size="$3" color="#9CA3AF">
                    {filteredResults.length} result{filteredResults.length !== 1 ? 's' : ''}
                  </SizableText>
                  {aiContext.length > 0 && (
                    <XStack
                      backgroundColor="#1A2E24"
                      paddingHorizontal="$2"
                      paddingVertical="$1"
                      borderRadius="$2"
                      alignItems="center"
                      gap="$1"
                    >
                      <BrainCircuit size={12} color="#5B7E6B" />
                      <SizableText size="$1" color="#5B7E6B">
                        {aiContext.length} in AI context
                      </SizableText>
                    </XStack>
                  )}
                </XStack>
              }
            />
          )}
        </YStack>
      </YStack>
    </SafeAreaView>
  );
}
