# wdio-appium-cucumber

Mobile UI tests for the **Sauce Labs My Demo App (iOS)**, written as Cucumber BDD scenarios and run with WebdriverIO and Appium on an iOS simulator. New scenarios can also be implemented by AI: a tester types a scenario into a GitHub form and gets back a pull request with tested automation code.

| | |
|---|---|
| Test runner | WebdriverIO 9 (`@wdio/cucumber-framework`) |
| Automation | Appium 3 with the XCUITest driver (pinned to 11.17.7) |
| Language | TypeScript (ESM, `.ts` import extensions) |
| BDD | Cucumber / Gherkin |
| Reports | Spec reporter (console) and Allure |
| CI | GitHub Actions on a self-hosted Mac |
| AI authoring | Claude Code with Appium MCP |

## Contents

- [How it works](#how-it-works)
- [Project layout](#project-layout)
- [Getting started](#getting-started)
- [Running the tests](#running-the-tests)
- [Writing tests](#writing-tests)
- [CI: Mobile tests (iOS)](#ci-mobile-tests-ios)
- [AI: Implement scenario (AI)](#ai-implement-scenario-ai)
- [One-time setup for CI](#one-time-setup-for-ci)
- [Known limitations and cost](#known-limitations-and-cost)
- [Troubleshooting](#troubleshooting)

---

## How it works

The framework has four layers, each built on the one below:

```
 ┌──────────────── 4. AI authoring (optional) ────────────────────┐
 │  /implement-feature skill  ·  "Implement scenario (AI)" workflow │
 ├──────────────── 3. CI on GitHub ───────────────────────────────┤
 │  "Mobile tests (iOS)" workflow → self-hosted Mac runner         │
 ├──────────────── 2. Test code (BDD) ────────────────────────────┤
 │  feature files → step definitions → page objects                │
 ├──────────────── 1. Automation engine ──────────────────────────┤
 │  WebdriverIO → Appium → XCUITest driver → iOS simulator → app   │
 └─────────────────────────────────────────────────────────────────┘
```

### 1. Automation engine

| Piece | Job |
|---|---|
| **WebdriverIO** | Runs the tests. Code such as `$('~AddToCart').click()` becomes a WebDriver HTTP request. |
| **Appium** (port 4723) | Receives those requests and passes them to the right driver. Started and stopped automatically by the wdio Appium service. |
| **XCUITest driver** | Appium's iOS driver. It installs **WebDriverAgent** on the simulator, which uses Apple's XCTest to tap, type and read the screen. |
| **iOS simulator** | An iPhone 14 (iOS 16.4) running My Demo App (`com.saucelabs.mydemo.app.ios`). |

Before **every scenario** the app is reset (terminate → `mobile: clearApp` → activate), so each scenario starts on the catalog with an empty cart and scenarios can't affect each other.

### 2. Test code

```gherkin
Scenario: Remove a backpack from the cart
  Given the cart contains "Sauce Labs Backpack - Black"
  When I remove "Sauce Labs Backpack - Black" from the cart
  Then the cart should be empty
```

- **Feature files** describe the behaviour in plain English.
- **Step definitions** link each sentence to code. `{string}` and `{int}` capture values:
  ```ts
  When('I remove {string} from the cart', async (name: string) => {
      await CartScreen.removeItem(name);
  });
  ```
- **Page objects** hold the selectors: one class per screen. If the UI changes, one page object changes and every step using it keeps working.

### 3 and 4. Where everything runs

GitHub only queues jobs, stores secrets and hosts branches and pull requests. **Everything that touches the app runs on the self-hosted Mac.** Only Claude's model calls leave the Mac.

```mermaid
flowchart LR
    subgraph GH["GitHub (cloud)"]
        repo["Repository<br/>code · workflows"]
        actions["Actions<br/>job queue · secrets"]
        pr["Pull request<br/>+ test plan"]
    end

    subgraph MAC["Self-hosted Mac (macOS 13, Xcode 14.3.1)"]
        runner["Actions runner<br/>self-hosted-mac-mobile"]
        subgraph JOB["Workflow job"]
            scripts["Workflow scripts<br/>add-scenario · test-evidence"]
            claude["Claude Code CLI<br/>(headless)"]
            mcp["Appium MCP"]
            wdio["WebdriverIO + Cucumber"]
        end
        a4724["Appium :4724<br/>(exploration)"]
        a4723["Appium :4723<br/>(test runs)"]
        sim["iOS simulator<br/>WebDriverAgent + My Demo App"]
    end

    anthropic["Anthropic API<br/>(Claude model)"]

    actions -- "job" --> runner --> JOB
    repo -- "checkout" --> JOB
    claude <--> anthropic
    claude --> mcp --> a4724 --> sim
    wdio --> a4723 --> sim
    JOB -- "push branch, open PR" --> pr
```

---

## Project layout

```
features/                     Gherkin feature files (written by humans)
  cart.feature
  checkout.feature
src/
  step-definitions/           One file per area: app, cart, checkout, …
  pageobjects/                One page object per screen, exported as a singleton
    base.screen.ts            Shared screen logic (waitForIsShown, isShown)
config/
  wdio.shared.conf.ts         Framework, reporters, Appium service, screenshot on failure
  wdio.ios.conf.ts            iOS capabilities and the per-scenario app reset
apps/                         My_Demo_App.app (not in git)
.github/
  workflows/
    mobile-tests.yml          Regression run on every push to main
    implement-scenario.yml    AI implementation of a new scenario
  scripts/
    add-scenario.mjs          Turns the one-line form input into Gherkin and adds it to a feature file
    scenario-lint.mjs         BDD review of a new scenario
    test-evidence.mjs         Builds the pull request's test plan from Allure results
    sync-feature-choices.mjs  Keeps the workflow's feature-file dropdown up to date
.claude/skills/implement-feature/
                              The /implement-feature skill used by Claude Code
.mcp.json                     Registers Appium MCP for Claude Code
CLAUDE.md                     Conventions and limitations Claude Code follows
```

The `.mjs` files are plain JavaScript modules that Node runs directly with no build step. They are CI tooling, not tests. They use the same Cucumber libraries as the test run (`@cucumber/gherkin`, `@cucumber/cucumber-expressions`).

---

## Getting started

### Prerequisites

- macOS with **Xcode 14.3.1** and the **iPhone 14** simulator (iOS 16.4)
- **Node.js 22**
- **My Demo App** for the simulator (an x86_64-capable build), copied to `apps/My_Demo_App.app`, or set `IOS_APP=/path/to/My_Demo_App.app`. The app is not checked in.

### Install

```bash
git clone https://github.com/regisrozario/wdio-appium-cucumber.git
cd wdio-appium-cucumber
npm install
npm run appium:doctor     # optional: checks the XCUITest driver's requirements
```

Appium and the XCUITest driver are project dependencies, so nothing has to be installed globally. **You don't need to start Appium yourself.**

---

## Running the tests

```bash
npm test                                                                  # all scenarios
npm run test:smoke                                                        # @smoke only
TAGS='@checkout' npm test                                                 # by tag expression
npx wdio run ./config/wdio.ios.conf.ts --spec ./features/cart.feature     # one feature file
npx wdio run ./config/wdio.ios.conf.ts --spec ./features/cart.feature:44  # one scenario (line of "Scenario:")
```

The simulator boots and the app opens by itself. The first run takes a few minutes longer while WebDriverAgent is built.

| Variable | Default | Purpose |
|---|---|---|
| `IOS_DEVICE` | `iPhone 14` | Simulator name |
| `IOS_VERSION` | (any) | iOS version, e.g. `16.4` |
| `IOS_APP` | `apps/My_Demo_App.app` | Path to the app; if missing, the app already installed on the simulator is used |
| `TAGS` | (all) | Cucumber tag expression |

### Checks without the simulator

```bash
npm run typecheck      # TypeScript errors
npm run test:dry-run   # undefined steps print: Step "..." is not defined
```

### Reports and logs

```bash
npm run report         # builds and opens the Allure report
```

Screenshots of failed steps are attached to the Allure report. Appium and WebdriverIO logs are in `logs/`.

### Editor support

`.vscode/settings.json` points the official Cucumber VS Code extension at `src/step-definitions/`, so steps resolve with Cmd-click and aren't shown as "Undefined step". Reload the window after cloning.

---

## Writing tests

### Selectors

Use, in this order:

1. accessibility id: `~Cart-screen`
2. `-ios predicate string`: `label BEGINSWITH "Oh no!"`
3. `-ios class chain`: `**/XCUIElementTypeCell[$name == "…"$]`

**Never XPath, never coordinates.**

- Some labels have **hidden duplicates**, such as the cart's hidden "No Items" label. When a label can appear twice, add `AND visible == 1` to the predicate.
- Read text field values with `toHaveAttribute('value', …)`. The iOS driver doesn't support `toHaveValue`.

### Page objects

- Extend `BaseScreen` with the screen's root selector, usually `~<Name>-screen`.
- Look elements up inside `this.screen.$(...)`, so matches stay within the screen.
- Export a singleton: `export default new CartScreen();`

### Step definitions

- Keep steps thin: they call page-object methods and assert with WebdriverIO's `expect` (`toBeDisplayed`, `toHaveText`, …). `expect` retries until the wait timeout, so **don't add sleeps**.
- **Reuse existing steps.** Check every file in `src/step-definitions/` before adding one.
- Use Cucumber expressions (`{string}`, `{int}`), not regexes.

### Scenarios (BDD rules)

- **One behaviour per scenario:** Given (setup) → When (action) → Then (outcome). Don't put a `When` after a `Then`.
- Write in the user's words: `I remove "X" from the cart`, not `click Remove`.
- Use the first person ("I …") consistently.
- Reuse the wording of existing steps instead of near-synonyms.
- Never put selectors, coordinates or fixed waits in a scenario.

The AI workflow enforces these rules on new scenarios (see [Scenario review](#scenario-review)).

### Code style

4-space indent, single quotes, short JSDoc only where something is non-obvious.

---

## CI: Mobile tests (iOS)

`.github/workflows/mobile-tests.yml` is the regression run. It has no AI involved.

- **Triggers:** every push to `main` (including merged AI pull requests), or **Run workflow** with an optional tag expression (e.g. `@smoke`) and simulator name.
- **Runs on:** the self-hosted Mac (`[self-hosted, macOS]`), with a 60-minute limit.
- **Steps:** check out → Node.js 22 → `npm ci` → type check → `npm test` → generate the Allure report → upload the report and logs as artifacts.

The first run takes about 6 minutes, mostly building WebDriverAgent. The suite itself takes a few minutes.

---

## AI: Implement scenario (AI)

A tester types one Gherkin scenario into a GitHub form. About 10 to 30 minutes later there is a pull request with step definitions and page objects, written by Claude Code after exploring the app through **Appium MCP**. **No pull request is opened unless the new scenario passes twice in a row** on the simulator.

### Starting a run

On GitHub, open **Actions → Implement scenario (AI) → Run workflow**:

| Input | Type | Example |
|---|---|---|
| `scenario` | Text, one line | `@smoke Scenario: Add the bike light \| When I open the product "Sauce Labs Bike Light" \| And I add the product to the cart \| And I open the "Cart" tab \| Then the cart should contain 1 item` |
| `feature_file` | Dropdown | `features/cart.feature`, `features/checkout.feature`, or `New feature file…` |
| `new_feature_file` | Text, optional | `features/catalog-sort.feature` (only with "New feature file…") |
| `runner` | Text | `macOS` (default): the self-hosted runner label |

Scenario format:

- Parts are separated by ` | ` (space, pipe, space), because GitHub's form only accepts one line.
- Start with `Scenario: <name>`, optionally preceded by tags such as `@smoke`.
- Then add steps starting with Given, When, Then, And or But, with at least one When and one Then.
- The name must be new in that feature file.
- Data tables and Scenario Outlines aren't supported in this form.

The dropdown is a fixed list in the workflow file. After adding or removing a feature file, run `npm run sync:feature-choices` and commit.

### End-to-end flow

```mermaid
flowchart TD
    start(["Tester: Run workflow on GitHub"]) --> resolve

    subgraph MAC["Self-hosted Mac"]
        resolve["1. Resolve feature file"] --> setup["2–5. Checkout · Node.js · npm ci · install Claude Code"]
        setup --> add["6. Add scenario<br/>BDD review + Gherkin check"]
        add --> explore["7. Start exploration Appium :4724"]
        explore --> claude["8. Claude Code implements<br/>(Appium MCP, max 45 min)"]
        claude --> result["9. Check Claude's result<br/>RESULT: SUCCESS?"]
        result --> changed["10. Check what was changed<br/>scenario unchanged · allowed files only"]
        changed --> verify["11. Type check + new scenario, run twice<br/>(Appium :4723)"]
        verify --> plan["12. Build test plan<br/>2 of 2 runs passed?"]
        plan --> push["13. Push branch ai/&lt;feature&gt;-&lt;run&gt;"]
        always["15–16. Stop Appium :4724 · upload claude-output (always)"]
    end

    push --> openpr["14. Open pull request on GitHub"]
    openpr --> review(["Human review and merge"])
    review --> regression(["Mobile tests (iOS) runs the full suite on main"])

    add -. fails .-> stop(["Run fails: nothing pushed"])
    result -. fails .-> stop
    changed -. fails .-> stop
    verify -. fails .-> stop
    plan -. fails .-> stop
```

### Step by step

The job has 16 steps and a 90-minute limit. Steps 1 to 14 stop at the first failure; steps 15 and 16 always run.

1. **Resolve feature file.** Takes the dropdown choice, or the `new_feature_file` path when "New feature file…" is chosen.
2. **Check out code** from the branch the workflow was started from.
3. **Set up Node.js 22.**
4. **Install dependencies** (`npm ci`): Appium, the XCUITest driver, WebdriverIO and Cucumber, into the job's own folder.
5. **Install Claude Code**, pinned to version 2.1.81.
6. **Add scenario to feature file** (`add-scenario.mjs`):
   - splits the input on ` | `
   - runs the **BDD review**
   - checks that the result parses as Gherkin
   - appends it to the feature file, or creates the file

   A copy of the feature file is kept for step 10.
7. **Start exploration Appium** on port 4724 and wait until it's ready. The workflow owns this server, so Claude never starts or stops it.
8. **Implement with Claude Code.** Runs `claude -p` headless, with a 45-minute limit, using the `/implement-feature` skill and the rules in `CLAUDE.md`. Claude:
   1. runs a dry run to list the undefined steps
   2. explores the app through Appium MCP: reads screens, generates locators, taps and scrolls, and confirms each selector
   3. writes page objects and step definitions under `src/`
   4. runs the type check, then runs the new scenario and fixes it until it passes
   5. writes its report to `.ai-result.md`, ending in `RESULT: SUCCESS` or `RESULT: BLOCKED - <reason>`
9. **Check Claude's result.** Any result other than `RESULT: SUCCESS` fails the run. Turns, cost and any refused tools are added to the run summary.
10. **Check what was changed.** Stops the exploration server. Then confirms the scenario text is unchanged and that only `src/`, that feature file and `CLAUDE.md` changed.
11. **Verify.** Runs `npm run typecheck`, clears old results, and runs **only the new scenario, twice** (`--spec <feature>:<line>`). The wdio Appium service uses port 4723.
12. **Build test plan** (`test-evidence.mjs`). Reads the Allure results and requires **2 of 2 runs passed, with every step passed**.
13. **Push branch** `ai/<feature>-<run number>`, committed as github-actions[bot].
14. **Open pull request.**
15. **Stop exploration Appium** (always).
16. **Upload the `claude-output` artifact** (always): Claude's output, the test plan, the scenario review, logs and Allure results.

### Scenario review

`scenario-lint.mjs` reviews the new scenario in step 6, before any AI time is spent.

| Errors: the run stops | Warnings: reported, the run continues |
|---|---|
| Steps out of Given → When → Then order (e.g. a `When` after a `Then`) | A step worded almost like an existing step; the existing wording is suggested |
| `And`/`But` as the first step | UI wording: click, tap, press, swipe, scroll, button |
| Empty or generic scenario name ("X", "Test 1") | Mixing "I …" and "the user …" |
| Selectors, accessibility ids, coordinates or fixed waits in a step | More than 8 steps |

The review also lists which steps already exist and which are new. It appears in the run summary and in the pull request.

### Safety gates

Every gate below can stop the run. When one fails, nothing is pushed or published, and the run summary and the `claude-output` artifact explain why.

| Step | Gate | Fails when |
|---|---|---|
| 1 | Feature file choice | "New feature file…" has no path, or the path already exists |
| 6 | Scenario input and BDD review | Bad path, no `Scenario:` line, no When or Then, duplicate name, invalid Gherkin, or a review error |
| 8 | Time limit | Claude Code runs for more than 45 minutes |
| 9 | Claude's verdict | Claude reports `BLOCKED`, errors, or doesn't end with `RESULT: SUCCESS` |
| 10 | Scenario unchanged | The feature file differs from the copy kept in step 6 |
| 10 | Allowed files | Anything outside `src/`, that feature file and `CLAUDE.md` changed |
| 11 | Type check and runs | A type error, or the new scenario fails in either run |
| 12 | Evidence | Fewer than 2 runs passed, or a step was failed, pending or skipped |

Steps 1 and 6 run before Claude starts, so bad input costs nothing. The verification in steps 11 and 12 is done by the workflow itself, not taken from Claude's report.

### Guardrails for unattended Claude

- **Tool allowlist.** Claude can only read and edit files, use Appium MCP, and run the dry run, the type check, `npx wdio run`, the port-4724 status check, and `git status` / `git diff`. It can't push, install packages or run anything else.
- **`CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1`.** A headless `claude -p` waits for background commands before exiting. A forgotten background Appium server once kept a run idle for 20+ minutes. With this setting every command runs in the foreground, so nothing can be left behind.
- **`BASH_DEFAULT_TIMEOUT_MS=900000` and `BASH_MAX_TIMEOUT_MS=1800000`** give foreground test runs up to 15 minutes (30 on request), instead of the default 2.
- **The report goes to a file** (`.ai-result.md`), so late messages can't replace the `RESULT:` line.

### The pull request

The pull request is titled "Implement scenario: \<name\>" and its description contains:

1. One line naming the scenario and feature file, with a link to the workflow run.
2. When a new feature file was created, a reminder to run `npm run sync:feature-choices` after merging.
3. The full feature file, folded.
4. **Test plan:**
   - checks: scenario unchanged, allowed files only, type check passed, new scenario passed 2 of 2 runs
   - a table with one row per step and one column per run, plus each run's duration
5. **Scenario review:** errors, warnings, reused steps and new steps.
6. Claude Code's own summary of the steps, page objects and selectors it added.

Only the new scenario runs in this workflow. The **full suite** runs in Mobile tests (iOS) after the merge to `main`. Reviewers check the selectors and steps before merging; nothing reaches `main` without that review.

### The two Appium servers

| Port | Started by | Used for | When |
|---|---|---|---|
| 4724 | `npm run appium:explore` (the workflow, or you locally) | Appium MCP exploration | AI workflow steps 7–10, or local exploration |
| 4723 | The wdio Appium service inside each test run | Running the tests | Every test run |

Both workflows use the concurrency group `ios-simulator`, so only one job uses the simulator at a time and a second run waits in the queue.

### Implementing locally with Claude Code

In a Claude Code session in this project, run:

```
/implement-feature features/cart.feature
```

Claude follows the same loop: dry run, explore, write code, run until it passes. You watch it work, and nothing is committed unless you ask. Locally, the skill starts the exploration server (`npm run appium:explore`) itself and stops it when done (`npm run appium:explore:stop`).

Appium MCP is registered in `.mcp.json` (`appium-mcp@1.99.2`). It runs in **remote mode** against the project's own Appium on port 4724, because its embedded driver doesn't build on this Mac. `CLAUDE.md` has the exact session settings.

---

## One-time setup for CI

The AI workflow needs three settings before its first run. The regression workflow needs only the runner.

- [ ] Add the repository secret **`ANTHROPIC_API_KEY`** (Settings → Secrets and variables → Actions). Without it, the run stops at step 8.
- [ ] Under Settings → Actions → General → Workflow permissions:
  - choose **Read and write permissions**
  - tick **Allow GitHub Actions to create and approve pull requests**

  Without this, step 14 fails with a 403.
- [ ] Run the self-hosted runner **`self-hosted-mac-mobile`** (labels `self-hosted`, `macOS`) as a service, so it survives logouts and reboots:
  ```bash
  cd ~/actions-runner-mobile && ./svc.sh install && ./svc.sh start
  ```
  Otherwise, start it from a terminal with `./run.sh`.

The Mac needs Xcode with the iPhone 14 simulator and Node.js. It must stay logged in and awake; a sleeping Mac leaves jobs queued.

Keep the repository **private**. Anyone who can start a workflow can run code on that Mac.

---

## Known limitations and cost

| Limitation | Effect | Workaround today |
|---|---|---|
| The software keyboard can't be dismissed on the iOS 16.4 simulator (Return, swipes, `hideKeyboard`, backgrounding all fail) | The Login and To Payment buttons stay covered after typing | Login uses the app's built-in username list (`bob@example.com` / `10203040`); checkout stops after login |
| The catalog loads lazily (about 6 products exist until you scroll) | `scrollIntoView` and `mobile: scroll` without an element don't move the grid | `mobile: scroll` with the CollectionView's `elementId` (see `CatalogScreen.openProduct`) |
| One-line scenario input | No data tables or Scenario Outlines | Add those scenarios by hand |
| Fixed dropdown list | New feature files don't appear automatically | `npm run sync:feature-choices` after merging |
| macOS 13 with Xcode 14.3.1 | XCUITest driver pinned to 11.17.7, because newer versions don't build; appium-mcp's native module doesn't build | Don't upgrade the driver; Appium MCP runs in remote mode |
| Claude Code pinned to 2.1.81 in CI | Newer versions aren't picked up | Raise the pin in the workflow after testing |
| Only new scenarios are reviewed | Existing scenarios aren't checked against the BDD rules | Fix them by hand |

**Cost.** Each AI run calls the Anthropic API. A short headless check cost about $0.06. A full implementation is expected to cost a few dollars and take 10 to 30 minutes. The actual cost of each run is shown in its run summary.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Step "..." is not defined` | Add the step definition, or reword the scenario to match an existing step |
| "Undefined step" warnings in VS Code, but the dry run passes | Reload the window; the Cucumber extension reads `.vscode/settings.json` |
| Port 4723 or 4724 already in use | `lsof -ti tcp:4723 \| xargs kill`, or `npm run appium:explore:stop` for 4724 |
| App not installed / not found | Copy it to `apps/My_Demo_App.app` or set `IOS_APP` |
| First run is slow | WebDriverAgent is being built; later runs reuse it |
| Local and CI runs interfere | Don't run tests locally while a GitHub job is running on the same Mac; they share the simulator |
| AI run fails with a 403 when opening the PR | Enable the workflow permission in [One-time setup for CI](#one-time-setup-for-ci) |
| AI run fails at "Add scenario" | Read the scenario review in the run summary; fix the scenario and run again |
