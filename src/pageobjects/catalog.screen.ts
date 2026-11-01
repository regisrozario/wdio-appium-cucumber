import { $, driver } from '@wdio/globals';
import BaseScreen from './base.screen.ts';

class CatalogScreen extends BaseScreen {
    constructor() {
        super('~Catalog-screen');
    }

    private product(name: string) {
        return this.screen.$(`-ios predicate string:name == "Product Name" AND label == "${name}"`);
    }

    private get productGrid() {
        return this.screen.$('-ios class chain:**/XCUIElementTypeCollectionView');
    }

    /**
     * Products load lazily as the catalog scrolls, so scroll the product grid down until the
     * product is on screen. Uses the driver's native scroll on the grid itself; WebdriverIO's
     * swipe-based `scrollIntoView` doesn't move this grid.
     */
    async openProduct(name: string, maxScrolls = 10): Promise<void> {
        for (let i = 0; i < maxScrolls && !(await this.product(name).isDisplayed()); i++) {
            await driver.execute('mobile: scroll', { elementId: await this.productGrid.elementId, direction: 'down' });
        }
        await this.product(name).click();
    }

    /** Opens the sort/filter sheet */
    async openSortMenu(): Promise<void> {
        await this.screen.$('~Button').click();
    }

    /** Returns a sort option button by its label (e.g. 'Price - Descending').
     *  The sort sheet is rendered outside the Catalog-screen subtree, so we use a global query. */
    sortOption(label: string) {
        return $(`~${label}`);
    }
}

export default new CatalogScreen();
