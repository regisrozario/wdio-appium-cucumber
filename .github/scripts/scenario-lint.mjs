/**
 * BDD review of one scenario, run before any automation starts.
 * Errors block the run; warnings are reported (job summary, pull request) but don't block it.
 *
 *   lintScenario({ name, steps: [{ keyword, text }] }, stepDefinitions) → { errors, warnings, reused, fresh }
 *   loadStepDefinitions(dir) → [{ keyword, expression, file }] read from the step definition sources
 */
import fs from 'node:fs';
import path from 'node:path';
import { CucumberExpression, ParameterTypeRegistry } from '@cucumber/cucumber-expressions';

const MAX_STEPS = 8;
const SIMILARITY_THRESHOLD = 0.6;

// Selectors, coordinates and fixed waits belong in page objects, never in the scenario
const IMPLEMENTATION_DETAILS = [
    [/xpath|\/\/\w|XCUIElementType|accessibility id|predicate string|class chain|\bselector\b|\blocator\b/i, 'mentions a selector'],
    [/(^|[\s"'])~\w/, 'mentions an accessibility id'],
    [/\(\s*\d+\s*,\s*\d+\s*\)|\b[xy]\s*=\s*\d+/i, 'mentions screen coordinates'],
    [/\b(wait|sleep|pause)\s+(for\s+)?\d+\s*(ms|milliseconds?|s|secs?|seconds?)\b/i, 'uses a fixed wait'],
];
const UI_MECHANICS = /\b(click(s|ed)?|tap(s|ped)?|press(es|ed)?|swipe[sd]?|scroll(s|ed)?|button)\b/i;
const GENERIC_NAME = /^(test|scenario|example|tc|case)[\s_-]*\d*$/i;
const STOP_WORDS = new Set(['i', 'the', 'a', 'an', 'should', 'be', 'is', 'are', 'to', 'on', 'of', 'from', 'my', 'it', 'that', 'see', 'can', 'will', 'has', 'have']);

const registry = new ParameterTypeRegistry();
const withoutQuotes = (text) => text.replace(/"[^"]*"|'[^']*'/g, '""');

/** Lower-cased content words without arguments (values differ between steps), plural "s" dropped */
function tokens(text) {
    return text
        .toLowerCase()
        .replace(/"[^"]*"|'[^']*'|\{\w*\}|\b\d+\b/g, ' ')
        .replace(/\(s\)/g, '')
        .replace(/[^a-z\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w && !STOP_WORDS.has(w))
        .map((w) => (w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w));
}

/** Dice coefficient of the two token sets: 1 = same words, 0 = nothing in common */
function similarity(a, b) {
    const setA = new Set(tokens(a));
    const setB = new Set(tokens(b));
    if (!setA.size || !setB.size) return 0;
    const shared = [...setA].filter((w) => setB.has(w)).length;
    return (2 * shared) / (setA.size + setB.size);
}

export function loadStepDefinitions(dir = 'src/step-definitions') {
    if (!fs.existsSync(dir)) return [];
    const pattern = /\b(Given|When|Then)\(\s*(['"`])((?:\\.|(?!\2).)*)\2/g;
    return fs.readdirSync(dir).filter((f) => f.endsWith('.ts')).flatMap((f) => {
        const source = fs.readFileSync(path.join(dir, f), 'utf8');
        return [...source.matchAll(pattern)].map((m) => ({ keyword: m[1], expression: m[3].replace(/\\(.)/g, '$1'), file: f }));
    });
}

export function lintScenario({ name, steps }, stepDefinitions = []) {
    const errors = [];
    const warnings = [];
    const reused = [];
    const fresh = [];

    // Name: says which behaviour is tested
    if (name.trim().split(/\s+/).length < 2 || GENERIC_NAME.test(name.trim())) {
        errors.push(`Scenario name "${name}" doesn't describe the behaviour; use something like "Remove a backpack from the cart".`);
    }

    // Order: Given → When → Then, one behaviour per scenario
    const rank = { Given: 0, When: 1, Then: 2 };
    let current;
    steps.forEach(({ keyword, text }, i) => {
        const step = `"${keyword} ${text}"`;
        if (keyword === 'And' || keyword === 'But') {
            if (i === 0) errors.push(`${step} can't be the first step; start with Given, When or Then.`);
            return;
        }
        if (current && rank[keyword] < rank[current]) {
            errors.push(current === 'Then' && keyword === 'When'
                ? `${step} comes after a Then. A scenario should test one behaviour (Given → When → Then); split it into two scenarios, or move the setup into a Given.`
                : `${step} comes after a ${current}; steps must go Given → When → Then.`);
        }
        current = keyword;
    });

    // Wording
    for (const { keyword, text } of steps) {
        const step = `"${keyword} ${text}"`;
        for (const [pattern, problem] of IMPLEMENTATION_DETAILS) {
            if (pattern.test(text)) errors.push(`${step} ${problem}; describe what the user does or sees, and leave how to the step definition.`);
        }
        if (UI_MECHANICS.test(withoutQuotes(text))) {
            warnings.push(`${step} describes a UI action; prefer the user's intent, e.g. "I remove \\"X\\" from the cart" rather than "I click Remove".`);
        }
    }
    const firstPerson = steps.filter(({ text }) => /^(I|I'm|my)\b/.test(text)).length;
    const thirdPerson = steps.filter(({ text }) => /^(the |a )?(user|customer|shopper)\b/i.test(text)).length;
    if (firstPerson && thirdPerson) warnings.push('Steps mix "I …" and "the user …"; pick one voice (this project uses "I …").');
    if (steps.length > MAX_STEPS) warnings.push(`${steps.length} steps (more than ${MAX_STEPS}) usually means more than one behaviour; consider splitting the scenario.`);

    // Reuse: exact matches are existing steps; close wording to an existing step is probably a duplicate
    const expressions = stepDefinitions.map((d) => ({ ...d, matcher: new CucumberExpression(d.expression, registry) }));
    for (const { keyword, text } of steps) {
        const match = expressions.find((d) => d.matcher.match(text));
        if (match) {
            reused.push({ text, expression: match.expression, file: match.file });
            continue;
        }
        fresh.push({ text });
        const closest = expressions
            .map((d) => ({ ...d, score: similarity(text, d.expression) }))
            .sort((a, b) => b.score - a.score)[0];
        if (closest && closest.score >= SIMILARITY_THRESHOLD) {
            warnings.push(`"${keyword} ${text}" looks like the existing step "${closest.expression}" (${closest.file}). `
                + 'Reword it to match, so no duplicate step definition is added.');
        }
    }

    return { errors, warnings, reused, fresh };
}
