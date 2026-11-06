#!/usr/bin/env node
/**
 * Local proxy to Sauce Labs for Appium MCP exploration: `npm run explore`, stopped with `npm run explore:stop`.
 * Listens on http://127.0.0.1:4724 and forwards WebDriver requests to Sauce Labs, adding the credentials,
 * so neither Appium MCP nor Claude Code ever sees the access key. Test runs can use it too (SAUCE_HUB_URL).
 *
 * New sessions without "sauce:options" (the ones Appium MCP creates) get this project's real-device
 * capabilities, whatever device they asked for; sessions from wdio.sauce.conf.ts pass through unchanged.
 *
 * Env: SAUCE_USERNAME, SAUCE_ACCESS_KEY (or .env), optional SAUCE_REGION, SAUCE_APP, IOS_DEVICE, IOS_VERSION
 */
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';

if (fs.existsSync('.env')) process.loadEnvFile('.env');
const { SAUCE_USERNAME, SAUCE_ACCESS_KEY, IOS_VERSION } = process.env;
const REGION = process.env.SAUCE_REGION ?? 'us-west-1';
const PORT = 4724;

if (!SAUCE_USERNAME || !SAUCE_ACCESS_KEY) {
    console.error('Set SAUCE_USERNAME and SAUCE_ACCESS_KEY (in .env locally, or as environment variables).');
    process.exit(1);
}

const upstream = `https://ondemand.${REGION}.saucelabs.com/wd/hub`;
const authorization = `Basic ${Buffer.from(`${SAUCE_USERNAME}:${SAUCE_ACCESS_KEY}`).toString('base64')}`;

const explorationCapabilities = {
    platformName: 'iOS',
    'appium:automationName': 'XCUITest',
    'appium:deviceName': process.env.IOS_DEVICE ?? 'iPhone.*',
    ...(IOS_VERSION ? { 'appium:platformVersion': IOS_VERSION } : {}),
    'appium:app': process.env.SAUCE_APP ?? 'storage:filename=SauceLabs-Demo-App.ipa',
    // Exploring means long pauses between commands while Claude thinks
    'appium:newCommandTimeout': 600,
    'sauce:options': { appiumVersion: 'latest', build: 'Appium MCP exploration', name: 'Appium MCP exploration' },
};

function newSessionBody(body) {
    const { alwaysMatch = {}, firstMatch = [] } = body.capabilities ?? {};
    if ([alwaysMatch, ...firstMatch].some((c) => c['sauce:options'])) return body;
    return { capabilities: { alwaysMatch: explorationCapabilities, firstMatch: [{}] } };
}

// Sauce Labs ends a real-device session after 90 s without a command (sauce:options idleTimeout doesn't change
// that), and Claude often thinks for longer between commands. So while a client keeps using a session, a light
// command every 30 s keeps it open; after 30 minutes without client commands it's left to time out.
const KEEPALIVE_MS = 30_000;
const ABANDONED_MS = 30 * 60_000;
const sessions = new Map(); // session id → { lastUsed, timer }

function forget(id) {
    clearInterval(sessions.get(id)?.timer);
    sessions.delete(id);
}

function keepAlive(id) {
    const session = { lastUsed: Date.now() };
    session.timer = setInterval(() => {
        if (Date.now() - session.lastUsed > ABANDONED_MS) return forget(id);
        https.request(`${upstream}/session/${id}/timeouts`, { headers: { authorization, accept: 'application/json' } }, (res) => {
            res.resume();
            if (res.statusCode === 404) forget(id);
        }).on('error', () => {}).end();
    }, KEEPALIVE_MS);
    sessions.set(id, session);
}

const reply = (res, status, value) => {
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ value }));
};

const server = http.createServer(async (req, res) => {
    const path = req.url.replace(/^\/wd\/hub/, '') || '/';
    // Answered locally: Sauce Labs has no Appium-style /status, and readiness checks shouldn't need the network
    if (req.method === 'GET' && path === '/status') {
        return reply(res, 200, { ready: true, message: `Proxy to Sauce Labs (${REGION})` });
    }

    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    let body = Buffer.concat(chunks);
    const sessionId = path.match(/^\/session\/([^/]+)/)?.[1];
    if (sessionId && sessions.has(sessionId)) sessions.get(sessionId).lastUsed = Date.now();
    if (req.method === 'DELETE' && sessionId && path === `/session/${sessionId}`) forget(sessionId);
    const isNewSession = req.method === 'POST' && /^\/session\/?$/.test(path);
    if (isNewSession) {
        try {
            body = Buffer.from(JSON.stringify(newSessionBody(JSON.parse(body.toString() || '{}'))));
        } catch {
            return reply(res, 400, { error: 'invalid argument', message: 'New session body is not valid JSON' });
        }
        console.log(`${new Date().toISOString()} new session → Sauce Labs ${REGION}`);
    }

    const forwarded = https.request(`${upstream}${path}`, {
        method: req.method,
        headers: {
            authorization,
            accept: 'application/json',
            'content-type': 'application/json; charset=utf-8',
            'content-length': body.length,
        },
    }, async (upstreamRes) => {
        res.writeHead(upstreamRes.statusCode ?? 502, upstreamRes.headers);
        if (!isNewSession) return upstreamRes.pipe(res);
        // Read the new session's id so it can be kept alive
        const parts = [];
        for await (const part of upstreamRes) parts.push(part);
        const response = Buffer.concat(parts);
        try {
            const id = JSON.parse(response.toString()).value?.sessionId;
            if (id) keepAlive(id);
        } catch { /* not JSON: nothing to keep alive */ }
        res.end(response);
    });
    forwarded.on('error', (error) => reply(res, 502, { error: 'unknown error', message: `Sauce Labs proxy: ${error.message}` }));
    forwarded.end(body);
});

// Creating a real-device session can take minutes
server.requestTimeout = 0;
server.listen(PORT, '127.0.0.1', () => console.log(`Sauce Labs proxy (${REGION}) listening on http://127.0.0.1:${PORT}`));
