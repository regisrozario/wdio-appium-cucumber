import { $ } from '@wdio/globals';

export type Tab = 'Catalog' | 'Cart' | 'More';

class TabBar {
    async openTab(tab: Tab): Promise<void> {
        await $(`~${tab}-tab-item`).click();
    }
}

export default new TabBar();
