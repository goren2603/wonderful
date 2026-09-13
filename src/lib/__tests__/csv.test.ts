import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCsv } from "../csv";

test("parseCsv: basic header + rows", () => {
  const rows = parseCsv("name,age\nAlice,30\nBob,25");
  assert.deepEqual(rows, [
    { name: "Alice", age: "30" },
    { name: "Bob", age: "25" },
  ]);
});

test("parseCsv: quoted field with embedded comma", () => {
  const rows = parseCsv('name,companies\n"Alice","Acme, Inc;Beta"');
  assert.equal(rows[0].companies, "Acme, Inc;Beta");
});

test("parseCsv: quoted field with escaped double quote", () => {
  const rows = parseCsv('name,note\n"Alice","She said ""hi"""');
  assert.equal(rows[0].note, 'She said "hi"');
});

test("parseCsv: empty input returns no rows", () => {
  assert.deepEqual(parseCsv(""), []);
});

test("parseCsv: ignores blank trailing lines", () => {
  const rows = parseCsv("name,age\nAlice,30\n\n");
  assert.equal(rows.length, 1);
});
