import { test } from 'node:test';
import assert from 'node:assert/strict';
import { outreachHoldReason } from '../growthNext';

test('saved messages never get a contradictory no-draft explanation', () => {
  assert.equal(outreachHoldReason({ outreach: [{ status: 'SENT' }], decisionMakers: [], evidence: [] }), null);
});
test('role hypotheses and demo evidence do not satisfy live outreach prerequisites', () => {
  assert.match(outreachHoldReason({ outreach: [], decisionMakers: [{ name: 'VP Operations', isReal: false }], evidence: [{ isDemo: true }] })!, /no verified named contact or live evidence/);
});
test('reports the missing prerequisite, without promising an automatic fix', () => {
  assert.match(outreachHoldReason({ outreach: [], decisionMakers: [], evidence: [{ isDemo: false }] })!, /research is saved, but no named contact/);
  assert.match(outreachHoldReason({ outreach: [], decisionMakers: [{ name: 'Sam', isReal: true }], evidence: [] })!, /no live evidence/);
  assert.match(outreachHoldReason({ outreach: [], decisionMakers: [{ name: 'Sam', isReal: true }], evidence: [{ isDemo: false }] })!, /no outreach draft has been saved yet/);
});
