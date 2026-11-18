// Conformance tests: the REDCap build must implement spec/protocol.json.
// One test per requirement, named conformance/<REQ_ID> to match trace/matrix.csv.
// When the spec changes (an amendment), these fail until the build and matrix catch up.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  LICENSED_PLACEHOLDER,
  loadDesignations,
  loadDictionary,
  loadEvents,
  loadLocked,
  loadMatrix,
  loadSpec,
} from "../lib/redcap.ts";

const spec = loadSpec();
const { fields } = loadDictionary();
const events = loadEvents();
const designations = loadDesignations();
const matrix = loadMatrix();
const locked = loadLocked();

function traceRow(reqId: string, kind: string) {
  const row = matrix.find((r) => r.reqId === reqId);
  assert.ok(row, `${reqId} has no row in trace/matrix.csv`);
  assert.equal(row.kind, kind, `${reqId} matrix kind should be "${kind}"`);
  assert.equal(row.testId, `conformance/${reqId}`, `${reqId} matrix test_id should be conformance/${reqId}`);
  return row;
}

const eventFor = (encId: string) => {
  const row = matrix.find((r) => r.reqId === encId && r.kind === "encounter");
  return row?.locator;
};

for (const enc of spec.encounters) {
  test(`conformance/${enc.id}: ${enc.name} event matches day and window`, () => {
    const row = traceRow(enc.id, "encounter");
    assert.equal(row.artifact, "redcap/events.csv");
    const ev = events.find((e) => e.uniqueName === row.locator);
    assert.ok(ev, `event ${row.locator} not found in events.csv`);
    assert.equal(ev.dayOffset, enc.day, `${enc.id} day_offset`);
    assert.equal(ev.offsetMin, enc.windowMinus, `${enc.id} offset_min (window minus)`);
    assert.equal(ev.offsetMax, enc.windowPlus, `${enc.id} offset_max (window plus)`);
  });
}

for (const crit of spec.eligibilityCriteria) {
  test(`conformance/${crit.id}: ${crit.category} criterion has a required yes/no field`, () => {
    const row = traceRow(crit.id, "criterion");
    assert.equal(row.artifact, "redcap/data_dictionary.csv");
    const field = fields.find((f) => f.name === row.locator);
    assert.ok(field, `field ${row.locator} not found in data_dictionary.csv`);
    assert.equal(field.form, "eligibility", `${crit.id} must be on the eligibility form`);
    assert.equal(field.type, "yesno", `${crit.id} must be a yesno field`);
    assert.equal(field.required, "y", `${crit.id} must be required`);
    assert.match(field.annotation, new RegExp(`\\bREQ:${crit.id}\\b`), `${crit.id} field annotation must include REQ:${crit.id}`);
  });
}

for (const act of spec.activities) {
  test(`conformance/${act.id}: ${act.name} is scheduled exactly as the SoA says`, () => {
    const row = traceRow(act.id, "activity");
    assert.equal(row.artifact, "redcap/instrument_designation.csv");
    const form = row.locator;
    assert.ok(fields.some((f) => f.form === form), `form ${form} has no fields in data_dictionary.csv`);
    const expected = act.encounters.map((e) => eventFor(e)).sort();
    assert.ok(expected.every(Boolean), `${act.id} references an encounter with no event mapping`);
    const actual = designations.filter((d) => d.form === form).map((d) => d.event).sort();
    assert.deepEqual(actual, expected, `${act.id} designations (events where ${form} is collected)`);

    if (act.licensed && !locked[form]) {
      // New licensed instrument: wording comes from the licensor, never from the agent.
      const items = fields.filter((f) => f.form === form && !f.name.endsWith("_date"));
      if (act.itemCount) assert.equal(items.length, act.itemCount, `${act.id} should have ${act.itemCount} item fields`);
      for (const f of items) {
        assert.match(f.label, LICENSED_PLACEHOLDER, `${f.name}: licensed text must be a [[LICENSED_TEXT_PENDING ...]] placeholder`);
      }
    }
  });
}

test("trace/matrix.csv has no orphan rows", () => {
  const ids = new Set([
    ...spec.encounters.map((e) => e.id),
    ...spec.eligibilityCriteria.map((c) => c.id),
    ...spec.activities.map((a) => a.id),
  ]);
  const orphans = matrix.filter((r) => !ids.has(r.reqId)).map((r) => r.reqId);
  assert.deepEqual(orphans, [], "matrix rows that point to requirements not in the spec");
});
