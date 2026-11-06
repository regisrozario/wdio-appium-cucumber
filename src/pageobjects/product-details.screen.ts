import BaseScreen from './base.screen.ts';

class ProductDetailsScreen extends BaseScreen {
    constructor() {
        super('~ProductDetails-screen');
    }

    private get addToCartButton() { return this.screen.$('~AddToCart'); }
    private get increaseQuantityButton() { return this.screen.$('~AddPlus Icons'); }

    /** The quantity label; its `value` is the current amount */
    get quantity() { return this.screen.$('~Amount'); }

    /** Rating stars are named "StarSelected Icons" or "StarUnSelected Icons" by state, so pick them by position (1–5) */
    private star(position: number) {
        return this.screen.$(`-ios class chain:**/XCUIElementTypeButton[\`name BEGINSWITH "Star"\`][${position}]`);
    }

    title(name: string) {
        return this.screen.$(`-ios predicate string:label == "${name}"`);
    }

    async addToCart(): Promise<void> {
        await this.addToCartButton.click();
    }

    async increaseQuantityTo(amount: number): Promise<void> {
        const current = Number(await this.quantity.getAttribute('value'));
        if (amount < current) throw new Error(`Quantity is already ${current}; can't increase it to ${amount}`);
        for (let i = current; i < amount; i++) {
            await this.increaseQuantityButton.click();
        }
    }

    async rate(stars: number): Promise<void> {
        await this.star(stars).click();
    }
}

export default new ProductDetailsScreen();
