// ============================================================
// JW Study Assistant — Language Service
// Hardcoded comprehensive list + optional API merge from JW mediator
// ============================================================
import type { Language } from '../types';

// -----------------------------------------------------------
// Hardcoded canonical JW language list (50+ languages)
// Fields: code (JW pub code), symbol (URL slug), name (native),
//         englishName, direction, wolRegion (r##), wolLangParam (lp-*)
// -----------------------------------------------------------
const HARDCODED_LANGUAGES: Language[] = [
  { code: 'E',   symbol: 'en',      name: 'English',              englishName: 'English',              direction: 'ltr', wolRegion: 'r1',   wolLangParam: 'lp-e'   },
  { code: 'F',   symbol: 'fr',      name: 'Français',             englishName: 'French',               direction: 'ltr', wolRegion: 'r30',  wolLangParam: 'lp-f'   },
  { code: 'S',   symbol: 'es',      name: 'Español',              englishName: 'Spanish',              direction: 'ltr', wolRegion: 'r4',   wolLangParam: 'lp-s'   },
  { code: 'T',   symbol: 'pt',      name: 'Português',            englishName: 'Portuguese',           direction: 'ltr', wolRegion: 'r5',   wolLangParam: 'lp-t'   },
  { code: 'X',   symbol: 'de',      name: 'Deutsch',              englishName: 'German',               direction: 'ltr', wolRegion: 'r10',  wolLangParam: 'lp-g'   },
  { code: 'I',   symbol: 'it',      name: 'Italiano',             englishName: 'Italian',              direction: 'ltr', wolRegion: 'r6',   wolLangParam: 'lp-i'   },
  { code: 'U',   symbol: 'ru',      name: 'Русский',              englishName: 'Russian',              direction: 'ltr', wolRegion: 'r19',  wolLangParam: 'lp-ru'  },
  { code: 'J',   symbol: 'ja',      name: '日本語',               englishName: 'Japanese',             direction: 'ltr', wolRegion: 'r7',   wolLangParam: 'lp-j'   },
  { code: 'Ko',  symbol: 'ko',      name: '한국어',               englishName: 'Korean',               direction: 'ltr', wolRegion: 'r23',  wolLangParam: 'lp-ko'  },
  { code: 'CHS', symbol: 'zh-hans', name: '简体中文',             englishName: 'Chinese Simplified',   direction: 'ltr', wolRegion: 'r25',  wolLangParam: 'lp-chs' },
  { code: 'CHT', symbol: 'zh-hant', name: '繁體中文',             englishName: 'Chinese Traditional',  direction: 'ltr', wolRegion: 'r26',  wolLangParam: 'lp-cht' },
  { code: 'CR',  symbol: 'ht',      name: 'Kreyòl ayisyen',       englishName: 'Haitian Creole',       direction: 'ltr', wolRegion: 'r60',  wolLangParam: 'lp-cr'  },
  { code: 'D',   symbol: 'nl',      name: 'Nederlands',           englishName: 'Dutch',                direction: 'ltr', wolRegion: 'r8',   wolLangParam: 'lp-d'   },
  { code: 'Z',   symbol: 'sv',      name: 'Svenska',              englishName: 'Swedish',              direction: 'ltr', wolRegion: 'r13',  wolLangParam: 'lp-sv'  },
  { code: 'P',   symbol: 'pl',      name: 'Polski',               englishName: 'Polish',               direction: 'ltr', wolRegion: 'r17',  wolLangParam: 'lp-pl'  },
  { code: 'M',   symbol: 'ro',      name: 'Română',               englishName: 'Romanian',             direction: 'ltr', wolRegion: 'r34',  wolLangParam: 'lp-rm'  },
  { code: 'H',   symbol: 'hu',      name: 'Magyar',               englishName: 'Hungarian',            direction: 'ltr', wolRegion: 'r18',  wolLangParam: 'lp-h'   },
  { code: 'Gr',  symbol: 'el',      name: 'Ελληνικά',             englishName: 'Greek',                direction: 'ltr', wolRegion: 'r11',  wolLangParam: 'lp-gr'  },
  { code: 'Tk',  symbol: 'tr',      name: 'Türkçe',               englishName: 'Turkish',              direction: 'ltr', wolRegion: 'r24',  wolLangParam: 'lp-t'   },
  { code: 'AR',  symbol: 'ar',      name: 'العربية',              englishName: 'Arabic',               direction: 'rtl', wolRegion: 'r2',   wolLangParam: 'lp-a'   },
  { code: 'Hi',  symbol: 'hi',      name: 'हिन्दी',              englishName: 'Hindi',                direction: 'ltr', wolRegion: 'r65',  wolLangParam: 'lp-hi'  },
  { code: 'TG',  symbol: 'tl',      name: 'Tagalog',              englishName: 'Tagalog',              direction: 'ltr', wolRegion: 'r44',  wolLangParam: 'lp-tg'  },
  { code: 'IN',  symbol: 'id',      name: 'Bahasa Indonesia',     englishName: 'Indonesian',           direction: 'ltr', wolRegion: 'r26',  wolLangParam: 'lp-in'  },
  { code: 'Vt',  symbol: 'vi',      name: 'Tiếng Việt',           englishName: 'Vietnamese',           direction: 'ltr', wolRegion: 'r45',  wolLangParam: 'lp-vt'  },
  { code: 'Sw',  symbol: 'sw',      name: 'Kiswahili',            englishName: 'Swahili',              direction: 'ltr', wolRegion: 'r53',  wolLangParam: 'lp-sw'  },
  { code: 'Yo',  symbol: 'yo',      name: 'Yorùbá',               englishName: 'Yoruba',               direction: 'ltr', wolRegion: 'r76',  wolLangParam: 'lp-yo'  },
  { code: 'Ig',  symbol: 'ig',      name: 'Igbo',                 englishName: 'Igbo',                 direction: 'ltr', wolRegion: 'r79',  wolLangParam: 'lp-ig'  },
  { code: 'Am',  symbol: 'am',      name: 'አማርኛ',                englishName: 'Amharic',              direction: 'ltr', wolRegion: 'r100', wolLangParam: 'lp-am'  },
  { code: 'Mg',  symbol: 'mg',      name: 'Malagasy',             englishName: 'Malagasy',             direction: 'ltr', wolRegion: 'r85',  wolLangParam: 'lp-mg'  },
  { code: 'Zu',  symbol: 'zu',      name: 'IsiZulu',              englishName: 'Zulu',                 direction: 'ltr', wolRegion: 'r77',  wolLangParam: 'lp-zu'  },
  // Additional common languages
  { code: 'Dk',  symbol: 'da',      name: 'Dansk',                englishName: 'Danish',               direction: 'ltr', wolRegion: 'r9',   wolLangParam: 'lp-dk'  },
  { code: 'Fi',  symbol: 'fi',      name: 'Suomi',                englishName: 'Finnish',              direction: 'ltr', wolRegion: 'r14',  wolLangParam: 'lp-fi'  },
  { code: 'Nw',  symbol: 'no',      name: 'Norsk',                englishName: 'Norwegian',            direction: 'ltr', wolRegion: 'r12',  wolLangParam: 'lp-nw'  },
  { code: 'Cs',  symbol: 'cs',      name: 'Čeština',              englishName: 'Czech',                direction: 'ltr', wolRegion: 'r33',  wolLangParam: 'lp-cs'  },
  { code: 'Sk',  symbol: 'sk',      name: 'Slovenčina',           englishName: 'Slovak',               direction: 'ltr', wolRegion: 'r36',  wolLangParam: 'lp-sk'  },
  { code: 'Sl',  symbol: 'sl',      name: 'Slovenščina',          englishName: 'Slovenian',            direction: 'ltr', wolRegion: 'r37',  wolLangParam: 'lp-sl'  },
  { code: 'Hv',  symbol: 'hr',      name: 'Hrvatski',             englishName: 'Croatian',             direction: 'ltr', wolRegion: 'r38',  wolLangParam: 'lp-hv'  },
  { code: 'Sr',  symbol: 'sr',      name: 'Српски',               englishName: 'Serbian',              direction: 'ltr', wolRegion: 'r39',  wolLangParam: 'lp-sr'  },
  { code: 'Bul', symbol: 'bg',      name: 'Български',            englishName: 'Bulgarian',            direction: 'ltr', wolRegion: 'r40',  wolLangParam: 'lp-bul' },
  { code: 'Uk',  symbol: 'uk',      name: 'Українська',           englishName: 'Ukrainian',            direction: 'ltr', wolRegion: 'r20',  wolLangParam: 'lp-uk'  },
  { code: 'Be',  symbol: 'be',      name: 'Беларуская',           englishName: 'Belarusian',           direction: 'ltr', wolRegion: 'r21',  wolLangParam: 'lp-be'  },
  { code: 'Lt',  symbol: 'lt',      name: 'Lietuvių',             englishName: 'Lithuanian',           direction: 'ltr', wolRegion: 'r41',  wolLangParam: 'lp-lt'  },
  { code: 'Lv',  symbol: 'lv',      name: 'Latviešu',             englishName: 'Latvian',              direction: 'ltr', wolRegion: 'r42',  wolLangParam: 'lp-lv'  },
  { code: 'Et',  symbol: 'et',      name: 'Eesti',                englishName: 'Estonian',             direction: 'ltr', wolRegion: 'r43',  wolLangParam: 'lp-et'  },
  { code: 'Fa',  symbol: 'fa',      name: 'فارسی',                englishName: 'Persian (Farsi)',      direction: 'rtl', wolRegion: 'r3',   wolLangParam: 'lp-fa'  },
  { code: 'Bn',  symbol: 'bn',      name: 'বাংলা',               englishName: 'Bengali',              direction: 'ltr', wolRegion: 'r66',  wolLangParam: 'lp-bn'  },
  { code: 'Ur',  symbol: 'ur',      name: 'اردو',                 englishName: 'Urdu',                 direction: 'rtl', wolRegion: 'r67',  wolLangParam: 'lp-ur'  },
  { code: 'Ne',  symbol: 'ne',      name: 'नेपाली',               englishName: 'Nepali',               direction: 'ltr', wolRegion: 'r68',  wolLangParam: 'lp-ne'  },
  { code: 'Si',  symbol: 'si',      name: 'සිංහල',               englishName: 'Sinhala',              direction: 'ltr', wolRegion: 'r69',  wolLangParam: 'lp-si'  },
  { code: 'My',  symbol: 'my',      name: 'မြန်မာ',               englishName: 'Burmese',              direction: 'ltr', wolRegion: 'r70',  wolLangParam: 'lp-my'  },
  { code: 'Th',  symbol: 'th',      name: 'ภาษาไทย',              englishName: 'Thai',                 direction: 'ltr', wolRegion: 'r46',  wolLangParam: 'lp-th'  },
  { code: 'Km',  symbol: 'km',      name: 'ភាសាខ្មែរ',           englishName: 'Khmer',                direction: 'ltr', wolRegion: 'r47',  wolLangParam: 'lp-km'  },
  { code: 'Lo',  symbol: 'lo',      name: 'ພາສາລາວ',              englishName: 'Lao',                  direction: 'ltr', wolRegion: 'r48',  wolLangParam: 'lp-lo'  },
  { code: 'Ms',  symbol: 'ms',      name: 'Bahasa Melayu',        englishName: 'Malay',                direction: 'ltr', wolRegion: 'r49',  wolLangParam: 'lp-ms'  },
  { code: 'Cb',  symbol: 'ceb',     name: 'Cebuano',              englishName: 'Cebuano',              direction: 'ltr', wolRegion: 'r50',  wolLangParam: 'lp-cb'  },
  { code: 'Ilo', symbol: 'ilo',     name: 'Ilokano',              englishName: 'Ilocano',              direction: 'ltr', wolRegion: 'r51',  wolLangParam: 'lp-ilo' },
  { code: 'Af',  symbol: 'af',      name: 'Afrikaans',            englishName: 'Afrikaans',            direction: 'ltr', wolRegion: 'r52',  wolLangParam: 'lp-af'  },
  { code: 'Xh',  symbol: 'xh',      name: 'IsiXhosa',             englishName: 'Xhosa',                direction: 'ltr', wolRegion: 'r78',  wolLangParam: 'lp-xh'  },
  { code: 'St',  symbol: 'st',      name: 'Sesotho',              englishName: 'Sotho',                direction: 'ltr', wolRegion: 'r80',  wolLangParam: 'lp-st'  },
  { code: 'Pt',  symbol: 'pt-ao',   name: 'Português (Angola)',   englishName: 'Portuguese (Angola)',  direction: 'ltr', wolRegion: 'r56',  wolLangParam: 'lp-pt'  },
];

// -----------------------------------------------------------
// Internal cache
// -----------------------------------------------------------
let _cachedLanguages: Language[] | null = null;

// -----------------------------------------------------------
// Fetch + merge from JW mediator API
// -----------------------------------------------------------
async function fetchFromMediatorAPI(): Promise<Language[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(
      'https://b.jw-cdn.org/apis/mediator/v1/languages/E/web?clientType=www',
      { signal: controller.signal }
    );
    clearTimeout(timeout);

    if (!res.ok) return [];

    const data = await res.json() as {
      languages?: Array<{
        langcode: string;
        symbol: string;
        name: string;
        vernacularName?: string;
        direction?: string;
        locale?: string;
        hasWebContent?: boolean;
        tier?: number;
      }>;
    };

    if (!Array.isArray(data.languages)) return [];

    // Map API response → Language; fill in WOL params where we know them
    return data.languages
      .filter((l) => l.hasWebContent)
      .map((l) => {
        const known = HARDCODED_LANGUAGES.find(
          (k) => k.code.toUpperCase() === l.langcode?.toUpperCase() ||
                 k.symbol === l.symbol
        );
        return {
          code: l.langcode ?? known?.code ?? l.symbol,
          symbol: l.symbol ?? known?.symbol ?? l.langcode?.toLowerCase() ?? '',
          name: l.vernacularName ?? l.name ?? known?.name ?? '',
          englishName: l.name ?? known?.englishName ?? '',
          direction: (l.direction === 'rtl' ? 'rtl' : 'ltr') as 'ltr' | 'rtl',
          wolRegion: known?.wolRegion ?? 'r1',
          wolLangParam: known?.wolLangParam ?? `lp-${l.symbol}`,
        } satisfies Language;
      });
  } catch {
    clearTimeout(timeout);
    return [];
  }
}

// -----------------------------------------------------------
// Public API
// -----------------------------------------------------------

/**
 * Returns a comprehensive list of JW languages.
 * Starts with the hardcoded list; on first call attempts to merge
 * live data from the JW mediator API (new languages are appended,
 * existing entries keep their WOL region/param data).
 */
export async function getLanguages(): Promise<Language[]> {
  if (_cachedLanguages) return _cachedLanguages;

  // Start with hardcoded list
  const base = [...HARDCODED_LANGUAGES];

  // Try live API — merge new entries only
  const apiLangs = await fetchFromMediatorAPI();
  for (const apiLang of apiLangs) {
    const alreadyKnown = base.some(
      (k) => k.code.toUpperCase() === apiLang.code.toUpperCase() ||
             k.symbol === apiLang.symbol
    );
    if (!alreadyKnown) {
      base.push(apiLang);
    }
  }

  // Sort alphabetically by english name
  base.sort((a, b) => a.englishName.localeCompare(b.englishName));

  _cachedLanguages = base;
  return base;
}

/**
 * Find a language by its JW pub code (e.g. "E", "F", "S").
 * Case-insensitive.
 */
export function getLanguageByCode(code: string): Language | undefined {
  const list = _cachedLanguages ?? HARDCODED_LANGUAGES;
  return list.find((l) => l.code.toLowerCase() === code.toLowerCase());
}

/**
 * Find a language by its URL symbol (e.g. "en", "fr", "es").
 * Case-insensitive.
 */
export function getLanguageBySymbol(symbol: string): Language | undefined {
  const list = _cachedLanguages ?? HARDCODED_LANGUAGES;
  return list.find((l) => l.symbol.toLowerCase() === symbol.toLowerCase());
}

/**
 * Base JW.org URL for a language symbol.
 * e.g. "en" → "https://www.jw.org/en/"
 */
export function getJWBaseUrl(langSymbol: string): string {
  return `https://www.jw.org/${langSymbol}/`;
}

/**
 * Base WOL URL for a language.
 * e.g. symbol="en", wolRegion="r1", wolLangParam="lp-e"
 * → "https://wol.jw.org/en/wol/"
 */
export function getWOLBaseUrl(langSymbol: string): string {
  return `https://wol.jw.org/${langSymbol}/wol/`;
}

/**
 * Full WOL daily-text URL for a given date.
 * e.g. "https://wol.jw.org/en/wol/dt/r1/lp-e/2026/5/7"
 */
export function getWOLDailyTextUrl(
  langSymbol: string,
  wolRegion: string,
  wolLangParam: string,
  date: Date = new Date()
): string {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  return `https://wol.jw.org/${langSymbol}/wol/dt/${wolRegion}/${wolLangParam}/${y}/${m}/${d}`;
}

// Synchronous convenience: returns hardcoded list immediately (no network)
export function getLanguagesSync(): Language[] {
  return _cachedLanguages ?? [...HARDCODED_LANGUAGES];
}

export default {
  getLanguages,
  getLanguagesSync,
  getLanguageByCode,
  getLanguageBySymbol,
  getJWBaseUrl,
  getWOLBaseUrl,
  getWOLDailyTextUrl,
};
