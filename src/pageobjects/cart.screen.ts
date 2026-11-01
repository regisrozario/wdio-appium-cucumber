import BaseScreen from './base.screen.ts';

class CartScreen extends BaseScreen {
    constructor() {
        super('~Cart-screen');
    }

    /** The visible "<n> Items" summary (a hidden "No Items" label also exists in the empty-cart view) */
    get itemCount() {
        return this.screen.$('-ios predicate string:label ENDSWITH " Items" AND visible == 1');
    }

    /** Shown only when the cart is empty */
    get emptyCartMessage() {
        return this.screen.$('-ios predicate string:label BEGINSWITH "Oh no! Your cart is empty"');
    }

    get goShoppingButton() {
        return this.screen.$('~GoShopping');
    }

    async proceedToCheckout(): Promise<void> {
        await this.screen.$('~ProceedToCheckout').click();
    }

    item(name: string) {
        return this.screen.$(`-ios predicate string:label == "${name}"`);
    }

    /** Each cart item is a table cell holding the product name and its own "Remove Item" button */
    async removeItem(name: string): Promise<void> {
        await this.screen
            .$(`-ios class chain:**/XCUIElementTypeCell[$name == "${name}"$]/**/XCUIElementTypeButton[\`name == "Remove Item"\`]`)
            .click();
    }
}

export default new CartScreen();
