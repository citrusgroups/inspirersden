import assert from "node:assert/strict";
import {
  trackingReference,
  nicheVoice,
  cleanMessage,
  basicIntake,
} from "../lib/agent-utils.mjs";

assert.equal(trackingReference("Hello, Reference: INF-0007"), "INF-0007");
assert.equal(trackingReference("ref: inf-fashion-1"), "INF-FASHION-1");
assert.equal(trackingReference("general inquiry"), "");
assert.match(nicheVoice("Food & Recipes"), /warm/);
assert.match(nicheVoice("Travel"), /adventurous/);
assert.equal(cleanMessage("  hello\0  "), "hello");
assert.equal(cleanMessage("x".repeat(5000)).length, 4000);
const intake = basicIntake(
  "Salam, I am from Citrus Brand, budget: PKR 50,000. https://instagram.com/citrus email hi@citrus.pk",
);
assert.equal(intake.brand, "Citrus Brand");
assert.equal(intake.budget, "PKR 50,000");
assert.equal(intake.email, "hi@citrus.pk");
assert.deepEqual(intake.socialLinks, ["https://instagram.com/citrus"]);
assert.equal(intake.romanUrdu, true);
console.log(
  "PASS: agent reference matching, niche voice selection and message sanitization.",
);
