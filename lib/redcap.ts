// Shared loaders for the REDCap study build and the protocol spec.
// No dependencies: a small RFC 4180 CSV parser is enough for these files.
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

export const ROOT = join(import.meta.dirname, "..");

export const DD_HEADER = [
  "Variable / Field Name",
  "Form Name",
  "Section Header",
  "Field Type",
  "Field Label",
  "Choices, Calculations, OR Slider Labels",
  "Field Note",
  "Text Validation Type OR Show Slider Number",
  "Text Validation Min",
  "Text Validation Max",
  "Identifier?",
  "Branching Logic (Show field only if...)",
  "Required Field?",
  "Custom Alignment",
  "Question Number (surveys only)",
  "Matrix Group Name",
  "Matrix Ranking?",
  "Field Annotation",
] as const;

export interface Field {
  name: string;
  form: string;
  sectionHeader: string;
  type: string;
  label: string;
  choices: string;
  validation: string;
  min: string;
  max: string;
  identifier: string;
  branching: string;
  required: string;
  annotation: string;
  line: number; // 1-based line in the CSV, for error messages
}

export interface Event {
  eventName: string;
  arm: number;
  dayOffset: number;
  offsetMin: number;
  offsetMax: number;
  uniqueName: string;
}

export interface Designation {
  arm: number;
  event: string;
  form: string;
}

export interface MatrixRow {
  reqId: string;
  kind: "encounter" | "criterion" | "activity";
  artifact: string;
  locator: string;
  testId: string;
}

export interface Spec {
  study: { id: string; protocolVersion: string };
  encounters: {
    id: string;
    name: string;
    day: number;
    windowMinus: number;
    windowPlus: number;
    contactModes: string[];
  }[];
  eligibilityCriteria: { id: string; category: "Inclusion" | "Exclusion"; text: string }[];
  activities: { id: string; name: string; encounters: string[]; licensed: boolean; itemCount?: number }[];
}

/** Parse RFC 4180 CSV (quoted fields, escaped quotes, commas/newlines in quotes). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => !(r.length === 1 && r[0] === ""));
}

function readCsv(rel: string): string[][] {
  return parseCsv(readFileSync(join(ROOT, rel), "utf8"));
}

export function loadDictionary(): { header: string[]; fields: Field[] } {
  const [header, ...rows] = readCsv("redcap/data_dictionary.csv");
  const fields = rows.map((r, i) => ({
    name: r[0] ?? "",
    form: r[1] ?? "",
    sectionHeader: r[2] ?? "",
    type: r[3] ?? "",
    label: r[4] ?? "",
    choices: r[5] ?? "",
    validation: r[7] ?? "",
    min: r[8] ?? "",
    max: r[9] ?? "",
    identifier: r[10] ?? "",
    branching: r[11] ?? "",
    required: r[12] ?? "",
    annotation: r[17] ?? "",
    line: i + 2,
  }));
  return { header, fields };
}

export function loadArms(): number[] {
  const [, ...rows] = readCsv("redcap/arms.csv");
  return rows.map((r) => Number(r[0]));
}

export function loadEvents(): Event[] {
  const [, ...rows] = readCsv("redcap/events.csv");
  return rows.map((r) => ({
    eventName: r[0],
    arm: Number(r[1]),
    dayOffset: Number(r[2]),
    offsetMin: Number(r[3]),
    offsetMax: Number(r[4]),
    uniqueName: r[5],
  }));
}

export function loadDesignations(): Designation[] {
  const [, ...rows] = readCsv("redcap/instrument_designation.csv");
  return rows.map((r) => ({ arm: Number(r[0]), event: r[1], form: r[2] }));
}

export function loadMatrix(): MatrixRow[] {
  const [, ...rows] = readCsv("trace/matrix.csv");
  return rows.map((r) => ({
    reqId: r[0],
    kind: r[1] as MatrixRow["kind"],
    artifact: r[2],
    locator: r[3],
    testId: r[4],
  }));
}

export function loadSpec(): Spec {
  return JSON.parse(readFileSync(join(ROOT, "spec/protocol.json"), "utf8"));
}

export function loadLocked(): Record<string, { reason: string; sha256: string }> {
  return JSON.parse(readFileSync(join(ROOT, "trace/locked_instruments.json"), "utf8"));
}

/** Fingerprint of everything a participant reads in a form: names, labels, choices, ranges. */
export function formFingerprint(fields: Field[], form: string): string {
  const content = fields
    .filter((f) => f.form === form)
    .map((f) => [f.name, f.type, f.label, f.choices, f.validation, f.min, f.max].join("|"))
    .join("\n");
  return createHash("sha256").update(content).digest("hex");
}

/** Labels for licensed instruments whose wording has not been supplied yet. */
export const LICENSED_PLACEHOLDER = /^\[\[LICENSED_TEXT_PENDING[^\]]*\]\]$/;
