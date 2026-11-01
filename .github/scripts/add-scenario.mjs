#!/usr/bin/env node
/**
 * Adds a scenario, given on one line with steps separated by " | ", to a feature file
 * (creating the file if needed), after a BDD review (see scenario-lint.mjs) and a Gherkin syntax check.
 *
 * Input (env):  SCENARIO      e.g. "@smoke Scenario: Sort by price | Given … | When … | Then …"
 *               FEATURE_FILE  e.g. "features/catalog-sort.feature"
 *               REVIEW_FILE   optional: where to write the review as markdown, for the pull request
 * Output:       GITHUB_OUTPUT keys scenario_name, scenario_line, created; exits non-zero with a message on bad input.
 */
import fs from 'node:fs';
import path from 'node:path';
import { AstBuilder, GherkinClassicTokenMatcher, Parser } from '@cucumber/gherkin';
import { IdGenerator } from '@cucumber/messages';
import { lintScenario, loadStepDefinitions } from './scenario-lint.mjs';

const fail = (message) => {
    console.error(`::error::${message}`);
    process.exit(1);
};

const scenarioInput = (process.env.SCENARIO ?? '').trim();
const featureFile = (process.env.FEATURE_FILE ?? '').trim();

if (!/^features\/[A-Za-z0-9][A-Za-z0-9_-]*\.feature$/.test(featureFile)) {
    fail(`Feature file must look like "features/<name>.feature" (letters, digits, "-" or "_"); got "${featureFile}".`);
}
if (!scenarioInput) fail('Scenario is empty.');

// Split "@tag Scenario: X | Given a | When b | Then c" into Gherkin lines
const segments = scenarioInput.split(/\s+\|\s+/).map((s) => s.trim()).filter(Boolean);
const lines = [];
const steps = [];
let scenarioName;
let sawWhen = false;
let sawThen = false;

for (const segment of segments) {
    const header = segment.match(/^((?:@\S+\s+)*)(Scenario|Example):\s*(.+)$/);
    if (header) {
        if (scenarioName) fail('Only one scenario can be added per run.');
        if (lines.length) fail(`Steps must come after the "Scenario:" line; found "${lines[0].trim()}" first.`);
        const tags = header[1].trim();
        scenarioName = header[3].trim();
        if (tags) lines.push(`  ${tags}`);
        lines.push(`  Scenario: ${scenarioName}`);
        continue;
    }
    const step = segment.match(/^(Given|When|Then|And|But)\s+\S/);
    if (!step) {
        fail(`"${segment}" isn't a "Scenario:" line or a Given/When/Then/And/But step. `
            + 'Data tables and Scenario Outlines aren\'t supported in this form.');
    }
    if (!scenarioName) fail('The scenario must start with "Scenario: <name>" (optionally preceded by tags such as @smoke).');
    if (step[1] === 'When') sawWhen = true;
    if (step[1] === 'Then') sawThen = true;
    steps.push({ keyword: step[1], text: segment.slice(step[1].length).trim() });
    lines.push(`    ${segment}`);
}

if (!scenarioName) fail('Missing "Scenario: <name>".');
if (!sawWhen || !sawThen) fail('The scenario needs at least one "When" and one "Then" step.');

// BDD review: errors stop here, before anything is written; warnings are reported and the run continues
const review = lintScenario({ name: scenarioName, steps }, loadStepDefinitions());
const reviewMd = [
    '## Scenario review',
    '',
    ...review.errors.map((e) => `- ❌ ${e}`),
    ...review.warnings.map((w) => `- ⚠️ ${w}`),
    ...(review.errors.length || review.warnings.length ? [] : ['- ✅ Follows the BDD checks (Given → When → Then, intent-level wording, no duplicate steps).']),
    `- Reuses ${review.reused.length} existing step(s); ${review.fresh.length} new step(s) to implement${review.fresh.length ? ':' : '.'}`,
    ...review.fresh.map((s) => `  - ${s.text}`),
    '',
].join('\n');
console.log(reviewMd);
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `\n${reviewMd}`);
if (process.env.REVIEW_FILE) fs.writeFileSync(process.env.REVIEW_FILE, reviewMd);
for (const w of review.warnings) console.log(`::warning::${w}`);
if (review.errors.length) {
    for (const e of review.errors.slice(0, -1)) console.error(`::error::${e}`);
    fail(review.errors.at(-1));
}

// Append to the feature file, or create it with a header derived from the file name
const block = lines.join('\n') + '\n';
const exists = fs.existsSync(featureFile);
let content;
if (exists) {
    const current = fs.readFileSync(featureFile, 'utf8');
    const names = [...current.matchAll(/^\s*Scenario(?: Outline)?:\s*(.+?)\s*$/gm)].map((m) => m[1]);
    if (names.includes(scenarioName)) fail(`${featureFile} already has a scenario named "${scenarioName}".`);
    content = current.replace(/\s*$/, '\n') + '\n' + block;
} else {
    const base = path.basename(featureFile, '.feature').replace(/[-_]+/g, ' ');
    const title = base.charAt(0).toUpperCase() + base.slice(1);
    content = `Feature: ${title}\n\n${block}`;
}

// Reject anything Cucumber couldn't parse
try {
    new Parser(new AstBuilder(IdGenerator.uuid()), new GherkinClassicTokenMatcher()).parse(content);
} catch (error) {
    fail(`The resulting feature file isn't valid Gherkin: ${error.message}`);
}

fs.writeFileSync(featureFile, content);

// 1-based line of the "Scenario:" keyword, so the scenario can be run on its own (--spec file:line)
const scenarioLine = content.split('\n').findIndex((l) => l.trim() === `Scenario: ${scenarioName}`) + 1;
console.log(`${exists ? 'Added scenario to' : 'Created'} ${featureFile} (line ${scenarioLine}):\n\n${block}`);

if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `scenario_name=${scenarioName}\nscenario_line=${scenarioLine}\ncreated=${!exists}\n`);
}
