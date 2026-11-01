import BaseScreen from './base.screen.ts';

class CatalogScreen extends BaseScreen {
    constructor() {
        super('~Catalog-screen');
    }

    private product(name: string) {
        return this.screen.$(`-ios predicate string:name == "Product Name" AND label == "${name}"`);
    }

    async openProduct(name: string): Promise<void> {
        await this.product(name).click();
    }
}

export default new CatalogScreen();
