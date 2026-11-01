import { When, Then } from '@wdio/cucumber-framework';
import { expect } from '@wdio/globals';
import CartScreen from '../pageobjects/cart.screen.ts';
import LoginScreen from '../pageobjects/login.screen.ts';
import ShippingAddressScreen from '../pageobjects/shipping-address.screen.ts';
import Alert from '../pageobjects/alert.ts';

When('I proceed to checkout', async () => {
    await CartScreen.proceedToCheckout();
    await LoginScreen.waitForIsShown();
});

When('I log in as {string}', async (username: string) => {
    await LoginScreen.selectUser(username);
    // Native iOS fields expose their text via the `value` attribute; the password shows as bullets
    await expect(LoginScreen.usernameField).toHaveAttribute('value', username);
    await expect(LoginScreen.passwordField).toHaveAttribute('value', expect.stringMatching(/^•+$/));
    await LoginScreen.tapLogin();
});

When('I tap Login without entering credentials', async () => {
    await LoginScreen.tapLogin();
});

Then('the shipping address screen should be shown', async () => {
    await expect(await ShippingAddressScreen.waitForIsShown()).toBe(true);
});

Then('I should see a {string} alert saying {string}', async (title: string, message: string) => {
    await Alert.waitForIsShown();
    await expect(Alert.title()).toHaveText(title);
    await expect(Alert.message()).toHaveText(message);
    await Alert.tapButton('OK');
    await Alert.waitForIsShown(false);
});
