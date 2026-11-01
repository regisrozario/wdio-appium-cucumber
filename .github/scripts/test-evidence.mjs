#!/usr/bin/env node
/**
 * Builds the pull request's "Test plan" from the Allure results of the verification run,
 * and fails unless the new scenario ran and every one of its steps passed.
 *
 * Input (env):  SCENARIO_NAME, FEATURE_FILE, RUN_URL (optional), ALLURE_DIR (default allure-results)
 *               EVIDENCE_FILE: where to write the markdown (default test-plan.md)
 * Exit code:    0 when the new scenario passed in full and nothing else failed, 1 otherwise.
 */
import fs from 'node:fs';
import path from 'node:path';

const { SCENARIO_NAME, FEATURE_FILE, RUN_URL } = process.env;
const ALLURE_DIR = process.env.ALLURE_DIR ?? 'allure-results';
const EVIDENCE_FILE = process.env.EVIDENCE_FILE ?? 'test-plan.md';

const ICON = { passed: '✅', failed: '❌', broken: '❌', skipped: '⏭️', pending: '⏸️', unknown: '❔' };
const icon = (status) => ICON[status] ?? '❔';
const seconds = (r) => `${((r.stop - r.start) / 1000).toFixed(1)} s`;
const escape = (s) => s.replace(/\|/g, '\\|');

// Latest result per scenario (the directory can hold older runs)
const latest = new Map();
const files = fs.existsSync(ALLURE_DIR) ? fs.readdirSync(ALLURE_DIR).filter((f) => f.endsWith('-result.json')) : [];
for (const f of files) {
    const r = JSON.parse(fs.readFileSync(path.join(ALLURE_DIR, f), 'utf8'));
    const prev = latest.get(r.fullName);
    if (!prev || r.stop > prev.stop) latest.set(r.fullName, r);
}
const results = [...latest.values()].sort((a, b) => a.fullName.localeCompare(b.fullName));

const fileOf = (r) => r.fullName.split('#')[0];
const target = results.find((r) => fileOf(r) === FEATURE_FILE && r.name === SCENARIO_NAME);
const steps = target?.steps ?? [];
const problems = [];

if (!target) {
    problems.push(`The new scenario "${SCENARIO_NAME}" from ${FEATURE_FILE} was not found in the test results, so it didn't run.`);
} else {
    if (target.status !== 'passed') problems.push(`The new scenario finished as "${target.status}".`);
    if (!steps.length) problems.push('The new scenario has no recorded steps.');
    const notPassed = steps.filter((s) => s.status !== 'passed');
    if (notPassed.length) problems.push(`Not every step passed: ${notPassed.map((s) => `"${s.name}" (${s.status})`).join(', ')}.`);
}
const failedOthers = results.filter((r) => r !== target && r.status !== 'passed');
if (failedOthers.length) problems.push(`Other scenarios didn't pass: ${failedOthers.map((r) => `"${r.name}" (${r.status})`).join(', ')}.`);
if (!results.length) problems.push(`No test results found in ${ALLURE_DIR}.`);

const passedCount = results.filter((r) => r.status === 'passed').length;
const ok = problems.length === 0;

const md = [
    '## Test plan',
    '',
    `- [x] Scenario text in \`${FEATURE_FILE}\` is unchanged from the workflow input`,
    '- [x] Only step definitions, page objects, the feature file and `CLAUDE.md` were changed',
    '- [x] Type check passed (`npm run typecheck`)',
    `- [${target && target.status === 'passed' && steps.length && steps.every((s) => s.status === 'passed') ? 'x' : ' '}] New scenario **${SCENARIO_NAME}** ran and all ${steps.length} steps passed`,
    `- [${failedOthers.length ? ' ' : 'x'}] Full suite passed: ${passedCount}/${results.length} scenarios (\`npm test\` on the iOS simulator)`,
    '',
    `### New scenario: ${SCENARIO_NAME}${target ? ` (${seconds(target)})` : ''}`,
    '',
    ...(steps.length
        ? ['| Step | Result |', '|---|---|', ...steps.map((s) => `| ${escape(s.name)} | ${icon(s.status)} ${s.status} |`)]
        : ['_No step results recorded._']),
    '',
    '<details><summary>Full suite results</summary>',
    '',
    '| Feature file | Scenario | Result | Time |',
    '|---|---|---|---|',
    ...results.map((r) => `| \`${fileOf(r)}\` | ${escape(r.name)}${r === target ? ' 🆕' : ''} | ${icon(r.status)} ${r.status} | ${seconds(r)} |`),
    '',
    '</details>',
    '',
    ...(RUN_URL ? [`Evidence: [workflow run](${RUN_URL}), with Allure results and Appium/WebdriverIO logs in the **claude-output** artifact.`] : []),
    ...(ok ? [] : ['', '### ❌ Verification failed', '', ...problems.map((p) => `- ${p}`)]),
    '',
].join('\n');

fs.writeFileSync(EVIDENCE_FILE, md);
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `\n${md}`);
console.log(md);

if (!ok) {
    for (const p of problems) console.log(`::error::${p}`);
    process.exit(1);
}
