import { When, Then } from '@wdio/cucumber-framework';
import { expect } from '@wdio/globals';
import ProductDetailsScreen from '../pageobjects/product-details.screen.ts';
import Alert from '../pageobjects/alert.ts';

When('I increase the quantity to {int}', async (amount: number) => {
    await ProductDetailsScreen.increaseQuantityTo(amount);
    await expect(ProductDetailsScreen.quantity).toHaveAttribute('value', String(amount));
});

When('I give the product a rating of {int} stars', async (stars: number) => {
    await ProductDetailsScreen.rate(stars);
});

Then('make sure {string} message is displayed', async (message: string) => {
    await Alert.waitForIsShown();
    await expect(Alert.title()).toHaveText(message);
    await Alert.tapButton('OK');
    await Alert.waitForIsShown(false);
});
