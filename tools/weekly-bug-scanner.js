#!/usr/bin/env node

const LANGUAGES = [
  { label: 'English', symbol: 'en', code: 'E', wolRegion: 'r1', wolLangParam: 'lp-e', query: 'love' },
  { label: 'Haitian Creole', symbol: 'ht', code: 'CR', wolRegion: 'r60', wolLangParam: 'lp-cr', query: 'lanmou' },
];

function isoWeek(date = new Date()) {
  const tmp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  return {
    year: tmp.getUTCFullYear(),
    week: Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7),
  };
}

async function fetchText(url, accept = 'text/html,application/json,*/*') {
  const response = await fetch(url, {
    headers: {
      Accept: accept,
      'User-Agent': 'jw-study-assistant-weekly-scanner/1.0',
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.text();
}

function absoluteWol(href) {
  if (!href) return '';
  if (/^https?:\/\//i.test(href)) return href;
  return `https://wol.jw.org${href.startsWith('/') ? '' : '/'}${href}`;
}

function parseMeetingArticleUrl(html) {
  const match = /href="([^"]*\/wol\/d\/[^"]+)"/i.exec(html);
  return absoluteWol(match?.[1] || '');
}

function parseDataVideo(html) {
  const dataVideo = /data-video="([^"]+)"/i.exec(html)?.[1];
  if (dataVideo) {
    const decoded = dataVideo.replace(/&quot;/g, '"').replace(/&amp;/g, '&');
    try {
      const parsed = JSON.parse(decoded);
      return Array.isArray(parsed) ? parsed[0] : parsed;
    } catch {
      const pub = /[?&]pub=([^&]+)/.exec(decoded)?.[1];
      const issue = /[?&]issue=([^&]+)/.exec(decoded)?.[1];
      const track = /[?&]track=([^&]+)/.exec(decoded)?.[1];
      if (pub && track) return { pub, issue, track };
    }
  }
  const href = /href="([^"]*(?:\/finder\?[^"]*lank=pub-[^"]*_VIDEO|lank=pub-[^"]*_VIDEO)[^"]*)"/i.exec(html)?.[1];
  if (!href) return null;
  const decoded = href.replace(/&amp;/g, '&');
  const langwritten = /[?&]wtlocale=([^&]+)/.exec(decoded)?.[1];
  const lank = /[?&]lank=([^&]+)/.exec(decoded)?.[1] || '';
  const match = /^pub-([a-z0-9]+)_(\d{6})_(\d+)_VIDEO/i.exec(lank);
  return match ? { pub: match[1], issue: match[2], track: match[3], langwritten } : null;
}

async function checkVideoMetadata(video, lang) {
  if (!video?.pub || !video?.track) return false;
  const url = `https://b.jw-cdn.org/apis/pub-media/GETPUBMEDIALINKS?pub=${encodeURIComponent(video.pub)}${video.issue ? `&issue=${encodeURIComponent(video.issue)}` : ''}&track=${encodeURIComponent(video.track)}&langwritten=${encodeURIComponent(lang.code)}&fileformat=MP4,M4V&output=json`;
  const text = await fetchText(url, 'application/json,*/*');
  const json = JSON.parse(text);
  const files = json?.files?.[lang.code]?.MP4 || json?.files?.[lang.code]?.M4V || [];
  return Array.isArray(files) && files.some((file) => file?.file?.url);
}

async function checkBibleExactRange() {
  const url = 'https://wol.jw.org/en/wol/b/r1/lp-e/nwt/43/4#v=43:4:6-43:4:9';
  const html = await fetchText(url);
  return /id=["']v43-4-6-1["']/.test(html)
    && /id=["']v43-4-9-1["']/.test(html)
    && /id=["']v43-4-10-1["']/.test(html);
}

async function checkSearch(lang) {
  const url = `https://wol.jw.org/${lang.symbol}/wol/s/${lang.wolRegion}/${lang.wolLangParam}?q=${encodeURIComponent(lang.query)}&p=par&r=occ&st=a`;
  const html = await fetchText(url);
  return (html.match(/resultContentDocument/g) || []).length > 0 || /\/wol\/d\//.test(html);
}

async function scanLanguage(lang, year, week) {
  const report = { language: lang.label, ok: true, checks: [] };
  const add = (name, pass, detail = '') => {
    report.checks.push({ name, pass, detail });
    if (!pass) report.ok = false;
  };

  const meetingsUrl = `https://wol.jw.org/${lang.symbol}/wol/meetings/${lang.wolRegion}/${lang.wolLangParam}/${year}/${week}`;
  const meetingsHtml = await fetchText(meetingsUrl);
  const articleUrl = parseMeetingArticleUrl(meetingsHtml);
  add('meeting article discovered', Boolean(articleUrl), articleUrl || 'No /wol/d/ link found');

  const articleHtml = articleUrl ? await fetchText(articleUrl) : '';
  const partCount = (articleHtml.match(/<h3\b/gi) || []).length;
  add('midweek parts parsed', partCount >= 4, `${partCount} h3 parts`);
  add('images available when supplied', /<img\b/i.test(articleHtml), /<img\b/i.test(articleHtml) ? 'image tag found' : 'no image tag in current article');

  const video = parseDataVideo(articleHtml);
  const hasVideoMetadata = video ? await checkVideoMetadata(video, lang).catch(() => false) : false;
  add('video metadata resolves', Boolean(video) ? hasVideoMetadata : true, video ? `${video.pub || ''} track ${video.track || ''}` : 'no video in current article');

  const searchOk = await checkSearch(lang).catch(() => false);
  add('WOL search returns results', searchOk, lang.query);
  return report;
}

async function main() {
  const { year, week } = isoWeek();
  const reports = [];
  for (const lang of LANGUAGES) {
    reports.push(await scanLanguage(lang, year, week));
  }
  const exactRange = await checkBibleExactRange().catch(() => false);
  reports.push({
    language: 'Reference resolver',
    ok: exactRange,
    checks: [{ name: 'Bible range source contains exact ids', pass: exactRange, detail: 'John 4:6-9 source verified' }],
  });

  for (const report of reports) {
    console.log(`\n${report.ok ? 'PASS' : 'FAIL'} ${report.language}`);
    for (const check of report.checks) {
      console.log(`  ${check.pass ? '✓' : '✗'} ${check.name}${check.detail ? ` - ${check.detail}` : ''}`);
    }
  }

  if (reports.some((report) => !report.ok)) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
