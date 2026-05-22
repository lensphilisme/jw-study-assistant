import type { Language } from '@/types';
import {
  fetchLocalizationStrings,
  fetchSearchSuggestions,
  fetchWolReferencePreview,
  fetchWolText,
  normalizeLanguage,
  refsFromHtml,
  resolveReference,
  resolveUniversalReference,
  stripHtml,
  tokenizeWolHtml,
  type UniversalReferenceResolution,
  type WolPreview,
  type WolReference,
  type WolReferenceToken,
} from '@/services/wolReferenceService';
import { getMediaLinks, getVideoSource, proxiedMediaUrl, searchJWOrg, searchWOL } from '@/services/jwApiService';
import { DISPLAY_LANGUAGES } from '@/services/i18nService';
import { getLanguageByCode, getLanguageBySymbol } from '@/services/languageService';
import {
  getSourceCache,
  setSourceCache,
  sourceCacheKey as makeSourceCacheKey,
} from '@/services/sourceCacheService';

export type SourceProvider = 'gateway' | 'wol-mcp-compatible' | 'jw-mcp-compatible' | 'jw-org-mcp-compatible' | 'direct-fallback';

export interface SourceGatewayResult<T> {
  provider: SourceProvider;
  data: T;
  sourceUrl?: string;
}

export interface StructuredSourcePart {
  title: string;
  html: string;
  text: string;
  tokens: WolReferenceToken[];
  references: WolReference[];
  media: Array<{ type: 'image' | 'video' | 'audio'; url: string; title?: string; alt?: string }>;
  questions: string[];
}

export interface NormalizedDailyText {
  date: string;
  scriptureRef: string;
  scriptureText: string;
  commentHtml: string;
  commentText: string;
  commentTokens: WolReferenceToken[];
  references: WolReference[];
  audio: { url: string; title?: string } | null;
  sourceUrl: string;
}

export interface GatewaySearchResult {
  id: string;
  title: string;
  snippet: string;
  url: string;
  sourceTag: string;
  sourceColor: string;
  provider: SourceProvider;
}

export interface ResolvedMeetingVideo {
  kind: 'video';
  title: string;
  url: string | null;
  poster?: string | null;
  subtitlesUrl?: string | null;
  captionsText: string;
  sourceUrl?: string;
  pub: string;
  issue?: string;
  track: number;
  langCode: string;
  label?: string;
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

export function normalizeAppLanguage(input?: Partial<Language> | null): Language {
  const byCode = input?.code ? getLanguageByCode(input.code) : undefined;
  const bySymbol = input?.symbol ? getLanguageBySymbol(input.symbol) : undefined;
  const known = byCode ?? bySymbol ?? DISPLAY_LANGUAGES[0];
  return {
    code: input?.code ?? known.code,
    symbol: input?.symbol ?? known.symbol,
    name: input?.name ?? known.name,
    englishName: input?.englishName ?? known.englishName,
    direction: input?.direction === 'rtl' ? 'rtl' : 'ltr',
    wolRegion: input?.wolRegion ?? known.wolRegion,
    wolLangParam: input?.wolLangParam ?? known.wolLangParam,
  };
}

export async function gatewayResolveReference(
  ref: WolReference | string,
  language?: Partial<Language> | null,
): Promise<SourceGatewayResult<WolPreview>> {
  const lang = normalizeAppLanguage(language);
  const cacheKey = sourceCacheKey(lang, 'reference', typeof ref === 'string' ? ref : ref.href || ref.text);
  const cached = await getCachedJson<WolPreview>(cacheKey);
  if (cached) return { provider: 'gateway', data: cached, sourceUrl: cached.sourceUrl };
  const data = await resolveReference(ref, lang);
  await setCachedJson(cacheKey, data);
  return {
    provider: 'wol-mcp-compatible',
    data,
    sourceUrl: typeof ref === 'string' ? undefined : ref.href,
  };
}

export async function gatewayResolveUniversalReference(
  ref: WolReference | string,
  language?: Partial<Language> | null,
): Promise<SourceGatewayResult<UniversalReferenceResolution>> {
  const lang = normalizeAppLanguage(language);
  const cacheKey = sourceCacheKey(lang, 'universal-reference', typeof ref === 'string' ? ref : ref.href || ref.text);
  const cached = await getCachedJson<UniversalReferenceResolution>(cacheKey);
  if (cached) return { provider: 'gateway', data: cached, sourceUrl: cached.sourceUrl };
  const data = await resolveUniversalReference(ref, lang);
  await setCachedJson(cacheKey, data);
  return {
    provider: 'wol-mcp-compatible',
    data,
    sourceUrl: typeof ref === 'string' ? data.sourceUrl : ref.href,
  };
}

export async function gatewaySearchWol(
  query: string,
  language: Language,
): Promise<SourceGatewayResult<unknown>> {
  const lang = normalizeAppLanguage(language);
  return {
    provider: 'wol-mcp-compatible',
    data: await searchWOL(query, lang.symbol, lang.wolRegion, lang.wolLangParam),
  };
}

export async function gatewaySearchJwOrg(
  query: string,
  language: Language,
): Promise<SourceGatewayResult<unknown>> {
  const lang = normalizeAppLanguage(language);
  return {
    provider: 'jw-org-mcp-compatible',
    data: await searchJWOrg(query, lang.symbol),
  };
}

export async function gatewayGetMediaByDocId(
  docId: string,
  language: Language,
  fileFormat = 'MP3',
): Promise<SourceGatewayResult<unknown>> {
  const lang = normalizeAppLanguage(language);
  return {
    provider: 'jw-mcp-compatible',
    data: await getMediaLinks(docId, lang.code, fileFormat),
  };
}

export async function gatewayGetVideoSource(
  pub: string,
  track: number,
  language: Language,
  issue?: string,
): Promise<SourceGatewayResult<string | null>> {
  const lang = normalizeAppLanguage(language);
  const raw: any = await getVideoSource(pub, track, lang.code, issue);
  const files = raw?.files?.[lang.code]?.MP4 ?? raw?.files?.[lang.code]?.M4V ?? [];
  const best = pickBestVideoFile(files);
  const url = best?.file?.url ?? null;
  return {
    provider: 'jw-mcp-compatible',
    data: proxiedMediaUrl(url),
    sourceUrl: url ?? undefined,
  };
}

export async function gatewayResolveMeetingVideo(
  video: { title?: string; pub: string; issue?: string; track: string | number; langwritten?: string },
  language?: Partial<Language> | null,
): Promise<SourceGatewayResult<ResolvedMeetingVideo>> {
  const lang = normalizeAppLanguage(language);
  const track = Number(video.track || 1);
  const langCode = lang.code || video.langwritten || 'E';
  const cacheKey = sourceCacheKey(lang, 'media-video', `${video.pub}:${video.issue ?? ''}:${track}:${langCode}`);
  const cached = await getCachedJson<ResolvedMeetingVideo>(cacheKey);
  if (cached) return { provider: 'gateway', data: cached, sourceUrl: cached.sourceUrl };

  const raw: any = await getVideoSource(video.pub, track, langCode, video.issue);
  const files = getVideoFiles(raw, langCode);
  const best = pickBestVideoFile(files);
  const sourceUrl = best?.file?.url ?? null;
  const rawSubtitles = best?.subtitles?.url ?? best?.subtitles?.[0]?.url ?? null;
  let captionsText = '';

  if (rawSubtitles) {
    try {
      const requestUrl = proxiedMediaUrl(rawSubtitles) ?? rawSubtitles;
      const response = await fetch(requestUrl, {
        headers: { Accept: 'text/vtt,text/plain,*/*' },
        signal: AbortSignal.timeout(10_000),
      });
      if (response.ok) captionsText = stripVttCaptions(await response.text());
    } catch {
      captionsText = '';
    }
  }

  const data: ResolvedMeetingVideo = {
    kind: 'video',
    title: best?.title || video.title || 'Video',
    url: proxiedMediaUrl(sourceUrl) ?? sourceUrl,
    poster: proxiedMediaUrl(best?.trackImage?.url) ?? best?.trackImage?.url ?? null,
    subtitlesUrl: proxiedMediaUrl(rawSubtitles) ?? rawSubtitles,
    captionsText,
    sourceUrl: sourceUrl ?? undefined,
    pub: video.pub,
    issue: video.issue,
    track,
    langCode,
    label: best?.label,
  };
  await setCachedJson(cacheKey, data);
  return { provider: 'jw-mcp-compatible', data, sourceUrl: sourceUrl ?? undefined };
}

function pickBestVideoFile(files: any[] = []) {
  if (!Array.isArray(files) || !files.length) return null;
  return files.find((file) => /480p/i.test(file?.label ?? ''))
    ?? files.find((file) => /360p/i.test(file?.label ?? ''))
    ?? files[0];
}

function getVideoFiles(raw: any, langCode: string): any[] {
  const direct = raw?.files?.[langCode]?.MP4 ?? raw?.files?.[langCode]?.M4V;
  if (Array.isArray(direct) && direct.length) return direct;
  const buckets = raw?.files ? Object.values(raw.files) as any[] : [];
  return buckets.flatMap((bucket) => [
    ...(Array.isArray(bucket?.MP4) ? bucket.MP4 : []),
    ...(Array.isArray(bucket?.M4V) ? bucket.M4V : []),
  ]);
}

export function stripVttCaptions(vtt: string): string {
  const seen = new Set<string>();
  return vtt
    .replace(/^\uFEFF?WEBVTT[\s\S]*?(?:\r?\n){2}/i, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line
      && !/^\d+$/.test(line)
      && !/-->/.test(line)
      && !/^(WEBVTT|NOTE|STYLE|REGION)\b/i.test(line))
    .map((line) => line.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim())
    .filter((line) => Boolean(line) && !seen.has(line) && Boolean(seen.add(line)))
    .join(' ');
}

export async function gatewaySearchSuggestions(query: string, language: Language) {
  return fetchSearchSuggestions(query, normalizeLanguage(normalizeAppLanguage(language)));
}

export async function gatewayLocalizationStrings(language: Language, type = 'documentOptions') {
  return fetchLocalizationStrings(normalizeLanguage(normalizeAppLanguage(language)), type);
}

export async function getDailyText({
  date,
  language,
}: {
  date?: Date;
  language: Language;
}): Promise<SourceGatewayResult<NormalizedDailyText>> {
  const appLanguage = normalizeAppLanguage(language);
  const normalized = normalizeLanguage(appLanguage);
  const d = date ?? new Date();
  const sourceUrl = `https://wol.jw.org/${normalized.symbol}/wol/dt/${normalized.wolRegion}/${normalized.wolLangParam}/${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
  const cacheKey = sourceCacheKey(appLanguage, 'daily-text', sourceUrl);
  const cached = await getCachedJson<NormalizedDailyText>(cacheKey);
  if (cached?.commentText && !/reyinyon|meeting program|Ann egzamine Ekriti yo chak jou/i.test(cached.commentText)) {
    return { provider: 'gateway', sourceUrl, data: cached };
  }
  const { text: html } = await fetchWolText(sourceUrl);
  const scriptureHtml = extractHtmlByClass(html, 'themeScrp');
  const commentHtml = extractDailyCommentHtml(html);
  const scriptureRef = stripHtml(scriptureHtml).replace(/\s+/g, ' ').trim();
  const firstScripture = refsFromHtml(scriptureHtml)[0];
  let scriptureText = '';

  if (firstScripture) {
    try {
      scriptureText = (await resolveReference(firstScripture, normalized)).exactText ?? '';
    } catch {
      scriptureText = '';
    }
  }

  const commentTokens = tokenizeWolHtml(commentHtml);
  const references = refsFromHtml(`${scriptureHtml}\n${commentHtml}`);
  const audioUrl = /<audio\b[^>]*src="([^"]+)"/i.exec(html)?.[1]
    ?? /data-audio-src="([^"]+)"/i.exec(html)?.[1]
    ?? '';

  const data = {
    date: d.toLocaleDateString(normalized.symbol === 'ht' ? 'ht-HT' : normalized.symbol, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }),
    scriptureRef,
    scriptureText,
    commentHtml,
    commentText: stripHtml(commentHtml).replace(/\s+/g, ' ').trim(),
    commentTokens,
    references,
    audio: audioUrl ? { url: audioUrl.startsWith('http') ? audioUrl : `https://wol.jw.org${audioUrl}` } : null,
    sourceUrl,
  };
  await setCachedJson(cacheKey, data);

  return {
    provider: 'wol-mcp-compatible',
    sourceUrl,
    data,
  };
}

export async function gatewaySearchAll(
  query: string,
  language: Language,
  options: { wolPages?: number; jwLimit?: number } = {},
): Promise<SourceGatewayResult<GatewaySearchResult[]>> {
  const lang = normalizeAppLanguage(language);
  const q = query.trim();
  const cacheKey = sourceCacheKey(lang, 'search', `${q}:${options.wolPages ?? 5}:${options.jwLimit ?? 50}`);
  const cached = await getCachedJson<GatewaySearchResult[]>(cacheKey);
  if (cached?.length) return { provider: 'gateway', data: cached };

  const wolPages = Array.from({ length: options.wolPages ?? 5 }, (_, i) => i + 1);
  const requests = [
    ...wolPages.map(async (page) => {
      const url = `https://wol.jw.org/${lang.symbol}/wol/s/${lang.wolRegion}/${lang.wolLangParam}?q=${encodeURIComponent(q)}&p=par&r=occ&st=a${page > 1 ? `&pg=${page}` : ''}`;
      const { text } = await fetchWolText(url, 'text/html,application/json,*/*');
      return parseWolSearchResults(text, `wol-${page}`, 'wol-mcp-compatible' as const);
    }),
    searchJWOrg(q, lang.symbol).then((data) => parseJsonSearchResults(data, 'jw-org', 'jw-org-mcp-compatible' as const)).catch(() => []),
  ];

  const results = (await Promise.all(requests)).flat();
  const deduped = Array.from(new Map(results.map((r) => [r.url || `${r.title}:${r.snippet}`, r])).values());
  await setCachedJson(cacheKey, deduped);
  return { provider: 'gateway', data: deduped };
}

export async function gatewayFetchSourceBody(
  source: { title?: string; url?: string; snippet?: string },
  language: Language,
): Promise<SourceGatewayResult<{ title: string; text: string; url?: string }>> {
  const lang = normalizeAppLanguage(language);
  const key = source.url || source.title || source.snippet || 'unknown';
  const cacheKey = sourceCacheKey(lang, 'source-body', key);
  const cached = await getCachedJson<{ title: string; text: string; url?: string }>(cacheKey);
  if (cached?.text) return { provider: 'gateway', data: cached, sourceUrl: cached.url };
  let text = source.snippet ?? '';
  let title = source.title ?? 'Source';
  if (source.url) {
    try {
      const doc = await gatewayGetWolDocument(source.url);
      title = doc.data.title || title;
      text = doc.data.text || text;
    } catch {
      try {
        const { text: html } = await fetchWolText(source.url);
        title = stripHtml(/<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html)?.[1] ?? title);
        text = stripHtml(extractMainHtml(html));
      } catch {
        text = source.snippet ?? '';
      }
    }
  }
  const data = { title, text, url: source.url };
  await setCachedJson(cacheKey, data);
  return { provider: 'gateway', data, sourceUrl: source.url };
}

export async function gatewayFetchSourcesForAi(
  sources: Array<{ title?: string; url?: string; snippet?: string }>,
  language: Language,
): Promise<{ content: string; citations: Array<{ title: string; url?: string }> }> {
  const bodies = await Promise.all(sources.map((source) => gatewayFetchSourceBody(source, language).then((r) => r.data)));
  return {
    content: bodies
      .filter((body) => body.text?.trim())
      .map((body, index) => `[${index + 1}] ${body.title}\nURL: ${body.url ?? ''}\n${body.text.slice(0, 4000)}`)
      .join('\n\n---\n\n'),
    citations: bodies.map((body) => ({ title: body.title, url: body.url })),
  };
}

export function structureHtmlPart(title: string, html: string): StructuredSourcePart {
  const tokens = tokenizeWolHtml(html);
  const references = refsFromHtml(html);
  const media = tokens
    .filter((token) => (token.kind === 'image' && token.src) || (token.kind === 'video' && token.href))
    .map((token) => token.kind === 'image'
      ? { type: 'image' as const, url: token.src ?? '', alt: token.alt }
      : { type: 'video' as const, url: token.href ?? '', title: token.text });
  return {
    title,
    html,
    text: stripHtml(html),
    tokens,
    references,
    media,
    questions: extractQuestions(stripHtml(html)),
  };
}

export async function gatewayGetWolDocument(url: string): Promise<SourceGatewayResult<StructuredSourcePart>> {
  const { text } = await fetchWolText(url);
  const title = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(text)?.[1] ?? /<title>([\s\S]*?)<\/title>/i.exec(text)?.[1] ?? 'WOL Document';
  return {
    provider: 'wol-mcp-compatible',
    data: structureHtmlPart(stripHtml(title), text),
    sourceUrl: url,
  };
}

function extractQuestions(text: string): string[] {
  return text
    .split(/\n|(?<=\?)\s+/)
    .map((line) => line.trim())
    .filter((line) => /\?$/.test(line))
    .slice(0, 12);
}

function extractHtmlByClass(html: string, className: string): string {
  const re = new RegExp(`<([a-z][\\w:-]*)\\b[^>]*class="[^"]*\\b${className}\\b[^"]*"[^>]*>([\\s\\S]*?)<\\/\\1>`, 'i');
  return re.exec(html)?.[2] ?? '';
}

function extractDailyCommentHtml(html: string): string {
  const theme = /<p\b[^>]*class="[^"]*\bthemeScrp\b[^"]*"[^>]*>[\s\S]*?<\/p>/i.exec(html);
  if (!theme) return cleanDailyCommentHtml(extractHtmlByClass(html, 'bodyTxt') || extractMainHtml(html));
  const afterTheme = html.slice(theme.index + theme[0].length);
  const bodyTxt = /^([\s\S]*?<div\b[^>]*class="[^"]*\bbodyTxt\b[^"]*"[^>]*>)([\s\S]*?)<\/div>/i.exec(afterTheme);
  if (bodyTxt?.[2]) return cleanDailyCommentHtml(bodyTxt[2]);
  const beforeNextCard = afterTheme.split(/<div\b[^>]*class="[^"]*(?:cardLine|documentNav|result|nav)[^"]*"/i)[0] ?? afterTheme;
  const paragraphs = beforeNextCard.match(/<p\b[\s\S]*?<\/p>/gi)?.join('\n') ?? beforeNextCard;
  return cleanDailyCommentHtml(paragraphs);
}

function extractMainHtml(html: string): string {
  return /<main\b[^>]*>([\s\S]*?)<\/main>/i.exec(html)?.[1]
    ?? /<article\b[^>]*>([\s\S]*?)<\/article>/i.exec(html)?.[1]
    ?? html;
}

function cleanDailyCommentHtml(html: string): string {
  return html
    .replace(/<p\b[^>]*class="[^"]*\bthemeScrp\b[^"]*"[^>]*>[\s\S]*?<\/p>/gi, '')
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '')
    .replace(/<nav\b[\s\S]*?<\/nav>/gi, '')
    .replace(/<header\b[\s\S]*?<\/header>/gi, '')
    .replace(/<footer\b[\s\S]*?<\/footer>/gi, '')
    .replace(/<div\b[^>]*class="[^"]*(?:cardLine|documentNav|result|pubNav|todayNav|itemData)[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '')
    .trim();
}

function tagFromUrl(url: string): string {
  const u = url.toLowerCase();
  if (u.includes('/wol/b/') || u.includes('/wol/bc/') || u.includes('/bible/')) return 'Bible';
  if (u.includes('/wol/d/') && /\/(?:w|ws|wp|w_)/.test(u)) return 'Watchtower';
  if (u.includes('/wol/d/') && /\/(?:g|g_)/.test(u)) return 'Awake!';
  if (u.includes('mwb')) return 'Meeting Workbook';
  if (u.includes('insight') || u.includes('/it-')) return 'Insight';
  if (u.includes('/mediaitems/') || u.includes('video')) return 'Video';
  return 'Article';
}

function parseWolSearchResults(html: string, prefix: string, provider: SourceProvider): GatewaySearchResult[] {
  const results: GatewaySearchResult[] = [];
  const docRe = /<ul\b[^>]*class="[^"]*resultContentDocument[^"]*"[^>]*>([\s\S]*?)<\/ul>/gi;
  let match: RegExpExecArray | null;
  let idx = 0;
  while ((match = docRe.exec(html)) !== null && idx < 200) {
    const block = match[1];
    const hrefM = /<li class="caption"[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i.exec(block);
    const rawUrl = hrefM?.[1] ?? '';
    const url = rawUrl.startsWith('http') ? rawUrl : `https://wol.jw.org${rawUrl}`;
    const title = stripHtml(hrefM?.[2] ?? '');
    const snippet = stripHtml(
      /<li class="searchResult[\s\S]*?<div class="document">([\s\S]*?)<\/div>/i.exec(block)?.[1]
        ?? /<li class="ref">([\s\S]*?)<\/li>/i.exec(block)?.[1]
        ?? ''
    );
    if (!title || !url) continue;
    const tag = tagFromUrl(url);
    results.push({
      id: `${prefix}-${idx++}`,
      title,
      snippet: snippet || 'Tap to read more',
      url,
      sourceTag: tag,
      sourceColor: SOURCE_COLORS[tag] ?? SOURCE_COLORS.Other,
      provider,
    });
  }
  return results;
}

function parseJsonSearchResults(data: unknown, prefix: string, provider: SourceProvider): GatewaySearchResult[] {
  const root: any = data;
  const items: any[] = root?.results ?? root?.data ?? root?.items ?? root?.contents ?? [];
  return items.slice(0, 100).map((item, index) => {
    const rawUrl = item.url ?? item.link ?? item.href ?? item.documentUrl ?? '';
    const url = rawUrl.startsWith('http') ? rawUrl : rawUrl ? `https://www.jw.org${rawUrl}` : '';
    const tag = tagFromUrl(url);
    return {
      id: `${prefix}-${index}`,
      title: item.title ?? item.name ?? item.caption ?? 'Untitled',
      snippet: item.snippet ?? item.description ?? item.content ?? item.summary ?? '',
      url,
      sourceTag: tag,
      sourceColor: SOURCE_COLORS[tag] ?? SOURCE_COLORS.Other,
      provider,
    };
  }).filter((item) => item.title && item.url);
}

function sourceCacheKey(language: Language, type: string, id: string): string {
  return makeSourceCacheKey(language, type, id);
}

async function getCachedJson<T>(key: string): Promise<T | null> {
  return getSourceCache<T>(key);
}

async function setCachedJson(key: string, value: unknown): Promise<void> {
  await setSourceCache(key, value);
}
