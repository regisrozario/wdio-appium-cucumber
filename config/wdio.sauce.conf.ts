import allureReporter from '@wdio/allure-reporter';
import { config as shared } from './wdio.shared.conf.ts';

/**
 * Runs on a real iPhone at Sauce Labs: `npm test`.
 * Needs SAUCE_USERNAME and SAUCE_ACCESS_KEY (in .env locally, secrets in CI), unless SAUCE_HUB_URL points
 * at the local credentials proxy (`npm run explore`), which adds them itself.
 */

const REGION = process.env.SAUCE_REGION ?? 'us-west-1';
const hub = new URL(process.env.SAUCE_HUB_URL ?? `https://ondemand.${REGION}.saucelabs.com/wd/hub`);

// Set once in the launcher, so every worker (one per feature file) reports to the same Sauce build
process.env.SAUCE_BUILD ??= `Local run ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`;

const sauceOptions = {
    appiumVersion: 'latest',
    build: process.env.SAUCE_BUILD,
    name: 'My Demo App',
};

const capability: WebdriverIO.Capabilities = {
    platformName: 'iOS',
    'appium:automationName': 'XCUITest',
    // Real-device names accept regular expressions: "iPhone.*" takes any free iPhone
    'appium:deviceName': process.env.IOS_DEVICE ?? 'iPhone.*',
    ...(process.env.IOS_VERSION ? { 'appium:platformVersion': process.env.IOS_VERSION } : {}),
    // Uploaded to Sauce Labs app storage with `npm run sauce:upload`
    'appium:app': process.env.SAUCE_APP ?? 'storage:filename=SauceLabs-Demo-App.ipa',
    'appium:newCommandTimeout': 240,
    'sauce:options': sauceOptions,
};

let sessionUsed = false;

export const config: WebdriverIO.Config = {
    ...shared,
    protocol: hub.protocol.replace(':', '') as 'http' | 'https',
    hostname: hub.hostname,
    port: Number(hub.port) || (hub.protocol === 'https:' ? 443 : 80),
    path: hub.pathname,
    ...(process.env.SAUCE_HUB_URL ? {} : { user: process.env.SAUCE_USERNAME, key: process.env.SAUCE_ACCESS_KEY }),
    // A real device can take a while to free up
    connectionRetryTimeout: 300000,

    capabilities: [capability],

    // Real devices can't clear app data (`mobile: clearApp` is simulator-only), so every scenario after the
    // first gets a new session, which installs the app afresh. Each scenario becomes its own Sauce job.
    async beforeScenario(world) {
        const name = `${world.gherkinDocument.feature?.name ?? 'Feature'}: ${world.pickle.name}`;
        if (sessionUsed) {
            await browser.reloadSession({ ...capability, 'sauce:options': { ...sauceOptions, name } });
        } else {
            await browser.execute(`sauce:job-name=${name}`);
        }
        sessionUsed = true;
    },

    async afterScenario(_world, result) {
        await browser.execute(`sauce:job-result=${result.passed ? 'passed' : 'failed'}`);
        await allureReporter.addLink(`https://app.saucelabs.com/tests/${browser.sessionId}`, 'Sauce Labs job (video, logs)');
    },
};
