import { test } from "node:test";
import assert from "node:assert/strict";
import { pearsonCorrelation, confidenceFromStats, mean, stddev } from "../stats";

test("pearsonCorrelation: perfect positive correlation", () => {
  const x = [1, 2, 3, 4, 5];
  const y = [2, 4, 6, 8, 10];
  assert.ok(Math.abs(pearsonCorrelation(x, y) - 1) < 1e-9);
});

test("pearsonCorrelation: perfect negative correlation", () => {
  const x = [1, 2, 3, 4, 5];
  const y = [10, 8, 6, 4, 2];
  assert.ok(Math.abs(pearsonCorrelation(x, y) - -1) < 1e-9);
});

test("pearsonCorrelation: no correlation returns near zero for symmetric noise", () => {
  const x = [1, 2, 3, 4, 5, 6];
  const y = [3, 1, 4, 1, 5, 9];
  const r = pearsonCorrelation(x, y);
  assert.ok(r > -1 && r < 1);
});

test("pearsonCorrelation: constant input yields 0, not NaN", () => {
  const x = [5, 5, 5, 5];
  const y = [1, 2, 3, 4];
  assert.equal(pearsonCorrelation(x, y), 0);
});

test("confidenceFromStats: small samples are always capped at LOW regardless of effect size", () => {
  assert.equal(confidenceFromStats(10, 0.95), "LOW");
  assert.equal(confidenceFromStats(19, 0.99), "LOW");
});

test("confidenceFromStats: large n with strong correlation reaches HIGH", () => {
  assert.equal(confidenceFromStats(150, 0.4), "HIGH");
});

test("confidenceFromStats: large n with weak correlation stays LOW", () => {
  assert.equal(confidenceFromStats(150, 0.05), "LOW");
});

test("mean and stddev basic sanity", () => {
  assert.equal(mean([1, 2, 3, 4, 5]), 3);
  assert.ok(stddev([1, 2, 3, 4, 5]) > 1.5 && stddev([1, 2, 3, 4, 5]) < 1.6);
});
