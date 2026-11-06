#!/usr/bin/env node
/**
 * Uploads My Demo App to Sauce Labs app storage, where wdio.sauce.conf.ts finds it as
 * `storage:filename=SauceLabs-Demo-App.ipa` (the newest upload with that name wins).
 *
 *   npm run sauce:upload                  # downloads the release build from GitHub, then uploads it
 *   npm run sauce:upload -- path/to.ipa   # uploads a local build instead
 *
 * Env: SAUCE_USERNAME, SAUCE_ACCESS_KEY (or .env), optional SAUCE_REGION
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const RELEASE_URL = 'https://github.com/saucelabs/my-demo-app-ios/releases/download/2.3.0/SauceLabs-Demo-App.ipa';
const NAME = 'SauceLabs-Demo-App.ipa';

if (fs.existsSync('.env')) process.loadEnvFile('.env');
const { SAUCE_USERNAME, SAUCE_ACCESS_KEY } = process.env;
const REGION = process.env.SAUCE_REGION ?? 'us-west-1';
if (!SAUCE_USERNAME || !SAUCE_ACCESS_KEY) {
    console.error('Set SAUCE_USERNAME and SAUCE_ACCESS_KEY (in .env locally, or as environment variables).');
    process.exit(1);
}

let file = process.argv[2];
if (!file) {
    file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mydemoapp-')), NAME);
    console.log(`Downloading ${RELEASE_URL}`);
    const download = await fetch(RELEASE_URL);
    if (!download.ok) throw new Error(`Download failed: HTTP ${download.status}`);
    fs.writeFileSync(file, Buffer.from(await download.arrayBuffer()));
}

const form = new FormData();
form.append('payload', await fs.openAsBlob(file), NAME);
form.append('name', NAME);

const response = await fetch(`https://api.${REGION}.saucelabs.com/v1/storage/upload`, {
    method: 'POST',
    headers: { authorization: `Basic ${Buffer.from(`${SAUCE_USERNAME}:${SAUCE_ACCESS_KEY}`).toString('base64')}` },
    body: form,
});
if (!response.ok) throw new Error(`Upload failed: HTTP ${response.status} ${await response.text()}`);
const { item } = await response.json();
console.log(`Uploaded ${item.name} (${item.metadata?.identifier}) to Sauce Labs ${REGION} app storage, id ${item.id}`);
