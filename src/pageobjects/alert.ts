import { $ } from '@wdio/globals';

/** The app's native iOS alert dialog */
class Alert {
    private get container() { return $('-ios class chain:**/XCUIElementTypeAlert'); }

    async waitForIsShown(isShown = true): Promise<boolean | void> {
        return this.container.waitForDisplayed({ reverse: !isShown });
    }

    title() {
        return this.container.$('-ios class chain:**/XCUIElementTypeStaticText[1]');
    }

    message() {
        return this.container.$('-ios class chain:**/XCUIElementTypeStaticText[2]');
    }

    async tapButton(label: string): Promise<void> {
        await this.container.$(`-ios predicate string:type == "XCUIElementTypeButton" AND label == "${label}"`).click();
    }
}

export default new Alert();
