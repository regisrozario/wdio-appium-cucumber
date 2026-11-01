---
name: implement-feature
description: Implement the missing step definitions and page objects for a Cucumber feature file by exploring My Demo App on the iOS simulator through Appium MCP, then run the feature until it passes. Use when the user gives a .feature file (or asks to automate a scenario) in this project.
---

# Implement a feature file with Appium MCP

Input: a path to a feature file (e.g. `features/catalog-sort.feature`). If none is given, ask for one.
Read `CLAUDE.md` first; its conventions and known limitations apply throughout.

## 1. Understand the feature
- Read the feature file. Don't change its scenarios. If a step is ambiguous (which product? what counts as "sorted"?), ask the user before writing code.
- Read every file in `src/step-definitions/` and `src/pageobjects/` so you reuse existing steps and screens.

## 2. Find the missing steps
- Run `npm run test:dry-run -- --spec <feature>` and collect each `Step "..." is not defined` line.
- If nothing is undefined, skip to step 5.

## 3. Explore the app with Appium MCP
- If `curl -s http://127.0.0.1:4724/status` already reports `"ready":true` (the CI workflow starts it for you), use that server and don't start or stop it. Otherwise start `npm run appium:explore` in the background and wait until it reports ready.
- Create a remote iOS session exactly as described in `CLAUDE.md` (port 4724, iPhone 14, bundle id). Reset the app with `appium_app_lifecycle` (`clear`, then `activate`).
- Walk each scenario by hand in order, including the steps that already exist, so the app reaches the right state.
- On every new screen, call `generate_locators` and/or `appium_get_page_source` and note:
  - the screen's root id (usually `<Name>-screen`)
  - selectors for each element the steps use, by the preference in `CLAUDE.md`
  - hidden duplicates (same label, `visible="false"`), which need `AND visible == 1`
- Verify each selector with `appium_find_element` before using it, and confirm actions do what the step says (e.g. take a screenshot or re-read the page source after a tap).
- If something can't be automated (e.g. the keyboard limitation), stop and tell the user rather than working around it with coordinates or sleeps.

## 4. Write the code
- Add page objects for new screens (extend `BaseScreen`, scope lookups with `this.screen.$`) and methods on existing ones.
- Add step definitions to the right `*.steps.ts` file (or a new one for a new area). Keep steps thin; assertions use WebdriverIO `expect`.
- Run `npm run typecheck`.

## 5. Run and fix
- Delete the MCP session. If you started the exploration server, stop it now with `npm run appium:explore:stop`; a forgotten background server keeps a non-interactive run from ever exiting. (`npm test` starts its own Appium on 4723.)
- Run `npx wdio run ./config/wdio.ios.conf.ts --spec <feature>`. On failure, read the error, re-explore with MCP if a selector or flow is wrong, fix, and re-run. Don't loosen an assertion just to make it pass; if the app behaves differently from the feature, report it.
- Finish by running the full suite (`npm test`) to check nothing else broke, unless your instructions say to run only the new scenario (the CI workflow does: it verifies `--spec <feature>:<line>` twice and leaves the full suite to the regression run after merge).

## 6. Report
Summarise: the steps added or reused, the new or changed page objects and the selectors chosen, the test results, and anything you couldn't automate and why. Don't commit unless asked.
