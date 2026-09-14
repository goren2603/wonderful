import { db } from './db';
import { fetchLeadershipNews } from './leadershipNews';

export async function monitorLeadership(companyId: string, runId: string) {
  const { items, errors } = await fetchLeadershipNews();
  let stored = 0;
  for (const item of items) {
    const existing = await db.evidence.findFirst({ where: { entityType: 'LEADERSHIP', entityId: companyId, sourceUrl: item.sourceUrl } });
    const data = { title: item.title, sourceName: item.sourceName, sourceDate: item.sourceDate, snippet: JSON.stringify({ people: item.people, nameInMetadata: item.nameInMetadata }) };
    if (existing) await db.evidence.update({ where: { id: existing.id }, data });
    else { await db.evidence.create({ data: { ...data, entityType: 'LEADERSHIP', entityId: companyId, sourceUrl: item.sourceUrl, provider: 'google-news-rss', isDemo: false, confidence: 0.5 } }); stored++; }
  }
  const result = { fetched: items.length, stored, errors };
  await db.auditLogEntry.create({ data: { actor: 'agent', action: 'leadership_scan', entityType: 'Company', entityId: companyId, detailJson: JSON.stringify({ runId, ...result }) } });
  return result;
}

