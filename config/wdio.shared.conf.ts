import path from 'node:path';
import fs from 'node:fs';

export const ROOT = path.resolve(import.meta.dirname, '..');

export const config: WebdriverIO.Config = {
    runner: 'local',
    specs: [path.join(ROOT, 'features/**/*.feature')],
    exclude: [],
    maxInstances: 1,

    // Capabilities are defined in the platform-specific configs
    capabilities: [],

    logLevel: 'warn',
    outputDir: path.join(ROOT, 'logs'),
    bail: 0,
    waitforTimeout: 15000,
    connectionRetryTimeout: 120000,
    connectionRetryCount: 2,

    // Appium server is started/stopped automatically from the local node_modules
    services: [
        ['appium', {
            command: 'appium',
            args: {
                relaxedSecurity: true,
                log: path.join(ROOT, 'logs/appium.log'),
            },
        }],
    ],

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
