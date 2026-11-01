import { $ } from '@wdio/globals';

/**
 * Base class for all screens. A screen is identified by a unique selector
 * that must be visible once the screen has finished rendering.
 */
export default abstract class BaseScreen {
    constructor(private readonly selector: string) {}

    protected get screen() {
        return $(this.selector);
    }

    async waitForIsShown(isShown = true): Promise<boolean | void> {
        return this.screen.waitForDisplayed({ timeout: 30000, reverse: !isShown });
    }
}
