import path from 'node:path';
import fs from 'node:fs';

export const ROOT = path.resolve(import.meta.dirname, '..');
export const BUNDLE_ID = 'com.saucelabs.mydemo.app.ios';

// Local credentials (SAUCE_USERNAME, SAUCE_ACCESS_KEY) live in the git-ignored .env; CI sets them as secrets
const ENV_FILE = path.join(ROOT, '.env');
if (fs.existsSync(ENV_FILE)) process.loadEnvFile(ENV_FILE);

export const config: WebdriverIO.Config = {
    runner: 'local',
    specs: [path.join(ROOT, 'features/**/*.feature')],
    exclude: [],
    maxInstances: 1,

    // Capabilities, services and the per-scenario reset are defined in wdio.sauce.conf.ts and wdio.local.conf.ts
    capabilities: [],

    logLevel: 'warn',
    outputDir: path.join(ROOT, 'logs'),
    bail: 0,
    waitforTimeout: 15000,
    connectionRetryTimeout: 120000,
    connectionRetryCount: 2,

    framework: 'cucumber',
    reporters: [
        'spec',
        ['allure', {
            outputDir: path.join(ROOT, 'allure-results'),
            useCucumberStepReporter: true,
            disableWebdriverStepsReporting: true,
            disableWebdriverScreenshotsReporting: false,
        }],
    ],

    cucumberOpts: {
        require: [path.join(ROOT, 'src/step-definitions/**/*.ts')],
        backtrace: false,
        dryRun: false,
        failFast: false,
        snippets: true,
        source: true,
        strict: false,
        tags: process.env.TAGS ?? '',
        timeout: 120000,
        ignoreUndefinedDefinitions: false,
    },

    onPrepare() {
        fs.mkdirSync(path.join(ROOT, 'logs'), { recursive: true });
    },

    // Attach a screenshot to the report for every failed step
    async afterStep(_step, _scenario, result) {
        if (!result.passed) {
            await browser.takeScreenshot();
        }
    },
};
