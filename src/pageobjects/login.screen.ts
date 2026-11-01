import { $ } from '@wdio/globals';
import BaseScreen from './base.screen.ts';

/**
 * Login shown when proceeding to checkout while logged out.
 *
 * Note: typing into these fields opens the software keyboard, which covers the
 * Login button and can't be dismissed in this app. Logging in therefore uses the
 * app's "Usernames" list, which fills in both username and password.
 */
class LoginScreen extends BaseScreen {
    constructor() {
        super('-ios predicate string:type == "XCUIElementTypeStaticText" AND name == "Select a username from the list below"');
    }

    get usernameField() { return $('-ios class chain:**/XCUIElementTypeTextField'); }
    get passwordField() { return $('-ios class chain:**/XCUIElementTypeSecureTextField'); }
    private get loginButton() { return $('-ios predicate string:type == "XCUIElementTypeButton" AND name == "Login"'); }

    /** Taps a user in the "Usernames" list, which autofills their credentials */
    async selectUser(username: string): Promise<void> {
        await $(`-ios predicate string:type == "XCUIElementTypeButton" AND name == "${username}"`).click();
    }

    async tapLogin(): Promise<void> {
        await this.loginButton.click();
    }
}

export default new LoginScreen();
