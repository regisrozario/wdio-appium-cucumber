import { Given, When } from '@wdio/cucumber-framework';
import TabBar, { type Tab } from '../pageobjects/tabbar.ts';
import CatalogScreen from '../pageobjects/catalog.screen.ts';

Given('the app is launched on the catalog screen', async () => {
    await CatalogScreen.waitForIsShown();
});

When('I open the {string} tab', async (tab: Tab) => {
    await TabBar.openTab(tab);
});
