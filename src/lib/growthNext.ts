/** Describe stored workflow state without inventing research or future actions. */
export function outreachHoldReason(prospect: {
  outreach: { status: string }[];
  decisionMakers: { name: string | null; isReal: boolean }[];
  evidence: { isDemo: boolean }[];
}): string | null {
  if (prospect.outreach.length) return null;
  const contact = prospect.decisionMakers.some(person => person.isReal && Boolean(person.name?.trim()));
  const evidence = prospect.evidence.some(item => !item.isDemo);
  if (!contact && !evidence) return 'No draft yet: no verified named contact or live evidence is recorded.';
  if (!contact) return 'No draft yet: research is saved, but no named contact is marked as verified.';
  if (!evidence) return 'No draft yet: a contact is recorded, but no live evidence is saved.';
  return 'Contact and live evidence are recorded; no outreach draft has been saved yet.';
}
