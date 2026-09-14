import { XMLParser, XMLValidator } from 'fast-xml-parser';

// A sourced watchlist, not an inferred org chart. Reviewed against the official page.
export const LEADERSHIP_SOURCE = 'https://www.wonderful.ai/about-us';
export const LEADERSHIP_VERIFIED_AT = '2026-09-14';
export const LEADERSHIP = [
  { name: 'Bar Winkler', role: 'CEO' },
  { name: 'Roey Lalazar', role: 'CTO' },
  { name: 'Roi Tavor', role: 'CRO' },
  { name: 'Melissa Zeloof', role: 'CMO' },
  { name: 'Guy Sustiel', role: 'COO' },
  { name: 'Barak Kaufman', role: 'CSO' },
  { name: 'Noam Makavy', role: 'Chief Product Officer' },
];
export interface LeadershipArticle { title: string; sourceUrl: string; sourceName: string; sourceDate: Date; people: string[]; nameInMetadata: boolean }
const plain = (value: unknown) => String(value ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

export function parseLeadershipFeed(xml: string, person: string, now = new Date()): LeadershipArticle[] {
  if (XMLValidator.validate(xml) !== true) throw new Error('Invalid news RSS');
  const parsed = new XMLParser({ ignoreAttributes: false, processEntities: false }).parse(xml);
  if (parsed.rss?.channel === undefined) throw new Error('News source returned no RSS channel');
  const raw = parsed.rss.channel.item ?? [];
  const items = Array.isArray(raw) ? raw : [raw];
  const seen = new Set<string>();
  return items.flatMap((item): LeadershipArticle[] => {
    const title = plain(item.title);
    const context = `${title} ${plain(item.description)}`.toLowerCase();
    // Require company context; distinguish indexed name matches from visible metadata.
    if (!/\bwonderful\b/i.test(context)) return [];
    const sourceDate = new Date(item.pubDate);
    if (!Number.isFinite(sourceDate.getTime()) || sourceDate > now || now.getTime() - sourceDate.getTime() > 90 * 86400000) return [];
    const sourceUrl = plain(item.link);
    try { if (new URL(sourceUrl).protocol !== 'https:') return []; } catch { return []; }
    if (seen.has(sourceUrl)) return [];
    seen.add(sourceUrl);
    const sourceName = plain(typeof item.source === 'object' ? item.source['#text'] : item.source) || 'Google News index';
    return [{ title, sourceUrl, sourceName, sourceDate, people: [person], nameInMetadata: context.includes(person.toLowerCase()) }];
  }).slice(0, 10);
}

export async function fetchLeadershipNews() {
  const results = await Promise.all(LEADERSHIP.map(async person => {
    const query = `"${person.name}" "Wonderful" when:90d`;
    for (let attempt = 0; ; attempt++) {
      try {
        const response = await fetch(`https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`, { signal: AbortSignal.timeout(10000), cache: 'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return { items: parseLeadershipFeed(await response.text(), person.name), error: null };
      } catch (error) {
        if (attempt === 0) continue;
        return { items: [], error: `${person.name}: ${error instanceof Error ? error.message : String(error)}` };
      }
    }
  }));
  const byUrl = new Map<string, LeadershipArticle>();
  for (const result of results) for (const item of result.items) {
    const existing = byUrl.get(item.sourceUrl);
    if (existing) existing.people = Array.from(new Set([...existing.people, ...item.people]));
    else byUrl.set(item.sourceUrl, item);
  }
  return { items: [...byUrl.values()], errors: results.flatMap(r => r.error ? [r.error] : []) };
}

