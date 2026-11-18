// QA helper: print the fingerprint of a form, used when a human approves a locked instrument.
// Usage: npm run fingerprint -- itch_nrs
import { formFingerprint, loadDictionary } from "../lib/redcap.ts";

const form = process.argv[2];
if (!form) {
  console.error("Usage: npm run fingerprint -- <form_name>");
  process.exit(1);
}
console.log(formFingerprint(loadDictionary().fields, form));
