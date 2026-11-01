import BaseScreen from './base.screen.ts';

class ProductDetailsScreen extends BaseScreen {
    constructor() {
        super('~ProductDetails-screen');
    }

    private get addToCartButton() { return this.screen.$('~AddToCart'); }

    title(name: string) {
        return this.screen.$(`-ios predicate string:label == "${name}"`);
    }

    async addToCart(): Promise<void> {
        await this.addToCartButton.click();
    }
}

export default new ProductDetailsScreen();
