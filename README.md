# ABC-101 study build (REDCap, as code)

Synthetic EDC build for a fictional Phase 2 psoriasis study, used to demonstrate protocol-amendment change control:
**spec change → build change → conformance tests → traceability → human-reviewed pull request.**

- `spec/protocol.json` is the requirements baseline (simplified, USDM-inspired).
- `redcap/` holds REDCap import files: data dictionary, arms, events, instrument designation.
- `trace/matrix.csv` links every requirement to the artifact that implements it and the test that proves it.
- CI runs `npm run validate` (REDCap structure) and `npm test` (conformance). `main` requires a passing CI check and one approval,
  mirroring REDCap's Draft Mode review for changes to production projects.

All study content is fictional. Instrument names (Itch NRS, PSQ-5) are placeholders, not real licensed instruments.

```bash
npm install
npm run check
```
