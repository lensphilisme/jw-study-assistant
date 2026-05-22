
import { Platform } from 'react-native';

export async function fetchWolTextWithRetry(url: string, accept = 'text/html,application/json,*/*'): Promise<{ text: string; contentType: string }> {
  return retryWithBackoff(() => fetchWolText(url, accept), 3, 500);
}

export interface WolLanguageConfig {
  symbol: string;
  wolRegion: string;
  wolLangParam: string;
  code?: string;
}

export interface WolReference {
  text: string;
  href: string;
  kind: 'bible' | 'publication' | 'footnote' | 'crossref';
}

export interface WolReferenceToken {
  kind: 'text' | 'bible' | 'publication' | 'footnote' | 'crossref' | 'image' | 'video';
  text: string;
  href?: string;
  src?: string;
  alt?: string;
}

export interface WolPreview {
  title: string;
  content: string;
  exactText?: string;
  type?: WolReference['kind'];
  url?: string;
  tokens?: WolReferenceToken[];
  nestedRefs?: WolReference[];
  media?: Array<{ type: 'image' | 'video' | 'audio'; url: string; title?: string; alt?: string }>;
  sourceUrl?: string;
}

export interface UniversalReferenceResolution {
  type: WolReference['kind'];
  title: string;
  exactText: string;
  tokens: WolReferenceToken[];
  nestedRefs: WolReference[];
  media: NonNullable<WolPreview['media']>;
  sourceUrl?: string;
}

const WOL_BASE = 'https://wol.jw.org';
const textCache = new Map<string, { text: string; contentType: string; expiresAt: number }>();
const previewCache = new Map<string, WolPreview>();

export function normalizeLanguage(input?: Partial<WolLanguageConfig> | null): WolLanguageConfig {
  return {
    symbol: input?.symbol ?? 'en',
    wolRegion: input?.wolRegion ?? 'r1',
    wolLangParam: input?.wolLangParam ?? 'lp-e',
    code: input?.code ?? 'E',
  };
}

export function decodeHtml(value: string): string {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&#160;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x2014;|&mdash;/g, '-')
    .replace(/&#x2013;|&ndash;/g, '-');
}

export function stripHtml(html: string): string {
  return decodeHtml(html)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

export function absoluteWolUrl(href: string): string {
  if (!href) return '';
  if (/^https?:\/\//i.test(href)) return href;
  if (href.startsWith('/')) return `${WOL_BASE}${href}`;
  return `${WOL_BASE}/${href}`;
}

function requestUrls(url: string, accept: string): string[] {
  if (Platform.OS !== 'web') return [url];
  const encoded = encodeURIComponent(url);
  const urls = [
    `http://localhost:3001/proxy?url=${encoded}`,
    url,
    `https://corsproxy.io/?${encoded}`,
  ];
  return urls;
}

// Utility: Retry with exponential backoff
export async function retryWithBackoff<T>(fn: () => Promise<T>, retries = 3, delay = 500): Promise<T> {
  let lastErr;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      await new Promise((res) => setTimeout(res, delay * Math.pow(2, i)));
    }
  }
  throw lastErr;
}

export async function fetchWolText(url: string, accept = 'text/html,application/json,*/*'): Promise<{ text: string; contentType: string }> {
  const cacheKey = `${accept}|${url}`;
  const cached = textCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return { text: cached.text, contentType: cached.contentType };
  }
  let lastError: unknown;
  for (const requestUrl of requestUrls(url, accept)) {
    try {
      const res = await fetch(requestUrl, {
        headers: { Accept: accept },
        signal: AbortSignal.timeout(12000),
      });
      if (!res.ok) throw new Error(`WOL HTTP ${res.status}`);
      const result = {
        text: await res.text(),
        contentType: res.headers.get('content-type') ?? '',
      };
      textCache.set(cacheKey, { ...result, expiresAt: Date.now() + 10 * 60 * 1000 });
      return result;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('WOL request failed');
// End fetchWolText
}

export function refsFromHtml(html: string): WolReference[] {
  const refs: WolReference[] = [];
  const seen = new Set<string>();
  const re = /<a\b([^>]*href="([^"]+)"[^>]*)>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const attrs = m[1] ?? '';
    const href = absoluteWolUrl(m[2] ?? '');
    const text = stripHtml(m[3] ?? '').trim();
    if (!href || !text) continue;
    const isBible = /\bclass="[^"]*\bb\b[^"]*"/i.test(attrs) || /\/wol\/(?:bc|b)\//.test(href);
    const isPublication = /\/wol\/(?:pc|d)\//.test(href);
    const isFootnote = /\/wol\/fn\//.test(href);
    const isCrossref = /\/wol\/dx\//.test(href) || text === '+';
    if (!isBible && !isPublication && !isFootnote && !isCrossref) continue;
    const key = `${text}|${href}`;
    if (seen.has(key)) continue;
    seen.add(key);
    refs.push({ text, href, kind: classifyReferenceKind(text, href, attrs) });
  }
  return refs;
}

function classifyReferenceKind(text: string, href: string, attrs = ''): WolReference['kind'] {
  if (/\/wol\/fn\//.test(href)) return 'footnote';
  if (/\/wol\/dx\//.test(href) || text.trim() === '+') return 'crossref';
  if (/\bclass="[^"]*\bb\b[^"]*"/i.test(attrs) || /\/wol\/(?:bc|b)\//.test(href)) return 'bible';
  return 'publication';
}

export function tokenizeWolHtml(html: string): WolReferenceToken[] {
  const tokens: WolReferenceToken[] = [];
  const re = /<a\b([^>]*)>([\s\S]*?)<\/a>|<img\b([^>]*)>/gi;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const before = stripHtml(html.slice(last, m.index));
    if (before) tokens.push({ kind: 'text', text: before });

    const imageAttrs = m[3] ?? '';
    if (imageAttrs) {
      const src =
        /data-img-size-lg="([^"]+)"/i.exec(imageAttrs)?.[1]
        || /data-img-size-md="([^"]+)"/i.exec(imageAttrs)?.[1]
        || /srcset="([^"]+)"/i.exec(imageAttrs)?.[1]?.split(',').pop()?.trim().split(/\s+/)[0]
        || /src="([^"]+)"/i.exec(imageAttrs)?.[1]
        || '';
      if (src && !/thumbnail|sprite|icon/i.test(src)) {
        tokens.push({
          kind: 'image',
          text: '',
          src: absoluteWolUrl(src),
          alt: decodeHtml(/alt="([^"]*)"/i.exec(imageAttrs)?.[1] ?? ''),
        });
      }
      last = re.lastIndex;
      continue;
    }

    const attrs = m[1] ?? '';
    const hrefValue = /href="([^"]*)"/i.exec(attrs)?.[1] ?? '';
    const href = hrefValue ? absoluteWolUrl(hrefValue) : '';
    const text = stripHtml(m[2] ?? '').trim();
    const isBible = /\bclass="[^"]*\bb\b[^"]*"/i.test(attrs) || /\/wol\/(?:bc|b)\//.test(href);
    const isPublication = /\/wol\/(?:pc|d)\//.test(href);
    const isFootnote = /\/wol\/fn\//.test(href);
    const isCrossref = /\/wol\/dx\//.test(href) || text === '+';
    const hasVideo = /\bdata-video="/i.test(attrs) || /(?:pub-media|\/mediaitems\/|video)/i.test(href);
    if (text && hasVideo) {
      tokens.push({ kind: 'video', text, href });
      last = re.lastIndex;
      continue;
    }
    // Treat <a> with text '+' as an inline cross-reference. It is not the end of verse text.
    if (href && text === '+') {
      tokens.push({ kind: 'crossref', text, href });
    } else if (href && text && (isBible || isPublication || isFootnote || isCrossref)) {
      tokens.push({ kind: classifyReferenceKind(text, href, attrs), text, href });
    } else if (text) {
      tokens.push({ kind: 'text', text });
    }
    last = re.lastIndex;
  }
  const rest = stripHtml(html.slice(last));
  if (rest) tokens.push({ kind: 'text', text: rest });
  return mergeTextTokens(tokens);
}

function mergeTextTokens(tokens: WolReferenceToken[]): WolReferenceToken[] {
  const out: WolReferenceToken[] = [];
  for (const token of tokens) {
    const prev = out[out.length - 1];
    if (token.kind === 'text' && prev?.kind === 'text') {
      prev.text = `${prev.text} ${token.text}`
        .replace(/[ \t]+/g, ' ')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n[ \t]+/g, '\n')
        .trim();
    } else {
      out.push(token);
    }
  }
  return out;
}

function parseChapterHref(href: string, label = ''): { book: string; chapter: string; verses: number[]; bible: string } | null {
  const url = absoluteWolUrl(href);
  const pathMatch = /\/wol\/b\/[^/]+\/[^/]+\/([^/?#]+)\/(\d+)\/(\d+)/.exec(url);
  if (!pathMatch) return null;
  const [, bible, book, chapter] = pathMatch;
  const spec = /[#?&]v=([^&#]+)/.exec(url)?.[1] ?? '';
  const verses = parseVerseSpec(spec, Number(book), Number(chapter));
  return {
    bible,
    book,
    chapter,
    verses: verses.length ? verses : parseVerseLabel(label, Number(chapter)),
  };
}

function parseVerseSpec(spec: string, fallbackBook: number, fallbackChapter: number): number[] {
  const verses = new Set<number>();
  const decoded = decodeURIComponent(spec).replace(/;/g, ',');
  for (const part of decoded.split(',')) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    const range = /(?:(\d+):(\d+):)?(\d+)\s*-\s*(?:(\d+):(\d+):)?(\d+)/.exec(trimmed);
    if (range) {
      const startBook = Number(range[1] ?? fallbackBook);
      const startChapter = Number(range[2] ?? fallbackChapter);
      const startVerse = Number(range[3]);
      const endBook = Number(range[4] ?? startBook);
      const endChapter = Number(range[5] ?? startChapter);
      const endVerse = Number(range[6]);
      if (startBook === fallbackBook && endBook === fallbackBook && startChapter === fallbackChapter && endChapter === fallbackChapter) {
        const min = Math.min(startVerse, endVerse);
        const max = Math.max(startVerse, endVerse);
        for (let v = min; v <= max; v++) verses.add(v);
      }
      continue;
    }

    const single = /(?:(\d+):(\d+):)?(\d+)/.exec(trimmed);
    if (!single) continue;
    const book = Number(single[1] ?? fallbackBook);
    const chapter = Number(single[2] ?? fallbackChapter);
    const verse = Number(single[3]);
    if (book === fallbackBook && chapter === fallbackChapter) verses.add(verse);
  }
  return Array.from(verses).sort((a, b) => a - b);
}

function parseVerseLabel(label: string, fallbackChapter: number): number[] {
  const normalized = decodeHtml(label)
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
  const chapterVerse = /(?:^|[^\d])(\d+)\s*:\s*([0-9,\s;-]+(?:\s*-\s*\d+)?)/.exec(normalized);
  const verseSpec = chapterVerse?.[1] && Number(chapterVerse[1]) === fallbackChapter
    ? chapterVerse[2]
    : '';
  if (!verseSpec) return [];

  const verses = new Set<number>();
  for (const part of verseSpec.replace(/;/g, ',').split(',')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const range = /^(\d+)\s*-\s*(\d+)$/.exec(trimmed);
    if (range) {
      const start = Number(range[1]);
      const end = Number(range[2]);
      for (let v = Math.min(start, end); v <= Math.max(start, end); v++) verses.add(v);
      continue;
    }
    const single = /^(\d+)$/.exec(trimmed);
    if (single) verses.add(Number(single[1]));
  }
  return Array.from(verses).sort((a, b) => a - b);
}

function extractVerseHtmlFromChapter(html: string, book: string, chapter: string, verses: number[]): string {
  const blocks: string[] = [];
  for (const verse of verses) {
    const idPrefix = `v${Number(book)}-${Number(chapter)}-${Number(verse)}-`;
    const firstId = new RegExp(`id=["']${idPrefix}1["']`, 'i').exec(html);
    if (!firstId?.index && firstId?.index !== 0) continue;

    const start = html.lastIndexOf('<span', firstId.index);
    if (start < 0) continue;

    const nextVerse = new RegExp(`id=["']v${Number(book)}-${Number(chapter)}-(\\d+)-\\d+["']`, 'gi');
    let end = html.length;
    let m: RegExpExecArray | null;
    while ((m = nextVerse.exec(html)) !== null) {
      const nextNum = Number(m[1]);
      if (m.index > firstId.index && nextNum > Number(verse)) {
        const nextStart = html.lastIndexOf('<span', m.index);
        end = nextStart >= 0 ? nextStart : m.index;
        break;
      }
    }

    blocks.push(html.slice(start, end));
  }
  return blocks.join('\n');
}

function markdownLinksToHtml(markdown: string): string {
  return markdown
    .replace(/\[([^\]]+)\]\((https?:\/\/wol\.jw\.org\/[^)]+)\)/g, (_m, label, href) => {
      const className = /\/wol\/(?:bc|b)\//.test(String(href)) || label === '+' ? ' class="b"' : '';
      return `<a href="${href}"${className}>${label}</a>`;
    })
    .replace(/\n{2,}/g, '<br>');
}

function extractVerseHtmlFromMarkdown(markdown: string, verses: number[]): string {
  if (!/^Title:|Markdown Content:/i.test(markdown)) return '';
  const wanted = new Set(verses);
  const markerRe = /\[(\d+)\]\(https:\/\/wol\.jw\.org\/[^)]+\/wol\/dx\/[^)]+\)/g;
  const markers: Array<{ verse: number; index: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = markerRe.exec(markdown)) !== null) {
    markers.push({ verse: Number(m[1]), index: m.index });
  }
  if (!markers.length) return '';

  const blocks: string[] = [];
  for (let i = 0; i < markers.length; i++) {
    const marker = markers[i];
    if (!wanted.has(marker.verse)) continue;
    const next = markers.slice(i + 1).find((item) => item.verse > marker.verse);
    blocks.push(markdown.slice(marker.index, next?.index ?? markdown.length));
  }
  return markdownLinksToHtml(blocks.join('\n'));
}

function fetchBibleHtmlPreviewFromLabel(html: string, label: string, href: string): WolPreview | null {
  const chapter = /(?:^|[^\d])(\d+)\s*:\s*/.exec(decodeHtml(label))?.[1];
  if (!chapter) return null;
  const verses = parseVerseLabel(label, Number(chapter));
  if (!verses.length) return null;
  const firstVerse = verses[0];
  const id = new RegExp(`id=["']v(\\d+)-${Number(chapter)}-${Number(firstVerse)}-\\d+["']`, 'i').exec(html);
  if (!id) return null;
  const book = id[1];
  const verseHtml = extractVerseHtmlFromChapter(html, book, chapter, verses);
  const verseText = stripHtml(verseHtml).split('\n').map(removeLeadingVerseNumber).join('\n').trim();
  if (!verseText) return null;
  return {
    title: label,
    content: verseText,
    url: href,
    tokens: tokenizeWolHtml(verseHtml),
  };
}

function removeLeadingVerseNumber(text: string): string {
  return text.replace(/^\d+\s*/, '').trim();
}

function jsonPreview(raw: string): WolPreview | null {
  try {
    const json = JSON.parse(raw);
    const item = Array.isArray(json?.items) ? json.items[0] : null;
    if (!item) return null;
    const contentHtml = String(item.content ?? '');
    return {
      title: String(json.title || item.title || item.caption || 'Reference'),
      content: stripHtml(contentHtml),
      exactText: stripHtml(contentHtml),
      url: item.url ? absoluteWolUrl(String(item.url)) : undefined,
      tokens: tokenizeWolHtml(contentHtml),
      nestedRefs: refsFromHtml(contentHtml),
      media: mediaFromTokens(tokenizeWolHtml(contentHtml)),
      sourceUrl: item.url ? absoluteWolUrl(String(item.url)) : undefined,
    };
  } catch {
    return null;
  }
}

async function fetchBibleHrefPreview(ref: WolReference): Promise<WolPreview | null> {
  const chapter = parseChapterHref(ref.href, ref.text);
  if (!chapter || chapter.verses.length === 0) return null;

  const cleanUrl = ref.href.split('#')[0].split('?')[0];
  const { text } = await fetchWolText(cleanUrl, 'text/html,*/*');
  const verseHtml =
    extractVerseHtmlFromChapter(text, chapter.book, chapter.chapter, chapter.verses)
    || extractVerseHtmlFromMarkdown(text, chapter.verses);
  const verseText = stripHtml(verseHtml).split('\n').map(removeLeadingVerseNumber).join('\n').trim();
  if (!verseText) return null;

  return {
    title: ref.text,
    content: verseText,
    exactText: verseText,
    type: ref.kind,
    url: ref.href,
    tokens: tokenizeWolHtml(verseHtml),
    nestedRefs: refsFromHtml(verseHtml),
    media: mediaFromTokens(tokenizeWolHtml(verseHtml)),
    sourceUrl: ref.href,
  };
}

function extractReadableArticleHtml(html: string): string {
  const candidates = [
    /<article\b[^>]*>([\s\S]*?)<\/article>/i,
    /<div\b[^>]*class=["'][^"']*(?:bodyTxt|article|document|pubcontent)[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*(?:<div\b[^>]*class=["'][^"']*nav|<footer|<\/main)/i,
    /<main\b[^>]*>([\s\S]*?)<\/main>/i,
    /<body\b[^>]*>([\s\S]*?)<\/body>/i,
  ];

  for (const re of candidates) {
    const match = re.exec(html)?.[1] ?? '';
    const text = stripHtml(match);
    if (text.length > 80) return match;
  }
  return html;
}

function extractHashRangeHtml(html: string, href: string): string {
  const h = /[#?&]h=([^&#]+)/.exec(href)?.[1];
  if (!h) return '';
  const pids = new Set<number>();
  const decoded = decodeURIComponent(h).replace(/;/g, ',');
  for (const part of decoded.split(',')) {
    const range = /(\d+)(?::\d+)?\s*-\s*(\d+)(?::\d+)?/.exec(part);
    if (range) {
      const start = Number(range[1]);
      const end = Number(range[2]);
      for (let pid = Math.min(start, end); pid <= Math.max(start, end); pid++) pids.add(pid);
      continue;
    }
    const single = /(\d+)(?::\d+)?/.exec(part);
    if (single) pids.add(Number(single[1]));
  }

  const blocks: string[] = [];
  for (const pid of pids) {
    const block =
      new RegExp(`<p\\b(?=[^>]*(?:id=["']p${pid}["']|data-pid=["']${pid}["']))[^>]*>[\\s\\S]*?<\\/p>`, 'i').exec(html)?.[0]
      ?? new RegExp(`<h[1-6]\\b(?=[^>]*(?:id=["']p${pid}["']|data-pid=["']${pid}["']))[^>]*>[\\s\\S]*?<\\/h[1-6]>`, 'i').exec(html)?.[0]
      ?? new RegExp(`<li\\b(?=[^>]*(?:id=["']p${pid}["']|data-pid=["']${pid}["']))[^>]*>[\\s\\S]*?<\\/li>`, 'i').exec(html)?.[0]
      ?? '';
    if (block) blocks.push(block);
  }
  return blocks.join('\n');
}

export async function fetchWolReferencePreview(ref: WolReference): Promise<WolPreview> {
  const cacheKey = `${ref.kind}|${ref.text}|${absoluteWolUrl(ref.href)}`;
  const cached = previewCache.get(cacheKey);
  if (cached) return cached;
  const timeout = (ms: number) => new Promise((_, reject) => setTimeout(() => reject(new Error('Reference preview timed out')), ms));
  try {
      const result = await Promise.race([
        (async (): Promise<WolPreview> => {
        const isJsonPopup = /\/wol\/(?:bc|pc|fn)\//.test(ref.href);
        if (isJsonPopup) {
          const { text } = await fetchWolTextWithRetry(ref.href, 'application/json,text/html,*/*');
          const parsed = jsonPreview(text);
          if (parsed?.content && ref.kind === 'bible') return parsed;
          if (parsed?.url && ref.kind === 'bible' && /\/wol\/b\//.test(parsed.url)) {
            const exact = await fetchBibleHrefPreview({
              text: parsed.title || ref.text,
              href: parsed.url,
              kind: 'bible',
            }).catch(() => null);
            if (exact?.content) return exact;
          }
          if (parsed?.content) return parsed;
        }

        const exactBible = await fetchBibleHrefPreview(ref).catch(() => null);
        if (exactBible?.content) return exactBible;
        if (ref.kind === 'bible') {
          const { text } = await fetchWolTextWithRetry(ref.href);
          const exactFromLabel = fetchBibleHtmlPreviewFromLabel(text, ref.text, ref.href);
          if (exactFromLabel?.content) return exactFromLabel;
        }
        if (ref.kind === 'bible' && /\/wol\/b\//.test(ref.href)) {
          throw new Error('Could not isolate the requested Bible verse range');
        }

        const { text, contentType } = await fetchWolTextWithRetry(ref.href);
        if (/json/i.test(contentType) || /^\s*[{[]/.test(text)) {
          const parsed = jsonPreview(text);
          if (parsed?.content) return parsed;
        }
        // Publication section extraction: if paragraph markers are present, extract only those paragraphs.
        let articleHtml = '';
        let title = '';
        let content = '';
        if (ref.kind === 'publication' && hasParagraphMarker(ref.text)) {
          // Try to extract all requested paragraphs (e.g., ¶ 8-9, § 8, par. 8)
          articleHtml = extractHashRangeHtml(text, ref.href);
          // If not found, fallback to best available content
          if (!articleHtml || articleHtml.length < 40) articleHtml = extractReadableArticleHtml(text);
          title = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(articleHtml)?.[1]
            ?? /<title>([\s\S]*?)<\/title>/i.exec(text)?.[1]
            ?? ref.text;
          content = stripHtml(articleHtml).slice(0, 4000);
        } else {
          articleHtml = extractHashRangeHtml(text, ref.href) || extractReadableArticleHtml(text);
          title = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(articleHtml)?.[1]
            ?? /<title>([\s\S]*?)<\/title>/i.exec(text)?.[1]
            ?? ref.text;
          content = stripHtml(articleHtml).slice(0, 4000);
        }
        if (!content) throw new Error('No content found for this reference.');
        return {
          title: stripHtml(title),
          content,
          exactText: content,
          type: ref.kind,
          url: ref.href,
          tokens: tokenizeWolHtml(articleHtml),
          nestedRefs: refsFromHtml(articleHtml),
          media: mediaFromTokens(tokenizeWolHtml(articleHtml)),
          sourceUrl: ref.href,
        };
      })(),
      timeout(15000),
    ]);
    previewCache.set(cacheKey, result as WolPreview);
    return result as WolPreview;
  } catch (err: any) {
    // Always return a fallback preview with error message
    return {
      title: ref.text,
      content: typeof err?.message === 'string' ? err.message : 'Could not load this reference.',
      exactText: typeof err?.message === 'string' ? err.message : 'Could not load this reference.',
      type: ref.kind,
      url: ref.href,
      tokens: [{ kind: 'text', text: typeof err?.message === 'string' ? err.message : 'Could not load this reference.' }],
      nestedRefs: [],
      media: [],
      sourceUrl: ref.href,
    };
  }
}

function mediaFromTokens(tokens: WolReferenceToken[]): WolPreview['media'] {
  return tokens
    .filter((token) => (token.kind === 'image' && token.src) || (token.kind === 'video' && token.href))
    .map((token) => token.kind === 'image'
      ? { type: 'image' as const, url: token.src ?? '', alt: token.alt }
      : { type: 'video' as const, url: token.href ?? '', title: token.text });
}

export async function resolveReference(
  ref: WolReference | string,
  language?: Partial<WolLanguageConfig> | null,
): Promise<WolPreview> {
  const lang = normalizeLanguage(language);
  const normalized: WolReference = typeof ref === 'string'
    ? {
        text: ref,
        href: `${WOL_BASE}/${lang.symbol}/wol/s/${lang.wolRegion}/${lang.wolLangParam}?q=${encodeURIComponent(ref)}&p=par`,
        kind: /^\d?\s*[A-Z][\w.]*\s+\d+:\d+/i.test(ref) ? 'bible' : 'publication',
      }
    : { ...ref, href: absoluteWolUrl(ref.href) };
  return fetchWolReferencePreview(normalized);
}

export async function resolveUniversalReference(
  ref: WolReference | string,
  language?: Partial<WolLanguageConfig> | null,
): Promise<UniversalReferenceResolution> {
  const preview = await resolveReference(ref, language);
  const type = preview.type ?? (typeof ref === 'string'
    ? (/^\d?\s*[A-Z][\w.]*\s+\d+:\d+/i.test(ref) ? 'bible' : 'publication')
    : ref.kind);
  const fallbackTokens: WolReferenceToken[] = preview.content
    ? [{ kind: 'text', text: preview.content }]
    : [];
  return {
    type,
    title: preview.title,
    exactText: preview.exactText ?? preview.content,
    tokens: preview.tokens?.length ? preview.tokens : fallbackTokens,
    nestedRefs: preview.nestedRefs ?? [],
    media: preview.media ?? [],
    sourceUrl: preview.sourceUrl ?? preview.url,
  };
}

function hasParagraphMarker(text: string): boolean {
  return /(?:[¶§]|\u00c2\u00b6|\u00c2\u00a7|par\.?|paras?\.?)\s*\d+(?:\s*[-,]\s*\d+)*/i.test(text);
}

export async function fetchSearchSuggestions(
  query: string,
  language: WolLanguageConfig,
): Promise<Array<{ query: string; caption: string; label?: string | null }>> {
  if (!query.trim()) return [];
  const lang = normalizeLanguage(language);
  const url = `${WOL_BASE}/wol/sg/${lang.wolRegion}/${lang.wolLangParam}?q=${encodeURIComponent(query.trim())}`;
  const { text } = await fetchWolText(url, 'application/json,*/*');
  const json = JSON.parse(text);
  return Array.isArray(json?.items) ? json.items : [];
}

export async function fetchLocalizationStrings(language: WolLanguageConfig, type = 'documentOptions'): Promise<any> {
  const lang = normalizeLanguage(language);
  const url = `${WOL_BASE}/wol/ls?locale=${encodeURIComponent(lang.symbol)}&type=${encodeURIComponent(type)}&wtlocale=${encodeURIComponent(lang.code ?? 'E')}`;
  const { text } = await fetchWolText(url, 'application/json,*/*');
  return JSON.parse(text);
}
