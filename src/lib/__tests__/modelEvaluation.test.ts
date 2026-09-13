import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateModelVersions, type CandidateRow } from '../talentModel';

const rows: CandidateRow[] = Array.from({ length: 90 }, (_, i) => ({
  id: String(i).padStart(3, '0'), yearsExperience: 5,
  startupExperience: i % 2 === 0, eliteUniversity: false,
  priorLeadership: false, technicalDomain: 'Frontend',
  originalSourcingScore: i % 2 === 0 ? 10 : 90,
  hired: true, retentionMonths: 12,
  managerRating: i % 2 === 0 ? 5 : 1,
  highPerformer: false, // Simulates CSV defaults and stale stored labels.
}));

test('V2 uses current ratings even when stored high-performer flags are stale', () => {
  const before = evaluateModelVersions(rows);
  const after = evaluateModelVersions(rows.map(r => ({ ...r, managerRating: 6 - r.managerRating! })));
  assert.equal(before.validationStatus, 'PASSED');
  assert.equal(before.v2Precision, 1);
  assert.ok(before.v2Weights.startupExperience > 0);
  assert.ok(after.v2Weights.startupExperience < 0);
  assert.equal(after.v1Precision, 1);
  assert.equal(after.validationStatus, 'FAILED');
});

test('relative improvement is undefined when baseline precision is zero', () => {
  const result = evaluateModelVersions(rows);
  assert.equal(result.v1Precision, 0);
  assert.equal(result.improvementPct, null);
});
