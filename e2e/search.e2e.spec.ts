import { test, expect, Page } from '@playwright/test';
import * as path from 'path';

test.use({ channel: 'chrome' });

async function readState(page: Page) {
  return page.evaluate(() => new Promise<any>((resolve) => {
    (window as any).chrome.storage.local.get(null, resolve);
  }));
}

test.beforeEach(async ({ page }) => {
  await page.setContent('<div id="root"></div>');
  // Exercise the production popup without touching the installed extension.
  await page.evaluate(() => {
    const state: Record<string, any> = {
      tab_list: [
        { id: '0', name: 'Current', active: true },
        { id: '1', name: 'Alpha API', active: true },
        { id: '2', name: 'Beta', active: false },
        { id: '3', name: 'Alpha CDN', active: false },
      ],
      active_keys: ['0', '1'],
      config_editing_key: '0',
      config_for_shown: { 0: '{}', 1: '{}', 2: '{}', 3: '{}' },
      config: { 0: {}, 1: {}, 2: {}, 3: {} },
      sync_storage_data_has_been_migarated_to_local: { migarated: true },
    };
    const storage = {
      get: (keys: any, callback: Function) => {
        const result = keys === null ? state : { ...keys };
        if (keys !== null) {
          Object.keys(keys).forEach((key) => {
            if (key in state) result[key] = state[key];
          });
        }
        const snapshot = JSON.parse(JSON.stringify(result));
        setTimeout(() => callback(snapshot), 0);
      },
      set: (values: any, callback?: Function) => {
        Object.assign(state, JSON.parse(JSON.stringify(values)));
        if (callback) setTimeout(() => callback(), 0);
      },
    };
    (window as any).chrome = { storage: { local: storage, sync: storage } };
  });
  await page.addStyleTag({ path: path.resolve(__dirname, '../build/xswitch.css') });
  await page.addScriptTag({ path: path.resolve(__dirname, '../build/xswitch.js') });
  await expect(page.locator('.xswitch-tabs li')).toHaveCount(4);
});

test('filters names without changing storage or execution order', async ({ page }) => {
  const before = await readState(page);
  await page.locator('.new-item').fill(' ALPHA ');
  await expect(page.locator('.xswitch-tabs .label')).toHaveText(['\u00a0Alpha API', '\u00a0Alpha CDN']);
  await expect(page.locator('.xswitch-tabs input:checked')).toHaveCount(1);
  expect(await readState(page)).toEqual(before);

  await page.locator('.new-item').press('Escape');
  await expect(page.locator('.new-item')).toHaveValue('');
  await expect(page.locator('.xswitch-tabs .label')).toHaveText([
    '\u00a0Current', '\u00a0Alpha API', '\u00a0Beta', '\u00a0Alpha CDN',
  ]);
  await page.locator('.new-item').fill('   ');
  await expect(page.locator('.xswitch-tabs li')).toHaveCount(4);
});

test('empty results prompt Enter creation and restore the full list', async ({ page }) => {
  const input = page.locator('.new-item');
  await input.fill('New service');
  await expect(page.getByRole('status')).toHaveText('No matches. Press Enter to add a rule.');
  await input.press('Enter');
  await expect(input).toHaveValue('');
  await expect(page.locator('.xswitch-tabs li')).toHaveCount(5);
  await expect(page.locator('.xswitch-tabs .label').last()).toHaveText('\u00a0New service');
  const state = await readState(page);
  expect(state.tab_list[4].name).toBe('New service');
  expect(state.config_editing_key).toBe(state.tab_list[4].id);
});

test('add button still creates a rule from the shared input', async ({ page }) => {
  await page.locator('.new-item').fill('Button-created rule');
  await page.getByTitle('Add rule', { exact: true }).click();
  await expect(page.locator('.xswitch-tabs li')).toHaveCount(5);
  expect((await readState(page)).tab_list[4].name).toBe('Button-created rule');
});

test('IME Enter does not create a configuration', async ({ page }) => {
  const before = await readState(page);
  await page.locator('.new-item').fill('Pending composition');
  await page.locator('.new-item').dispatchEvent('keydown', {
    key: 'Enter', code: 'Enter', isComposing: true, bubbles: true,
  });
  await expect(page.getByRole('status')).toBeVisible();
  await expect(page.locator('.new-item')).toHaveValue('Pending composition');
  expect(await readState(page)).toEqual(before);
});

test('first filtered result keeps its menu and hover does not shift text', async ({ page }) => {
  await page.locator('.new-item').fill('Beta');
  const row = page.locator('.xswitch-tabs li');
  const label = row.locator('.label');
  await page.mouse.move(500, 500);
  const beforeRow = await row.boundingBox();
  const beforeLabel = await label.boundingBox();
  await row.hover();
  await expect(row.locator('.more-icon')).toBeVisible();
  expect(await row.boundingBox()).toEqual(beforeRow);
  expect(await label.boundingBox()).toEqual(beforeLabel);
});

test('pin menu follows Delete, persists display order and preserves active rules', async ({ page }) => {
  const before = await readState(page);
  const pin = async (id: string, label: string) => {
    const row = page.locator(`.xswitch-tabs li[id="${id}"]`);
    await row.hover();
    await row.locator('.more-icon').click();
    await expect(page.locator('.xs-dropdown-menu .xs-menu-item')).toHaveText(['Rename', 'Delete', label]);
    await page.locator('.xs-menu-item').filter({ hasText: new RegExp(`^${label}$`) }).click();
  };
  await pin('2', 'Pin to top');
  await expect(page.locator('.xswitch-tabs li').nth(1)).toHaveAttribute('id', '2');
  await expect(page.locator('.xswitch-tabs li[id="2"] .pin-icon')).toBeVisible();
  await pin('3', 'Pin to top');
  await expect(page.locator('.xswitch-tabs li').nth(1)).toHaveAttribute('id', '3');

  const stored = await readState(page);
  expect(stored.tab_list.map((item: any) => item.id)).toEqual(before.tab_list.map((item: any) => item.id));
  expect(stored.active_keys).toEqual(before.active_keys);
  expect(stored.config_editing_key).toBe(before.config_editing_key);
  expect(stored.config).toEqual(before.config);

  // Recreate the popup DOM while keeping the simulated extension storage.
  await page.setContent('<div id="root"></div>');
  await page.addStyleTag({ path: path.resolve(__dirname, '../build/xswitch.css') });
  await page.addScriptTag({ path: path.resolve(__dirname, '../build/xswitch.js') });
  await expect(page.locator('.xswitch-tabs .label')).toHaveText([
    '\u00a0Current', '\u00a0Alpha CDN', '\u00a0Beta', '\u00a0Alpha API',
  ]);
  await pin('2', 'Unpin');
  await expect(page.locator('.xswitch-tabs .label')).toHaveText([
    '\u00a0Current', '\u00a0Alpha CDN', '\u00a0Alpha API', '\u00a0Beta',
  ]);
  await page.locator('.new-item').fill('alpha');
  await expect(page.locator('.xswitch-tabs .label')).toHaveText(['\u00a0Alpha CDN', '\u00a0Alpha API']);
});
