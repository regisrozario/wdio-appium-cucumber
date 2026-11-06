# wdio-appium-cucumber

Mobile UI tests for **Sauce Labs My Demo App (iOS)** with WebdriverIO 9, Appium 3 (XCUITest driver) and Cucumber BDD, in TypeScript (ESM, `.ts` import extensions).

Tests run on **real iPhones at Sauce Labs** (region `us-west-1`): WebdriverIO runs on this machine, Appium and the devices are at Sauce Labs. A local simulator config is kept for debugging. Credentials (`SAUCE_USERNAME`, `SAUCE_ACCESS_KEY`) come from the git-ignored `.env` locally and from repository secrets in CI; never print, copy or commit them.

## Commands

| Command | Purpose |
|---|---|
| `npm test` | Run all features on Sauce Labs real iPhones |
| `npx wdio run ./config/wdio.sauce.conf.ts --spec ./features/x.feature:<line>` | Run one feature, or one scenario by the line of its `Scenario:` |
| `npm run test:local` | Run on a local iOS simulator (needs Xcode; starts its own Appium on port 4723) |
| `npm run test:dry-run -- features/x.feature` | Cucumber dry run, no device needed; undefined steps are marked `Undefined.` with a snippet |
| `npm run typecheck` | TypeScript check |
| `npm run explore` | Sauce Labs proxy on port **4724** for Appium MCP exploration |
| `npm run explore:local` | Local Appium on port 4724 instead, to explore the local simulator |
| `npm run explore:stop` | Stop whatever is on port 4724 |
| `npm run sauce:upload` | Upload My Demo App (`SauceLabs-Demo-App.ipa`) to Sauce Labs app storage |

## Layout

- `features/*.feature` — Gherkin, written by humans. Don't rewrite scenarios to fit the code; ask instead. One behaviour per scenario (Given → When → Then), steps in the user's words ("I remove … from the cart", not "click Remove"), reusing existing step wording. The AI workflow enforces this before implementing (`.github/scripts/scenario-lint.mjs`).
- `src/step-definitions/*.steps.ts` — one file per area (`app`, `cart`, `checkout`, …).
- `src/pageobjects/*.ts` — one page object per screen, exported as a singleton (`export default new XScreen()`).
- `config/wdio.shared.conf.ts` — framework, reporters, `.env` loading. `config/wdio.sauce.conf.ts` — Sauce Labs real-device capabilities; every scenario after the first gets a new session (`browser.reloadSession`), which reinstalls the app, because `mobile: clearApp` only works on simulators. Each scenario is its own Sauce job, named and marked passed/failed. `config/wdio.local.conf.ts` — local simulator, reset by terminate → `mobile: clearApp` → activate. Either way every scenario starts on the catalog with an empty cart.
- `scripts/sauce-proxy.mjs` — the port-4724 proxy that adds the Sauce credentials; `scripts/sauce-upload.mjs` — app upload.

## Conventions

- **Screens** extend `BaseScreen` with the screen's root selector, usually its `<Name>-screen` accessibility id (`~Catalog-screen`, `~Cart-screen`, `~ProductDetails-screen`, `~ShippingAddress-screen`). Look elements up inside `this.screen.$(...)` so matches stay scoped to the screen.
- **Selector preference:** accessibility id (`~id`) → `-ios predicate string` → `-ios class chain`. Never XPath, never coordinates.
- **Hidden duplicates exist** (e.g. the cart's hidden "No Items" label). When a label can appear twice, add `AND visible == 1` to the predicate.
- **Text field values:** read with `toHaveAttribute('value', …)`; `toHaveValue` isn't supported by the iOS driver.
- **Steps** stay thin: they call page-object methods and make `expect` assertions. Reuse existing steps before adding new ones (check every file in `src/step-definitions/`). Use Cucumber expressions (`{string}`, `{int}`), not regexes.
- **Assertions** use WebdriverIO's `expect` (`toBeDisplayed`, `toHaveText`, …), which retries until `waitforTimeout`.
- Match the existing style: 4-space indent, single quotes, short JSDoc only where something is non-obvious.

## Known app/environment limitations

- **Software keyboard can't be dismissed** on the local simulator (iOS 16.4, Xcode 14.3.1); not yet checked on the Sauce real devices, so keep avoiding it there too: Return, swipes, `hideKeyboard`, backgrounding and the hardware-keyboard setting all fail, and fixed-bottom buttons (Login, To Payment) stay covered. Avoid typing where a fixed-bottom button must be tapped afterwards. Login uses the app's "Usernames" list (`bob@example.com` / `10203040`) instead of typing.
- Shipping address and payment forms require typed input, so checkout beyond login isn't automated yet.
- **Catalog scrolling:** products load lazily (only ~6 exist in the page source until you scroll). WebdriverIO's `scrollIntoView` and `mobile: scroll` without an element don't move the grid; use `mobile: scroll` with the CollectionView's `elementId` (see `CatalogScreen.openProduct`). The Catalog tab returns to the top of the catalog.
- The macOS 13 / Xcode 14.3.1 machine needs `appium-xcuitest-driver@11.17.7` for local runs; don't upgrade it. (Sauce Labs runs its own Appium, `appiumVersion: 'latest'`.)
- **Sauce real devices** are assigned per session (`iPhone.*` by default, e.g. an iPhone 13 Pro on iOS 18), so model and iOS version can differ between scenarios. Session start takes about 15 seconds.

## Appium MCP (AI-driven exploration)

`.mcp.json` registers `appium-mcp`, used to explore the app while writing tests. It runs in **remote mode** against `http://127.0.0.1:4724`, the local proxy to Sauce Labs, which adds the credentials and picks the real device and app:

1. If `curl -s http://127.0.0.1:4724/status` reports `"ready":true` (the CI workflow starts the proxy), use it and don't start or stop it. Otherwise start `npm run explore` in the background and wait for that status.
2. Create a session with `appium_session_management`: `action=create`, `platform=ios`, `remoteServerUrl=http://127.0.0.1:4724`, capabilities
   `{"appium:automationName":"XCUITest","appium:deviceName":"iPhone","appium:bundleId":"com.saucelabs.mydemo.app.ios"}`.
   The proxy replaces the device and app with the project's Sauce Labs ones. Don't call `select_device` or `prepare_ios_simulator`.
3. Explore with `appium_get_page_source`, `generate_locators`, `appium_find_element`, `appium_gesture`, `appium_alert`. To start fresh, delete the session and create a new one: `appium_app_lifecycle` `clear` doesn't work on real devices. A session ends after 10 minutes without commands.
4. Write the code yourself following the conventions above. **Don't use `appium_generate_tests`**; it emits Java/TestNG.
5. Delete the MCP session when done, and, if you started it, stop the proxy (`npm run explore:stop`). Never leave a background command running: a non-interactive `claude -p` run waits for it and never exits.

Use `/implement-feature <feature file>` to run the whole loop.
