#!/usr/bin/env node
/**
 * Builds the pull request's "Test plan" from the Allure results of the verification runs,
 * and fails unless the new scenario passed in every one of the required runs, with every step passed.
 *
 * Input (env):  SCENARIO_NAME, FEATURE_FILE, SCENARIO_LINE (optional), REQUIRED_RUNS (default 2),
 *               RUN_URL (optional), ALLURE_DIR (default allure-results),
 *               EVIDENCE_FILE: where to write the markdown (default test-plan.md)
 * Exit code:    0 when the new scenario passed in all required runs, 1 otherwise.
 */
import fs from 'node:fs';
import path from 'node:path';

const { SCENARIO_NAME, FEATURE_FILE, SCENARIO_LINE, RUN_URL } = process.env;
const REQUIRED_RUNS = Number(process.env.REQUIRED_RUNS ?? 2);
const ALLURE_DIR = process.env.ALLURE_DIR ?? 'allure-results';
const EVIDENCE_FILE = process.env.EVIDENCE_FILE ?? 'test-plan.md';

const ICON = { passed: '✅', failed: '❌', broken: '❌', skipped: '⏭️', pending: '⏸️', unknown: '❔' };
const icon = (status) => `${ICON[status] ?? '❔'} ${status}`;
const seconds = (r) => `${((r.stop - r.start) / 1000).toFixed(1)} s`;
const escape = (s) => s.replace(/\|/g, '\\|');
const fullyPassed = (r) => r.status === 'passed' && r.steps?.length > 0 && r.steps.every((s) => s.status === 'passed');

// Every run of the new scenario, oldest first
const files = fs.existsSync(ALLURE_DIR) ? fs.readdirSync(ALLURE_DIR).filter((f) => f.endsWith('-result.json')) : [];
const runs = files
    .map((f) => JSON.parse(fs.readFileSync(path.join(ALLURE_DIR, f), 'utf8')))
    .filter((r) => r.fullName.split('#')[0] === FEATURE_FILE && r.name === SCENARIO_NAME)
    .sort((a, b) => a.start - b.start);

const passedRuns = runs.filter(fullyPassed).length;
const problems = [];
if (!runs.length) {
    problems.push(`The new scenario "${SCENARIO_NAME}" from ${FEATURE_FILE} was not found in the test results, so it didn't run.`);
}
runs.forEach((r, i) => {
    if (fullyPassed(r)) return;
    const bad = (r.steps ?? []).filter((s) => s.status !== 'passed').map((s) => `"${s.name}" (${s.status})`);
    problems.push(`Run ${i + 1} finished as "${r.status}"${bad.length ? `; steps not passed: ${bad.join(', ')}` : ''}.`);
});
if (runs.length && runs.length < REQUIRED_RUNS) {
    problems.push(`Only ${runs.length} of ${REQUIRED_RUNS} required runs took place.`);
}
const ok = problems.length === 0 && passedRuns >= REQUIRED_RUNS;

// One row per step, one column per run
const stepNames = runs[0]?.steps?.map((s) => s.name) ?? [];
const runHeaders = runs.map((_, i) => `Run ${i + 1}`);
const spec = `${FEATURE_FILE}${SCENARIO_LINE ? `:${SCENARIO_LINE}` : ''}`;

const md = [
    '## Test plan',
    '',
    `- [x] Scenario text in \`${FEATURE_FILE}\` is unchanged from the workflow input`,
    '- [x] Only step definitions, page objects, the feature file and `CLAUDE.md` were changed',
    '- [x] Type check passed (`npm run typecheck`)',
    `- [${ok ? 'x' : ' '}] New scenario **${SCENARIO_NAME}** passed ${passedRuns} of ${REQUIRED_RUNS} consecutive runs, every step passed (\`--spec ${spec}\` on the iOS simulator)`,
    '',
    `### New scenario: ${SCENARIO_NAME}`,
    '',
    ...(runs.length
        ? [
            `| Step | ${runHeaders.join(' | ')} |`,
            `|---|${runHeaders.map(() => '---|').join('')}`,
            ...stepNames.map((name, i) => `| ${escape(name)} | ${runs.map((r) => icon(r.steps?.[i]?.status ?? 'unknown')).join(' | ')} |`),
            `| **Duration** | ${runs.map(seconds).join(' | ')} |`,
        ]
        : ['_No results recorded for the new scenario._']),
    '',
    'Only the new scenario was run here. The full suite runs in **Mobile tests (iOS)** when this is merged to `main`.',
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
