# AGENTS.md: ABC-101 REDCap study build

This repo is the electronic data capture (EDC) build for clinical study ABC-101, kept as code.
`spec/protocol.json` is the requirements baseline (a simplified, USDM-inspired subset of the protocol).
The REDCap files in `redcap/` implement it. Conformance tests prove they match.

## Layout

| Path | What it is |
|---|---|
| `spec/protocol.json` | Requirements: encounters (visits), eligibility criteria, activities (Schedule of Activities) |
| `redcap/data_dictionary.csv` | Fields and forms (standard 18-column REDCap data dictionary) |
| `redcap/arms.csv`, `redcap/events.csv` | Arms and visits, with day offset and window (offset_min / offset_max) |
| `redcap/instrument_designation.csv` | Which form is collected at which event (the SoA grid) |
| `trace/matrix.csv` | Requirement ID → artifact → locator → test ID |
| `trace/locked_instruments.json` | Fingerprints of validated instruments. **Never edit.** |
| `validator/`, `tests/`, `lib/` | The checks. **Never edit.** |

## Commands

```bash
npm install
npm run validate   # structural REDCap checks (what an import would reject)
npm test           # conformance: build implements spec, one test per requirement
npm run check      # both
```

## How to implement a protocol amendment

1. Replace `spec/protocol.json` with the amended spec you were given, unchanged.
2. Run `npm run check` to see which requirements now fail.
3. Change only what those requirements need:
   - **Encounter window or day changed** → edit that row in `redcap/events.csv`.
   - **New eligibility criterion** → add a `yesno`, required field on the `eligibility` form, in the right section
     (inclusion fields before the "Exclusion criteria" header, exclusion fields after it, before the eligibility decision).
     Set Field Annotation to `REQ:<ID>`. Use a descriptive name, e.g. `excl_prior_biologic`.
   - **New activity** → add a new form (fields contiguous, after the existing forms), then one designation row per encounter.
   - **Activity schedule changed** → add or remove rows in `redcap/instrument_designation.csv`.
4. Add or update the row in `trace/matrix.csv` for every new or changed requirement
   (`test_id` is always `conformance/<REQ_ID>`).
5. Run `npm run check` until it passes. Do not stop with failing checks.

## Hard rules

- **Never edit** `validator/`, `tests/`, `lib/`, or `trace/locked_instruments.json`. If a check seems wrong, say so in the PR. Do not change the check.
- **Never write wording for a licensed instrument** (`"licensed": true` in the spec).
  - Existing locked instruments (`trace/locked_instruments.json`): do not change any field, label, choice or range.
  - New licensed instruments: create `<form>_date` plus one field per item, with labels exactly
    `[[LICENSED_TEXT_PENDING item N]]`, field type `text` and no choices (response options also come from the licensor).
    Item text comes from the licensor, never from you.
    List the instrument under **Needs human action** in the PR.
- **Do not guess.** If a change has no REDCap equivalent or is ambiguous (for example, a change to `contactModes`,
  such as a visit becoming remote), do not invent fields or logic. List it under **Open questions** in the PR,
  saying what is ambiguous and what decision is needed.
- Touch only the files a change requires. No reformatting, reordering or cleanup of unrelated rows.
- Keep CSV formatting consistent with existing rows (same quoting style, no trailing spaces).

## Pull request description

Use exactly these sections:

```
## Amendment
<protocol version and amendment number>

## Changes implemented
| Requirement | Change | Files |
|---|---|---|

## Needs human action
<licensed instruments needing licensor text, anything requiring QA sign-off>

## Open questions
<ambiguous or non-implementable changes, and the decision needed>

## Checks
<output summary of npm run check>
```
