# wdio-appium-cucumber

Mobile UI tests for **Sauce Labs My Demo App (iOS)** with WebdriverIO 9, Appium 3 (XCUITest driver) and Cucumber BDD, in TypeScript (ESM, `.ts` import extensions).

## Commands

| Command | Purpose |
|---|---|
| `npm test` | Run all features (starts its own Appium on port 4723) |
| `npx wdio run ./config/wdio.ios.conf.ts --spec ./features/x.feature` | Run one feature |
| `npm run test:dry-run` | Cucumber dry run; undefined steps print `Step "..." is not defined` |
| `npm run typecheck` | TypeScript check |
| `npm run appium:explore` | Appium on port **4724** for Appium MCP exploration |
| `npm run appium:explore:stop` | Stop the port-4724 exploration server |

## Layout

- `features/*.feature` — Gherkin, written by humans. Don't rewrite scenarios to fit the code; ask instead. One behaviour per scenario (Given → When → Then), steps in the user's words ("I remove … from the cart", not "click Remove"), reusing existing step wording. The AI workflow enforces this before implementing (`.github/scripts/scenario-lint.mjs`).
- `src/step-definitions/*.steps.ts` — one file per area (`app`, `cart`, `checkout`, …).
- `src/pageobjects/*.ts` — one page object per screen, exported as a singleton (`export default new XScreen()`).
- `config/wdio.shared.conf.ts` — framework, reporters, Appium service. `config/wdio.ios.conf.ts` — capabilities and the `beforeScenario` reset (terminate → `mobile: clearApp` → activate), so every scenario starts on the catalog with an empty cart.

## Conventions

- **Screens** extend `BaseScreen` with the screen's root selector, usually its `<Name>-screen` accessibility id (`~Catalog-screen`, `~Cart-screen`, `~ProductDetails-screen`, `~ShippingAddress-screen`). Look elements up inside `this.screen.$(...)` so matches stay scoped to the screen.
- **Selector preference:** accessibility id (`~id`) → `-ios predicate string` → `-ios class chain`. Never XPath, never coordinates.
- **Hidden duplicates exist** (e.g. the cart's hidden "No Items" label). When a label can appear twice, add `AND visible == 1` to the predicate.
- **Text field values:** read with `toHaveAttribute('value', …)`; `toHaveValue` isn't supported by the iOS driver.
- **Steps** stay thin: they call page-object methods and make `expect` assertions. Reuse existing steps before adding new ones (check every file in `src/step-definitions/`). Use Cucumber expressions (`{string}`, `{int}`), not regexes.
- **Assertions** use WebdriverIO's `expect` (`toBeDisplayed`, `toHaveText`, …), which retries until `waitforTimeout`.
- Match the existing style: 4-space indent, single quotes, short JSDoc only where something is non-obvious.

## Known app/environment limitations

- **Software keyboard can't be dismissed** on this simulator (iOS 16.4, Xcode 14.3.1): Return, swipes, `hideKeyboard`, backgrounding and the hardware-keyboard setting all fail, and fixed-bottom buttons (Login, To Payment) stay covered. Avoid typing where a fixed-bottom button must be tapped afterwards. Login uses the app's "Usernames" list (`bob@example.com` / `10203040`) instead of typing.
- Shipping address and payment forms require typed input, so checkout beyond login isn't automated yet.
- **Catalog scrolling:** products load lazily (only ~6 exist in the page source until you scroll). WebdriverIO's `scrollIntoView` and `mobile: scroll` without an element don't move the grid; use `mobile: scroll` with the CollectionView's `elementId` (see `CatalogScreen.openProduct`). The Catalog tab returns to the top of the catalog.
- The macOS 13 / Xcode 14.3.1 machine needs `appium-xcuitest-driver@11.17.7`; don't upgrade it.

## Appium MCP (AI-driven exploration)

`.mcp.json` registers `appium-mcp`, used to explore the app while writing tests. It must use **remote mode** against this project's Appium, because its embedded driver doesn't build on this Mac:

1. Start the exploration server in the background: `npm run appium:explore` (port 4724). In the CI workflow it's already running; use it and don't start or stop it.
2. Create a session with `appium_session_management`: `action=create`, `platform=ios`, `remoteServerUrl=http://127.0.0.1:4724`, capabilities
   `{"appium:automationName":"XCUITest","appium:deviceName":"iPhone 14","appium:bundleId":"com.saucelabs.mydemo.app.ios"}`.
   Don't call `select_device` or `prepare_ios_simulator`.
3. Explore with `appium_get_page_source`, `generate_locators`, `appium_find_element`, `appium_gesture`, `appium_alert`, `appium_app_lifecycle` (use `clear` + `activate` to start fresh).
4. Write the code yourself following the conventions above. **Don't use `appium_generate_tests`**; it emits Java/TestNG.
5. Delete the MCP session and, if you started it, stop the exploration server (`npm run appium:explore:stop`) before running `npm test`. Never leave a background command running: a non-interactive `claude -p` run waits for it and never exits.

Use `/implement-feature <feature file>` to run the whole loop.
