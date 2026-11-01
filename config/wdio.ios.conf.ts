import fs from 'node:fs';
import path from 'node:path';
import { config as shared, ROOT } from './wdio.shared.conf.ts';

export const BUNDLE_ID = 'com.saucelabs.mydemo.app.ios';

// The app build is not checked in. Use IOS_APP, or a local copy in apps/ (git-ignored);
// with neither, the app must already be installed on the simulator.
const APP = process.env.IOS_APP ?? path.join(ROOT, 'apps/My_Demo_App.app');

export const config: WebdriverIO.Config = {
    ...shared,
    capabilities: [{
        platformName: 'iOS',
        'appium:automationName': 'XCUITest',
        'appium:deviceName': process.env.IOS_DEVICE ?? 'iPhone 14',
        'appium:platformVersion': process.env.IOS_VERSION,
        // Appium installs this build if the simulator doesn't have it yet
        ...(fs.existsSync(APP) ? { 'appium:app': APP } : {}),
        'appium:bundleId': BUNDLE_ID,
        'appium:newCommandTimeout': 240,
        'appium:wdaLaunchTimeout': 240000,
        'appium:wdaConnectionTimeout': 240000,
    }],

    // Start every scenario from a fresh app with an empty cart
    async beforeScenario() {
        await driver.terminateApp(BUNDLE_ID);
        await driver.execute('mobile: clearApp', { bundleId: BUNDLE_ID });
        await driver.activateApp(BUNDLE_ID);
    },
};
