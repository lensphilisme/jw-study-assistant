// ============================================================
// JW Study Assistant — JW API Service
// All requests use 10-second AbortController timeouts.
// ============================================================
import type { BibleBook } from '../types';
import { Platform } from 'react-native';

// -----------------------------------------------------------
// Base URLs
// -----------------------------------------------------------
const BASE_CDN = 'https://b.jw-cdn.org/apis';
const BASE_JW  = 'https://www.jw.org';
const BASE_WOL = 'https://wol.jw.org';

// -----------------------------------------------------------
// Internal helpers
// -----------------------------------------------------------

function proxiedUrl(url: string): string {
  if (Platform.OS !== 'web') return url;
  if (!/^https?:\/\//i.test(url)) return url;
  return `http://localhost:3001/proxy?url=${encodeURIComponent(url)}`;
}

export function proxiedMediaUrl(url?: string | null): string | null {
  if (!url) return null;
  return proxiedUrl(url);
}

/** Standard fetch wrapper with 10-second timeout and JSON parsing */
async function jwFetch<T = unknown>(
  url: string,
  opts?: RequestInit
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(proxiedUrl(url), {
      ...opts,
      signal: controller.signal,
      headers: {
        Accept: 'application/json, text/html, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        ...opts?.headers,
      },
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`JW API error ${response.status} for: ${url}`);
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      return (await response.json()) as T;
    }
    return (await response.text()) as unknown as T;
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

/** Zero-pad a number to 2 digits */
function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

// -----------------------------------------------------------
// Daily Text
// -----------------------------------------------------------

/**
 * Fetch the daily text from WOL for a given language and optional date.
 *
 * URL pattern:
 * https://wol.jw.org/{langSymbol}/wol/dt/{wolRegion}/{wolLangParam}/{year}/{month}/{day}
 *
 * Example:
 * https://wol.jw.org/en/wol/dt/r1/lp-e/2026/5/7
 */
export async function getDailyText(
  langSymbol: string,
  wolRegion: string,
  wolLangParam: string,
  date: Date = new Date()
): Promise<unknown> {
  const y = date.getFullYear();
  const m = date.getMonth() + 1; // 1-based, no padding per WOL spec
  const d = date.getDate();
  const url = `${BASE_WOL}/${langSymbol}/wol/dt/${wolRegion}/${wolLangParam}/${y}/${m}/${d}`;
  return jwFetch(url);
}

// -----------------------------------------------------------
// Meeting Workbook
// -----------------------------------------------------------

/**
 * Fetch meeting workbook publication media links.
 *
 * URL pattern (media links):
 * https://b.jw-cdn.org/apis/pub-media/GETPUBMEDIALINKS
 *   ?pub=mwb&issue=202605&langwritten=E&fileformat=MP3&output=json
 *
 * URL pattern (text CMS):
 * https://b.jw-cdn.org/apis/pub-media/v1/get-publication
 *   ?pub=mwb&issue=202605&langwritten=E&txtCMS=1
 */
export async function getMeetingWorkbook(
  langCode: string,
  pubCode: string = 'mwb',
  issue: string   // e.g. "202605"
): Promise<unknown> {
  const mediaUrl = (
    `${BASE_CDN}/pub-media/GETPUBMEDIALINKS` +
    `?pub=${pubCode}&issue=${issue}&langwritten=${langCode}&fileformat=MP3&output=json`
  );

  const textUrl = (
    `${BASE_CDN}/pub-media/v1/get-publication` +
    `?pub=${pubCode}&issue=${issue}&langwritten=${langCode}&txtCMS=1`
  );

  const [mediaLinks, textContent] = await Promise.allSettled([
    jwFetch(mediaUrl),
    jwFetch(textUrl),
  ]);

  return {
    mediaLinks: mediaLinks.status === 'fulfilled' ? mediaLinks.value : null,
    textContent: textContent.status === 'fulfilled' ? textContent.value : null,
  };
}

// -----------------------------------------------------------
// WOL Meeting Schedule
// -----------------------------------------------------------

/**
 * Fetch WOL meeting schedule for a specific ISO week.
 *
 * URL pattern:
 * https://wol.jw.org/{langSymbol}/wol/meetings/{wolRegion}/{wolLangParam}/{year}/{week}
 *
 * Example:
 * https://wol.jw.org/en/wol/meetings/r1/lp-e/2026/19
 */
export async function getWOLMeetingSchedule(
  langSymbol: string,
  wolRegion: string,
  wolLangParam: string,
  year: number,
  week: number
): Promise<unknown> {
  const url = `${BASE_WOL}/${langSymbol}/wol/meetings/${wolRegion}/${wolLangParam}/${year}/${week}`;
  return jwFetch(url);
}

// -----------------------------------------------------------
// Watchtower Issue
// -----------------------------------------------------------

/**
 * Fetch Watchtower study edition publication links.
 *
 * URL pattern:
 * https://b.jw-cdn.org/apis/pub-media/GETPUBMEDIALINKS
 *   ?pub=w&issue=202602&langwritten=E&output=json
 */
export async function getWatchtowerIssue(
  langCode: string,
  issue: string   // e.g. "202602"
): Promise<unknown> {
  const url = (
    `${BASE_CDN}/pub-media/GETPUBMEDIALINKS` +
    `?pub=w&issue=${issue}&langwritten=${langCode}&output=json`
  );
  return jwFetch(url);
}

// -----------------------------------------------------------
// Publication Content by DocId
// -----------------------------------------------------------

/**
 * Fetch full publication text content by document ID.
 *
 * Primary: b.jw-cdn.org pub-media v1 (JSON with items[].content HTML).
 * Fallback: WOL public HTML page for the article — wrapped to match the
 *           { items: [{ content, title }] } shape so callers don't change.
 */
export async function getPublicationContent(
  docId: string,
  langCode: string,
  wolSymbol: string = 'en',
  wolRegion: string = 'r1',
  wolLang: string = 'lp-e',
): Promise<unknown> {
  const url = (
    `${BASE_CDN}/pub-media/v1/get-publication` +
    `?docid=${docId}&langwritten=${langCode}&txtCMS=1`
  );

  // Try primary CDN endpoint
  try {
    const data = await jwFetch<any>(url);
    const items = Array.isArray(data) ? data : data?.items;
    const first = Array.isArray(items) ? items[0] : null;
    if (first?.content) return data;
  } catch {
    // fall through to WOL fallback
  }

  // Fallback: scrape the actual WOL article HTML
  try {
    const wolUrl = `${BASE_WOL}/${wolSymbol}/wol/d/${wolRegion}/${wolLang}/${docId}`;
    const html = await jwFetch<string>(wolUrl, { headers: { Accept: 'text/html' } });
    if (typeof html === 'string' && html.length > 0) {
      // Extract main article container
      const articleMatch =
        /<article[^>]*class="[^"]*(?:docClass|article)[^"]*"[^>]*>([\s\S]*?)<\/article>/i.exec(html)
        ?? /<div[^>]*id="article"[^>]*>([\s\S]*?)<\/div>\s*<\/article>/i.exec(html)
        ?? /<div[^>]*class="[^"]*article[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/main>/i.exec(html);
      const content = articleMatch ? articleMatch[1] : html;

      const titleMatch =
        /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html)
        ?? /<title>([^<]+)<\/title>/i.exec(html);
      const title = titleMatch
        ? titleMatch[1].replace(/<[^>]+>/g, '').trim()
        : 'Article';

      return { items: [{ content, title }] };
    }
  } catch {
    // ignore
  }

  return { items: [] };
}

// -----------------------------------------------------------
// Media Links by DocId
// -----------------------------------------------------------

/**
 * Fetch media (audio/video) links for a document ID.
 *
 * URL pattern:
 * https://b.jw-cdn.org/apis/pub-media/GETPUBMEDIALINKS
 *   ?docid={docId}&output=json&fileformat=MP3&langwritten={langCode}
 */
export async function getMediaLinks(
  docId: string,
  langCode: string,
  fileFormat: string = 'MP3'
): Promise<unknown> {
  const url = (
    `${BASE_CDN}/pub-media/GETPUBMEDIALINKS` +
    `?docid=${docId}&output=json&fileformat=${fileFormat}&langwritten=${langCode}`
  );
  return jwFetch(url);
}

// -----------------------------------------------------------
// JW.org Search
// -----------------------------------------------------------

/**
 * Search JW.org for articles, publications, etc.
 *
 * URL pattern:
 * https://www.jw.org/{langSymbol}/search/results/all?q={query}&sort=rel
 */
export async function searchJWOrg(
  query: string,
  langSymbol: string,
  sort: string = 'rel'
): Promise<unknown> {
  const encoded = encodeURIComponent(query);
  const url = `${BASE_JW}/${langSymbol}/search/results/all?q=${encoded}&sort=${sort}`;
  return jwFetch(url);
}

// -----------------------------------------------------------
// WOL Search
// -----------------------------------------------------------

/**
 * Search the WOL (Watchtower Online Library).
 *
 * URL pattern:
 * https://wol.jw.org/{langSymbol}/wol/s/{wolRegion}/{wolLangParam}
 *   ?q={query}&p=par&r=occ&st=a
 */
export async function searchWOL(
  query: string,
  langSymbol: string,
  wolRegion: string,
  wolLangParam: string
): Promise<unknown> {
  const encoded = encodeURIComponent(query);
  const url = (
    `${BASE_WOL}/${langSymbol}/wol/s/${wolRegion}/${wolLangParam}` +
    `?q=${encoded}&p=par&r=occ&st=a`
  );
  return jwFetch(url);
}

// -----------------------------------------------------------
// Bible Books
// -----------------------------------------------------------

/**
 * Fetch Bible book list (NWT) for a language.
 *
 * Uses the pub-media v1 endpoint for the NWT publication.
 * Returns a normalized BibleBook[] array.
 */
export async function getBibleBooks(langSymbol: string): Promise<BibleBook[]> {
  // We derive the language code from the symbol for the langwritten param
  // For the NWT index, use the CDN GETPUBMEDIALINKS with pub=nwtsty
  const url = (
    `${BASE_CDN}/pub-media/GETPUBMEDIALINKS` +
    `?pub=nwtsty&fileformat=MP3&langwritten=${langSymbol.toUpperCase()}&output=json`
  );

  try {
    const data = await jwFetch<{ pubMediaLinks?: { booknum?: number; files?: unknown[] }[] }>(url);
    // CDN returns track-based entries; map to BibleBook shape
    if (
      data &&
      typeof data === 'object' &&
      'pubMediaLinks' in data &&
      Array.isArray((data as Record<string, unknown>).pubMediaLinks)
    ) {
      const links = (data as { pubMediaLinks: Array<{ booknum?: number; docid?: string }> }).pubMediaLinks;
      return links
        .filter((l) => typeof l.booknum === 'number')
        .map((l, idx) => ({
          number: l.booknum ?? idx + 1,
          standardName: `Book ${l.booknum ?? idx + 1}`,
          standardAbbreviation: '',
          chapterCount: 0,
          url: `${BASE_WOL}/${langSymbol}/wol/binav/r1/lp-e/${l.docid ?? ''}`,
        }));
    }
    return [];
  } catch {
    return [];
  }
}

// -----------------------------------------------------------
// Video Source
// -----------------------------------------------------------

/**
 * Fetch MP4/M4V media links for a video publication track.
 *
 * URL pattern:
 * https://b.jw-cdn.org/apis/pub-media/GETPUBMEDIALINKS
 *   ?pub={pubCode}&track={track}&langwritten={langCode}&fileformat=MP4,M4V&output=json
 */
export async function getVideoSource(
  pubCode: string,
  track: number,
  langCode: string,
  issue?: string
): Promise<unknown> {
  const url = (
    `${BASE_CDN}/pub-media/GETPUBMEDIALINKS` +
    `?pub=${pubCode}${issue ? `&issue=${issue}` : ''}&track=${track}&langwritten=${langCode}&fileformat=MP4,M4V&output=json`
  );
  return jwFetch(url);
}

// -----------------------------------------------------------
// Convenience: WOL article by docId
// -----------------------------------------------------------

/**
 * Fetch a WOL article using its numeric document ID.
 *
 * URL pattern:
 * https://wol.jw.org/{langSymbol}/wol/d/{wolRegion}/{wolLangParam}/{docId}
 */
export async function getWOLArticle(
  docId: string,
  langSymbol: string,
  wolRegion: string,
  wolLangParam: string
): Promise<unknown> {
  const url = `${BASE_WOL}/${langSymbol}/wol/d/${wolRegion}/${wolLangParam}/${docId}`;
  return jwFetch(url);
}

// -----------------------------------------------------------
// Convenience: get current ISO week number for a date
// -----------------------------------------------------------
export function getISOWeek(date: Date = new Date()): { year: number; week: number } {
  const tmp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return { year: tmp.getUTCFullYear(), week };
}

/**
 * Format a date as a meeting workbook issue code (YYYYMM).
 * e.g. May 2026 → "202605"
 */
export function toIssueCode(date: Date = new Date()): string {
  return `${date.getFullYear()}${pad2(date.getMonth() + 1)}`;
}

// -----------------------------------------------------------
// Default export (all named functions bundled)
// -----------------------------------------------------------
export default {
  getDailyText,
  getMeetingWorkbook,
  getWOLMeetingSchedule,
  getWatchtowerIssue,
  getPublicationContent,
  getMediaLinks,
  searchJWOrg,
  searchWOL,
  getBibleBooks,
  getVideoSource,
  getWOLArticle,
  getISOWeek,
  toIssueCode,
};
