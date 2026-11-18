// Structural checks a REDCap import would enforce, run offline.
// Exit code 1 on any error so CI blocks the PR.
import {
  DD_HEADER,
  loadArms,
  loadDesignations,
  loadDictionary,
  loadEvents,
  loadLocked,
  formFingerprint,
} from "../lib/redcap.ts";

const FIELD_TYPES = new Set([
  "text", "notes", "dropdown", "radio", "checkbox", "yesno", "truefalse",
  "calc", "file", "slider", "descriptive", "sql",
]);
const VALIDATION_TYPES = new Set([
  "", "date_ymd", "date_mdy", "date_dmy", "datetime_ymd", "time",
  "integer", "number", "email", "phone", "zipcode", "alpha_only",
]);
const NEEDS_CHOICES = new Set(["dropdown", "radio", "checkbox"]);
const NAME_RE = /^[a-z][a-z0-9_]*$/;

const errors: string[] = [];
const err = (where: string, msg: string) => errors.push(`${where}: ${msg}`);

// ---- data dictionary ----
const { header, fields } = loadDictionary();
if (header.length !== DD_HEADER.length || header.some((h, i) => h !== DD_HEADER[i])) {
  err("data_dictionary.csv", "header does not match the 18 standard REDCap columns");
}
if (fields[0]?.name !== "record_id") {
  err("data_dictionary.csv", "first field must be record_id");
}

const names = new Set<string>();
const formOrder: string[] = [];
for (const f of fields) {
  const at = `data_dictionary.csv:${f.line} (${f.name})`;
  if (!NAME_RE.test(f.name)) err(at, "field name must be lowercase letters, digits, underscores, starting with a letter");
  if (f.name.length > 100) err(at, "field name longer than 100 characters");
  if (names.has(f.name)) err(at, "duplicate field name");
  names.add(f.name);
  if (!NAME_RE.test(f.form)) err(at, `invalid form name "${f.form}"`);
  if (!FIELD_TYPES.has(f.type)) err(at, `unknown field type "${f.type}"`);
  if (!f.label.trim()) err(at, "missing field label");
  if (NEEDS_CHOICES.has(f.type)) {
    const ok = f.choices.split("|").every((c) => /^\s*[^,]+,\s*\S.*$/.test(c));
    if (!f.choices || !ok) err(at, `${f.type} needs choices like "1, Label | 2, Label"`);
  }
  if (f.type === "text" && !VALIDATION_TYPES.has(f.validation)) err(at, `unknown validation "${f.validation}"`);
  if ((f.min || f.max) && !["integer", "number"].includes(f.validation) && !f.validation.startsWith("date")) {
    err(at, "min/max set without a numeric or date validation");
  }
  if (f.required && f.required !== "y") err(at, 'Required Field? must be "y" or blank');
  // Forms must be contiguous: once a form ends, it cannot reappear.
  const last = formOrder[formOrder.length - 1];
  if (f.form !== last) {
    if (formOrder.includes(f.form)) err(at, `form "${f.form}" is split; a form's fields must be contiguous`);
    formOrder.push(f.form);
  }
}
// Branching logic may only reference fields that exist.
for (const f of fields) {
  for (const m of f.branching.matchAll(/\[([a-z0-9_]+)\]/g)) {
    if (!names.has(m[1])) err(`data_dictionary.csv:${f.line} (${f.name})`, `branching logic references unknown field [${m[1]}]`);
  }
}
const forms = new Set(formOrder);

// ---- arms, events, designations ----
const arms = new Set(loadArms());
const events = loadEvents();
const eventNames = new Set<string>();
for (const e of events) {
  const at = `events.csv (${e.uniqueName})`;
  if (!arms.has(e.arm)) err(at, `arm ${e.arm} not defined in arms.csv`);
  if (eventNames.has(e.uniqueName)) err(at, "duplicate unique_event_name");
  eventNames.add(e.uniqueName);
  for (const [k, v] of Object.entries({ day_offset: e.dayOffset, offset_min: e.offsetMin, offset_max: e.offsetMax })) {
    if (!Number.isInteger(v) || v < 0) err(at, `${k} must be a non-negative integer`);
  }
}
const designated = new Set<string>();
for (const d of loadDesignations()) {
  const at = `instrument_designation.csv (${d.event} → ${d.form})`;
  if (!eventNames.has(d.event)) err(at, "unknown event");
  if (!forms.has(d.form)) err(at, "unknown form");
  const key = `${d.event}|${d.form}`;
  if (designated.has(key)) err(at, "duplicate designation");
  designated.add(key);
}
for (const form of forms) {
  if (![...designated].some((k) => k.endsWith(`|${form}`))) err(`form ${form}`, "not designated to any event");
}

// ---- locked (validated / licensed) instruments ----
for (const [form, lock] of Object.entries(loadLocked())) {
  if (!forms.has(form)) {
    err(`locked instrument ${form}`, "form was removed");
  } else if (formFingerprint(fields, form) !== lock.sha256) {
    err(`locked instrument ${form}`, `content changed (${lock.reason}). Locked instruments must not be edited.`);
  }
}

if (errors.length) {
  console.error(`✗ ${errors.length} validation error(s):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(`✓ REDCap build valid: ${fields.length} fields, ${forms.size} forms, ${events.length} events, ${designated.size} designations`);
