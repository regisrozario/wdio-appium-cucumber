import { When, Then } from '@wdio/cucumber-framework';
import { expect } from '@wdio/globals';
import CatalogScreen from '../pageobjects/catalog.screen.ts';

When('User click on sort option', async () => {
    await CatalogScreen.openSortMenu();
});

Then('different sorting options displayed like name and price', async () => {
    await expect(CatalogScreen.sortOption('Name - Ascending')).toBeDisplayed();
    await expect(CatalogScreen.sortOption('Name - Descending')).toBeDisplayed();
    await expect(CatalogScreen.sortOption('Price - Ascending')).toBeDisplayed();
    await expect(CatalogScreen.sortOption('Price - Descending')).toBeDisplayed();
});

When('user click on sort by price Descending', async () => {
    await CatalogScreen.sortOption('Price - Descending').click();
    await CatalogScreen.waitForIsShown();
});

Then('make sure items are sorted properly', async () => {
    // Verify Price - Descending is the active sort by re-opening the sort menu
    // and checking the button's selected state (value="1")
    await CatalogScreen.openSortMenu();
    await expect(CatalogScreen.sortOption('Price - Descending')).toHaveAttribute('value', '1');
});
