import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
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
  Sheet,
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
  toast,
} from '@blinkdotnew/mobile-ui';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAppStore } from '@/store/appStore';
import { translate } from '@/services/i18nService';
import { fetchWolReferencePreview, type WolPreview, type WolReference } from '@/services/wolReferenceService';
import {
  gatewayFetchSourcesForAi,
  gatewaySearchAll,
  gatewaySearchSuggestions,
  normalizeAppLanguage,
} from '@/services/sourceGatewayService';
import { saveSource } from '@/services/storageService';
import { generateAiText } from '@/services/localAiService';
import { usePremiumTheme } from '@/hooks/usePremiumTheme';
import { AppHeader, AppScreen, EmptyState, GradientButton, LoadingState, PremiumBadge, PremiumCard, PreviewModal, SearchBar } from '@/components/premium';

interface SearchResult {
  id: string;
  title: string;
  snippet: string;
  url: string;
  sourceTag: string;
  sourceColor: string;
}

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

// ─── Skeleton card ────────────────────────────────────────────────────────────
function SkeletonCard() {
  const premium = usePremiumTheme();
  return (
    <PremiumCard>
      <YStack height={16} width="70%" backgroundColor={premium.surface3} borderRadius="$2" />
      <YStack height={12} width="90%" backgroundColor={premium.surface3} borderRadius="$2" />
      <YStack height={12} width="60%" backgroundColor={premium.surface3} borderRadius="$2" />
    </PremiumCard>
  );
}
// ─── Result Card ─────────────────────────────────────────────────────────────
function ResultCard({ item, onSave, onPreview, displaySymbol }: {
  item: SearchResult;
  onSave: (item: SearchResult) => void;
  onPreview: (item: SearchResult) => void;
  displaySymbol: string;
}) {
  const premium = usePremiumTheme();
  const isPlusLink = item.title.trim() === '+';

  return (
    <PremiumCard>
      <XStack alignItems="center" gap="$2">
        <YStack
          paddingHorizontal="$2"
          paddingVertical="$1"
          borderRadius="$2"
          backgroundColor={premium.glowBlue}
          borderWidth={1}
          borderColor={premium.border}
        >
          <SizableText size="$1" color={premium.accent} fontWeight="800" letterSpacing={0.6}>
            {item.sourceTag.toUpperCase()}
          </SizableText>
        </YStack>
      </XStack>
      {isPlusLink ? (
        <Button
          size="$4"
          backgroundColor={premium.primaryDeep}
          color="#fff"
          borderRadius="$3"
          onPress={() => onPreview(item)}
          icon={<Plus size={18} color="#fff" />}
        >
          +
        </Button>
      ) : (
        <SizableText size="$4" color={premium.text} fontWeight="900" letterSpacing={-0.2} numberOfLines={2}>
          {item.title}
        </SizableText>
      )}
      {item.snippet ? (
        <SizableText size="$3" color={premium.textMuted} numberOfLines={3} lineHeight={20}>
          {item.snippet}
        </SizableText>
      ) : null}
      <XStack gap="$2" flexWrap="wrap">
        <Button
          size="$2"
          backgroundColor={premium.surface2}
          color={premium.textSoft}
          borderRadius="$3"
          onPress={() => onPreview(item)}
          icon={<ExternalLink size={12} color={premium.textMuted} />}
        >
          {translate(displaySymbol, 'open')}
        </Button>
        <Button
          size="$2"
          backgroundColor={premium.surface2}
          color={premium.textSoft}
          borderRadius="$3"
          onPress={() => onSave(item)}
          icon={<Bookmark size={12} color={premium.textMuted} />}
        >
          {translate(displaySymbol, 'save')}
        </Button>
      </XStack>
    </PremiumCard>
  );
}
export default function SearchScreen() {
  const router = useRouter();
  const colors = usePremiumTheme();
  const params = useLocalSearchParams<{ query?: string; aiMode?: string }>();

  const appLanguage = useAppStore((s) => s.appLanguage);
  const rawContentLanguage = useAppStore((s) => s.contentLanguage || s.language);
  const contentLanguage = useMemo(() => normalizeAppLanguage(rawContentLanguage), [rawContentLanguage]);
  const displaySymbol = appLanguage?.symbol || 'en';
  const language = contentLanguage.symbol;

  const [query, setQuery] = useState('');
  // Remove searchType, always search all sources
  // No filter chips
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [corsBlocked, setCorsBlocked] = useState(false);
  const [aiMode, setAiMode] = useState(false);
  const [aiAnswer, setAiAnswer] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSources, setAiSources] = useState<SearchResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [suggestions, setSuggestions] = useState<Array<{ query: string; caption: string; label?: string | null }>>([]);
  const [previewResult, setPreviewResult] = useState<SearchResult | null>(null);
  const [preview, setPreview] = useState<WolPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(() => {
      gatewaySearchSuggestions(q, contentLanguage)
        .then((items) => setSuggestions(items.slice(0, 6)))
        .catch(() => setSuggestions([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [query, contentLanguage]);

  // ── Run Search ─────────────────────────────────────────────────────────────
  // Unified search: search all sources in parallel, merge results
  const handleSearch = useCallback(async (overrideQuery?: string, overrideAiMode?: boolean) => {
    let q = overrideQuery ?? query;
    if (typeof q !== 'string') q = q ? String(q) : '';
    q = q.trim();
    const ai = overrideAiMode ?? aiMode;
    if (!q) return;
    setLoading(true);
    setError(null);
    setCorsBlocked(false);
    setResults([]);
    setAiSources([]);
    setPage(1);
    setAiAnswer(null);
    setHasSearched(true);

    try {
      const deduped = (await gatewaySearchAll(q, contentLanguage, { wolPages: 6, jwLimit: 80 })).data;
      setResults(deduped);

      // AI Research Mode
      if (ai && deduped.length > 0) {
        const selectedSources = deduped.slice(0, 8);
        setAiSources(selectedSources);
        setAiLoading(true);
        try {
          const sourcePack = await gatewayFetchSourcesForAi(selectedSources, contentLanguage);
          const resultsText = sourcePack.content || selectedSources
            .map((r, i) => `[${i + 1}] ${r.title}\n${r.snippet}\nURL: ${r.url}`)
            .join('\n\n');

          const response = await generateAiText({
            messages: [
              {
                role: 'system',
                content:
                  'You are a JW Study Assistant. Answer ONLY using the following JW source content. Never invent references. Always cite sources by their number [1], [2], etc.',
              },
              {
                role: 'user',
                content: `Question: ${q}\n\nJW source bodies fetched automatically:\n${resultsText}\n\nSynthesize a clear, concise answer using only these sources. Cite each source you use.`,
              },
            ],
          });
          setAiAnswer(
            response.text
          );
        } catch (aiErr) {
        setAiAnswer(translate(displaySymbol, 'ai_synthesis_unavailable'));
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
  }, [query, aiMode, contentLanguage, displaySymbol]);

  // ── Save result ────────────────────────────────────────────────────────────
  const handleSave = useCallback(async (item: SearchResult) => {
    try {
      await saveSource({
        id: `search_${encodeURIComponent(item.url)}`,
        type: item.sourceTag === 'Video' ? 'article' : 'article',
        title: item.title,
        content: item.snippet,
        url: item.url,
        language,
        savedAt: new Date().toISOString(),
        syncStatus: 'saved',
        metadata: {
          sourceTag: item.sourceTag,
          sourceColor: item.sourceColor,
        },
      });
      toast(translate(displaySymbol, 'saved'), { message: item.title, variant: 'success' });
    } catch {
      toast(translate(displaySymbol, 'delete_failed'), { message: translate(displaySymbol, 'check_connection_retry'), variant: 'error' });
    }
  }, [language, displaySymbol]);

  const handlePreview = useCallback((item: SearchResult) => {
    setPreviewResult(item);
    setPreview(null);
    setPreviewLoading(true);
    const kind: WolReference['kind'] = /\/wol\/(?:b|bc)\//.test(item.url) ? 'bible' : 'publication';
    fetchWolReferencePreview({ text: item.title, href: item.url, kind })
      .then(setPreview)
      .catch(() => setPreview({
        title: item.title,
        content: item.snippet || translate(displaySymbol, 'preview_unavailable'),
        url: item.url,
      }))
      .finally(() => setPreviewLoading(false));
  }, []);

  // ── Open JW.org fallback ───────────────────────────────────────────────────
  const openJWOrg = useCallback(async () => {
    const q = query.trim();
    const url = `https://www.jw.org/en/search/results/all?q=${encodeURIComponent(q)}&sort=rel`;
    Linking.openURL(url).catch(() => {});
  }, [query]);

  // ── Filter chips ───────────────────────────────────────────────────────────


  // No filtering, just show all results
  const filteredResults = results;
  const showFullResults = !aiMode && !aiLoading && !aiAnswer;
  const pageCount = Math.max(1, Math.ceil(filteredResults.length / pageSize));
  const pagedResults = filteredResults.slice((page - 1) * pageSize, page * pageSize);
  const visiblePages = Array.from(
    new Set([
      1,
      pageCount,
      page - 2,
      page - 1,
      page,
      page + 1,
      page + 2,
    ].filter((p) => p >= 1 && p <= pageCount))
  ).sort((a, b) => a - b);



  // Robustly sync search input and auto-search with navigation params
  const prevNavQueryRef = useRef<string | undefined>(undefined);
  const navQuery = typeof params.query === 'string' ? params.query.trim() : '';
  const navAiMode = params.aiMode === 'true';
  useEffect(() => {
    if (navQuery && navQuery !== prevNavQueryRef.current) {
      prevNavQueryRef.current = navQuery;
      setQuery(navQuery);
      setAiMode(navAiMode);
      setHasSearched(true);
      handleSearch(navQuery, navAiMode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navQuery, navAiMode, handleSearch]);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <YStack flex={1}>
        <YStack padding="$5" paddingBottom="$3" gap="$4">
          <XStack alignItems="center" justifyContent="space-between">
            <YStack gap="$1">
              <H2 color={colors.text}>{translate(displaySymbol, 'search')}</H2>
              <SizableText size="$3" color={colors.textMuted}>
                {translate(displaySymbol, 'search_jw_sources')}
              </SizableText>
            </YStack>
            <Languages size={22} color={colors.textMuted} />
          </XStack>
          <XStack gap="$2" alignItems="center">
            <YStack flex={1}>
              <SearchBar
                value={query}
                onChangeText={setQuery}
                placeholder={translate(displaySymbol, 'search_jw_sources')}
              />
            </YStack>
            <Button
              backgroundColor={colors.primaryDeep}
              color="white"
              borderRadius="$6"
              onPress={() => handleSearch()}
              disabled={!query.trim() || loading}
              icon={loading ? <Spinner size="small" color="white" /> : <Search size={16} color="white" />}
              minWidth={70}
            >
              {loading ? '' : translate(displaySymbol, 'go')}
            </Button>
          </XStack>
          {suggestions.length > 0 && (
            <YStack gap="$2">
              {suggestions.map((item) => (
                <Button
                  key={`${item.query}-${item.caption}`}
                  size="$2"
                  backgroundColor={colors.surface2}
                  color={colors.text}
                  borderRadius="$3"
                  onPress={() => {
                    setQuery(item.query);
                    setSuggestions([]);
                    handleSearch(item.query);
                  }}
                  justifyContent="flex-start"
                >
                  {item.caption || item.query}
                </Button>
              ))}
            </YStack>
          )}
        </YStack>



        {/* ── AI Toggle ── */}
        <XStack
          paddingHorizontal="$5"
          paddingBottom="$3"
          alignItems="center"
          justifyContent="space-between"
        >
          <XStack alignItems="center" gap="$2">
            <BrainCircuit size={16} color={colors.primary} />
            <SizableText size="$3" color={colors.textMuted} fontWeight="700">
              {translate(displaySymbol, 'ai_research_mode')}
            </SizableText>
          </XStack>
          <XStack
            backgroundColor={aiMode ? colors.primaryDeep : colors.surface3}
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

        <Separator borderColor={colors.border} />

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
                backgroundColor={colors.surface}
                borderRadius="$6"
                padding="$5"
                borderWidth={1}
                borderColor={colors.border}
                alignItems="center"
                gap="$3"
                width="100%"
              >
                <Globe size={36} color={colors.primary} />
                <SizableText size="$5" color={colors.text} fontWeight="900" textAlign="center">
                  {translate(displaySymbol, 'results_on_jw')}
                </SizableText>
                <SizableText size="$3" color={colors.textMuted} textAlign="center" lineHeight={20}>
                  {translate(displaySymbol, 'cors_search_hint')}
                </SizableText>
                <Button
                  backgroundColor={colors.primaryDeep}
                  color="white"
                  borderRadius="$3"
                  onPress={openJWOrg}
                  icon={<ExternalLink size={14} color="white" />}
                  size="$4"
                >
                  {translate(displaySymbol, 'open_in_jw')}
                </Button>
              </YStack>
            </YStack>
          )}

          {!loading && error && !corsBlocked && (
            <YStack padding="$5" gap="$4" alignItems="center">
              <YStack
                backgroundColor={colors.surface}
                borderRadius="$6"
                padding="$5"
                borderWidth={1}
                borderColor={colors.border}
                alignItems="center"
                gap="$3"
                width="100%"
              >
                <AlertCircle size={36} color="#EF4444" />
                <SizableText size="$5" color={colors.text} fontWeight="700">
                  {translate(displaySymbol, 'search_failed')}
                </SizableText>
                <SizableText size="$3" color={colors.textMuted} textAlign="center" lineHeight={20}>
                  {error === 'timeout'
                    ? translate(displaySymbol, 'request_timeout')
                    : translate(displaySymbol, 'search_error_hint')}
                </SizableText>
                <XStack gap="$2">
                  <Button
                    size="$3"
                    backgroundColor={colors.surface2}
                    color={colors.text}
                    borderRadius="$3"
                    onPress={() => handleSearch()}
                  >
                    {translate(displaySymbol, 'try_again')}
                  </Button>
                  <Button
                    size="$3"
                    backgroundColor={colors.primaryDeep}
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
                backgroundColor={colors.surface}
                borderRadius="$6"
                padding="$5"
                borderWidth={1}
                borderColor={colors.border}
                alignItems="center"
                gap="$3"
                width="100%"
              >
                <Search size={36} color={colors.textMuted} />
                <SizableText size="$5" color={colors.text} fontWeight="900">
                  {translate(displaySymbol, 'no_results_found')}
                </SizableText>
                <SizableText size="$3" color={colors.textMuted} textAlign="center" lineHeight={20}>
                  {translate(displaySymbol, 'no_results_hint')}
                </SizableText>
                <Button
                  size="$3"
                  backgroundColor={colors.primaryDeep}
                  color="white"
                  borderRadius="$3"
                  onPress={openJWOrg}
                  icon={<ExternalLink size={12} color="white" />}
                >
                  {translate(displaySymbol, 'search_on_jw')}
                </Button>
              </YStack>
            </YStack>
          )}

          {/* Initial empty prompt */}
          {!loading && !hasSearched && (
            <YStack flex={1} justifyContent="center" alignItems="center" gap="$3" padding="$5">
              <Globe size={52} color={colors.borderStrong} />
              <SizableText size="$5" color={colors.text} fontWeight="900" textAlign="center">
                {translate(displaySymbol, 'search_jw_sources')}
              </SizableText>
              <SizableText size="$3" color={colors.textMuted} textAlign="center" maxWidth={280} lineHeight={21}>
                {translate(displaySymbol, 'search_jw_sources_hint')}
              </SizableText>
            </YStack>
          )}

          {/* AI Answer Card */}
          {(aiLoading || aiAnswer) && (
            <YStack paddingHorizontal="$5" paddingTop="$4">
              <Card
                backgroundColor={colors.surface}
                borderRadius="$6"
                padding="$4"
                borderWidth={1}
                borderColor={colors.borderStrong}
                gap="$3"
              >
                <XStack alignItems="center" gap="$2">
                  <Sparkles size={16} color={colors.primary} />
                  <SizableText size="$3" color={colors.primary} fontWeight="800">
                    {translate(displaySymbol, 'ai_research_synthesis')}
                  </SizableText>
                </XStack>
                <SizableText size="$2" color={colors.textMuted} fontStyle="italic">
                  {translate(displaySymbol, 'based_on_jw_sources')}
                </SizableText>
                {aiLoading ? (
                  <XStack gap="$2" alignItems="center">
                    <Spinner size="small" color={colors.primary} />
                    <SizableText size="$3" color={colors.textMuted}>
                      {translate(displaySymbol, 'synthesizing_answer')}
                    </SizableText>
                  </XStack>
                ) : (
                  <SizableText size="$3" color={colors.textSoft} lineHeight={22}>
                    {aiAnswer}
                  </SizableText>
                )}
                {aiAnswer && !aiLoading && (
                  <YStack gap="$3">
                    {aiSources.length > 0 ? (
                      <YStack gap="$2">
                        <SizableText size="$2" color={colors.primary} fontWeight="900" letterSpacing={1}>
                          {translate(displaySymbol, 'based_on_jw_sources').toUpperCase()}
                        </SizableText>
                        {aiSources.slice(0, 8).map((source, index) => (
                          <XStack key={`${source.id}-${source.url}`} gap="$2" alignItems="flex-start">
                            <SizableText size="$2" color={colors.textMuted} fontWeight="900" width={24}>
                              [{index + 1}]
                            </SizableText>
                            <YStack flex={1}>
                              <SizableText size="$3" color={colors.text} fontWeight="800" numberOfLines={2}>{source.title}</SizableText>
                              <SizableText size="$2" color={colors.textMuted}>{source.sourceTag}</SizableText>
                            </YStack>
                            <Button size="$2" chromeless color={colors.primary} onPress={() => handlePreview(source)}>
                              {translate(displaySymbol, 'open')}
                            </Button>
                          </XStack>
                        ))}
                      </YStack>
                    ) : null}
                    <Button
                      size="$2"
                      backgroundColor={colors.glow}
                      color={colors.primary}
                      borderRadius="$3"
                      onPress={async () => {
                        try {
                          await saveSource({
                            id: `search_ai_${Date.now()}`,
                            type: 'answer',
                            title: `AI answer: ${query}`,
                            content: aiAnswer,
                            language,
                            savedAt: new Date().toISOString(),
                            syncStatus: 'saved',
                            metadata: { query, sourceCount: String(aiSources.length || results.length) },
                          });
                          toast(translate(displaySymbol, 'saved'), { message: translate(displaySymbol, 'save_answer'), variant: 'success' });
                        } catch {
                          toast(translate(displaySymbol, 'delete_failed'), { message: translate(displaySymbol, 'check_connection_retry'), variant: 'error' });
                        }
                      }}
                      icon={<Bookmark size={12} color={colors.primary} />}
                      alignSelf="flex-start"
                    >
                      {translate(displaySymbol, 'save_answer')}
                    </Button>
                  </YStack>
                )}
              </Card>
            </YStack>
          )}

          {/* Results list */}
          {!loading && showFullResults && filteredResults.length > 0 && (
            <FlatList
              data={pagedResults}
              keyExtractor={(item) => item.id + item.url}
              contentContainerStyle={{ padding: 20, gap: 12, paddingTop: 16 }}
              ItemSeparatorComponent={() => <YStack height={12} />}
              renderItem={({ item }) => (
                <ResultCard item={item} onSave={handleSave} onPreview={handlePreview} displaySymbol={displaySymbol} />
              )}
              showsVerticalScrollIndicator={false}
              ListHeaderComponent={
                <XStack alignItems="center" justifyContent="space-between" paddingBottom="$2">
                  <SizableText size="$3" color={colors.textMuted}>
                    {filteredResults.length} {filteredResults.length === 1 ? translate(displaySymbol, 'result') : translate(displaySymbol, 'results')}
                  </SizableText>
                </XStack>
              }
              ListFooterComponent={
                pageCount > 1 ? (
                  <XStack justifyContent="center" alignItems="center" gap="$2" paddingVertical="$4" flexWrap="wrap">
                    <Button size="$2" disabled={page <= 1} onPress={() => setPage((p) => Math.max(1, p - 1))}>
                      {translate(displaySymbol, 'previous')}
                    </Button>
                    {visiblePages.map((p, i) => {
                      const previous = visiblePages[i - 1];
                      return (
                        <XStack key={p} alignItems="center" gap="$2">
                          {previous && p - previous > 1 ? (
                            <SizableText size="$2" color={colors.textMuted}>…</SizableText>
                          ) : null}
                          <Button
                            size="$2"
                            backgroundColor={p === page ? '#5B7E6B' : '#3A3A3C'}
                            color={p === page ? 'white' : '#D1D5DB'}
                            onPress={() => setPage(p)}
                          >
                            {p}
                          </Button>
                        </XStack>
                      );
                    })}
                    <Button size="$2" disabled={page >= pageCount} onPress={() => setPage((p) => Math.min(pageCount, p + 1))}>
                      {translate(displaySymbol, 'next')}
                    </Button>
                  </XStack>
                ) : null
              }
            />
          )}
        </YStack>
      </YStack>
      <PreviewModal
        open={Boolean(previewResult)}
        onClose={() => setPreviewResult(null)}
        label={previewResult?.sourceTag}
        title={preview?.title || previewResult?.title}
        loading={previewLoading}
      >
        <YStack gap="$4">
          <SizableText size="$4" color={colors.text} lineHeight={28}>
            {preview?.content || previewResult?.snippet || translate(displaySymbol, 'preview_unavailable')}
          </SizableText>
          <XStack gap="$2" flexWrap="wrap">
            {previewResult ? (
              <Button size="$3" backgroundColor={colors.glow} color={colors.primary} onPress={() => handleSave(previewResult)} icon={<Bookmark size={12} color={colors.primary} />}>
                {translate(displaySymbol, 'save')}
              </Button>
            ) : null}
            {previewResult?.url ? (
              <Button size="$3" backgroundColor={colors.surface2} color={colors.text} onPress={() => Linking.openURL(previewResult.url).catch(() => {})}>
                {translate(displaySymbol, 'open_source')}
              </Button>
            ) : null}
          </XStack>
        </YStack>
      </PreviewModal>
    </SafeAreaView>
  );
}

