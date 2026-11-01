import { Given, When, Then } from '@wdio/cucumber-framework';
import { expect } from '@wdio/globals';
import TabBar from '../pageobjects/tabbar.ts';
import CatalogScreen from '../pageobjects/catalog.screen.ts';
import ProductDetailsScreen from '../pageobjects/product-details.screen.ts';
import CartScreen from '../pageobjects/cart.screen.ts';

async function openProduct(name: string) {
    // Products can be opened from any screen; the Catalog tab returns to the top of the catalog
    if (!(await CatalogScreen.isShown())) {
        await TabBar.openTab('Catalog');
        await CatalogScreen.waitForIsShown();
    }
    await CatalogScreen.openProduct(name);
    await ProductDetailsScreen.waitForIsShown();
    await expect(ProductDetailsScreen.title(name)).toBeDisplayed();
}

Given('the cart contains {string}', async (name: string) => {
    await openProduct(name);
    await ProductDetailsScreen.addToCart();
    await TabBar.openTab('Cart');
    await CartScreen.waitForIsShown();
    await expect(CartScreen.item(name)).toBeDisplayed();
});

When('I open the product {string}', openProduct);

When('I add the product to the cart', async () => {
    await ProductDetailsScreen.addToCart();
});

When('I remove {string} from the cart', async (name: string) => {
    await CartScreen.removeItem(name);
});

Then('the cart should contain {int} item(s)', async (count: number) => {
    await CartScreen.waitForIsShown();
    await expect(CartScreen.itemCount).toHaveText(`${count} Items`);
});

Then('the cart should list {string}', async (name: string) => {
    await expect(CartScreen.item(name)).toBeDisplayed();
});

Then('the cart should not list {string}', async (name: string) => {
    await expect(CartScreen.item(name)).not.toBeDisplayed();
});

Then('the cart should be empty', async () => {
    await expect(CartScreen.emptyCartMessage).toBeDisplayed();
    await expect(CartScreen.goShoppingButton).toBeDisplayed();
});

When('click on Remove items', async () => {
    await CartScreen.removeFirstItem();
});

Then('cart is empty', async () => {
    await expect(CartScreen.emptyCartMessage).toBeDisplayed();
    await expect(CartScreen.goShoppingButton).toBeDisplayed();
});
