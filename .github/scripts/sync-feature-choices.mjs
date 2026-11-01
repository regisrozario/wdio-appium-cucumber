#!/usr/bin/env node
/**
 * Rewrites the feature_file dropdown in the "Implement scenario (AI)" workflow so it lists
 * every features/*.feature file. GitHub's choice inputs are static, so run this after
 * adding or removing a feature file: `npm run sync:feature-choices`.
 * With --check, exits non-zero if the list is out of date instead of rewriting it.
 */
import fs from 'node:fs';

const WORKFLOW = '.github/workflows/implement-scenario.yml';
const START = /^(\s*)# feature-files:start.*$/m;
const END = /^\s*# feature-files:end.*$/m;

const files = fs.readdirSync('features').filter((f) => f.endsWith('.feature')).sort().map((f) => `features/${f}`);
const yaml = fs.readFileSync(WORKFLOW, 'utf8');

const start = yaml.match(START);
const end = yaml.match(END);
if (!start || !end || end.index < start.index) {
    console.error(`Couldn't find the "# feature-files:start" / "# feature-files:end" markers in ${WORKFLOW}.`);
    process.exit(1);
}

const indent = start[1];
const startLineEnd = start.index + start[0].length;
const updated = yaml.slice(0, startLineEnd) + '\n'
    + files.map((f) => `${indent}- ${f}\n`).join('')
    + yaml.slice(end.index);

if (process.argv.includes('--check')) {
    if (updated !== yaml) {
        console.error(`The feature_file dropdown in ${WORKFLOW} is out of date; run \`npm run sync:feature-choices\`.`);
        process.exit(1);
    }
    console.log('Feature file dropdown is up to date.');
} else {
    fs.writeFileSync(WORKFLOW, updated);
    console.log(`Dropdown now lists: ${files.join(', ')}`);
}
