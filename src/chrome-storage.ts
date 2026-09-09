import {
  JSONC_CONFIG,
  JSON_CONFIG,
  DISABLED,
  CLEAR_CACHE_ENABLED,
  CORS_ENABLED_STORAGE_KEY,
  TAB_LIST,
  EDITING_CONFIG_KEY,
  ACTIVE_KEYS,
  USE_CHROME_STORAGE_SYNC_FN,
  SYNC_STORAGE_DATA_HAS_BEEN_MIGARATED_TO_LOCAL,
  DEFAULT_DATA,
} from './constants';
import { JSONC2JSON, JSON_Parse } from './utils';
import { Enabled } from './enums';

interface ConfigStorage {
  [JSONC_CONFIG]: object;
}
interface OptionsStorage {
  [CLEAR_CACHE_ENABLED]: string;
  [CORS_ENABLED_STORAGE_KEY]: string;
}

const LOCAL_STORAGE_PREFIX = 'xswitch_';

/**
 * 本地开发环境下使用 localStorage 模拟 chrome.storage.local 的 get/set API
 */
class LocalStorageAdapter {
  private _getStore(): Record<string, any> {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_PREFIX + 'store');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  private _setStore(store: Record<string, any>) {
    localStorage.setItem(LOCAL_STORAGE_PREFIX + 'store', JSON.stringify(store));
  }

  get(keyOrObj: any, callback: Function) {
    const store = this._getStore();
    const result: Record<string, any> = {};

    if (typeof keyOrObj === 'string') {
      // get('key', cb) → returns {key: storedValue | undefined}
      result[keyOrObj] = store[keyOrObj];
    } else if (Array.isArray(keyOrObj)) {
      // get(['key1', 'key2'], cb)
      keyOrObj.forEach((key: string) => {
        result[key] = store[key];
      });
    } else if (typeof keyOrObj === 'object') {
      // get({key: defaultValue}, cb) → returns {key: storedValue || defaultValue}
      Object.keys(keyOrObj).forEach((key) => {
        result[key] = store.hasOwnProperty(key) ? store[key] : keyOrObj[key];
      });
    }

    // 模拟异步回调
    setTimeout(() => callback(result), 0);
  }

  set(obj: any, callback?: Function) {
    const store = this._getStore();
    Object.keys(obj).forEach((key) => {
      store[key] = obj[key];
    });
    this._setStore(store);
    // 模拟异步回调
    if (callback) {
      setTimeout(() => callback(), 0);
    }
  }
}

interface ChromeStorageManagerProps {
  useChromeStorageSyncFn: boolean;
}
export class ChromeStorageManager {
  private storageFn: any;

  constructor(props: ChromeStorageManagerProps) {
    if (process.env.NODE_ENV !== 'production') {
      // 本地开发环境使用 localStorage 适配器
      this.storageFn = new LocalStorageAdapter();
    } else {
      /**
      **  More details: https://developer.chrome.com/extensions/storage
      **
      **  QUOTA_BYTES prop in storage.local is 5,242,880,
      **  which indicates the maximum amount (in bytes) of data that can be stored in local storage,
      **  as measured by the JSON stringification of every value plus every key's length.
      */
      // Use the global `chrome` directly so this works in both page contexts
      // and the MV3 service worker (which has no `window`).
      this.storageFn = props.useChromeStorageSyncFn ? chrome.storage.sync : chrome.storage.local;
    }
  }

  get(keyOrObj: any, callback: Function = (args: any): any => {}) {
    this.storageFn.get(keyOrObj, callback);
  }

  set(obj: any, callback: Function = (args: any): any => {}) {
    this.storageFn.set(obj, callback);
  }
}

const csmInstance = new ChromeStorageManager({
  useChromeStorageSyncFn: USE_CHROME_STORAGE_SYNC_FN, // we can also make this option configurable
});

/**
 * 兼容chrome.storage.sync 历史数据的逻辑
 */
function checkAndSyncHistorialSyncStorageDataToLocal() {
  const historyStorageKeyOrObj = {
    [JSONC_CONFIG]: {
      0: '',
    },
    [JSON_CONFIG]: {},
    [TAB_LIST]: [{
      id: '0',
      name: 'Current',
      active: true,
    }],
    [ACTIVE_KEYS]: ['0'],
  };
  const migaratedFlag = {
    [SYNC_STORAGE_DATA_HAS_BEEN_MIGARATED_TO_LOCAL]: {
      migarated: false,
    },
  };

  // Code below is only for migaration testing
  //
  // csmInstance.set({
  //   [SYNC_STORAGE_DATA_HAS_BEEN_MIGARATED_TO_LOCAL]: {
  //     migarated: false,
  //   },
  // });

  csmInstance.get(migaratedFlag, (result: any) => {
    if (!result[SYNC_STORAGE_DATA_HAS_BEEN_MIGARATED_TO_LOCAL].migarated) {
      chrome.storage.sync.get(historyStorageKeyOrObj, (hisData: any) => {
        const stash: any = {
          [JSONC_CONFIG]: {},
          [JSON_CONFIG]: {},
        };
        hisData[TAB_LIST].forEach((tab: any)=>{
          stash[JSONC_CONFIG][tab.id] = hisData[JSONC_CONFIG][tab.id];
          stash[JSON_CONFIG][tab.id] = hisData[JSON_CONFIG][tab.id];
        })

        csmInstance.set({
          [SYNC_STORAGE_DATA_HAS_BEEN_MIGARATED_TO_LOCAL]: {
            migarated: true,
          },
          ...hisData,
          ...stash,
        });
      })
    } else {
      console.log('SYNC_STORAGE_DATA_HAS_BEEN_MIGARATED_TO_LOCAL');
    }
  })
}

// 仅在插件环境执行历史数据迁移
if (process.env.NODE_ENV === 'production') {
  checkAndSyncHistorialSyncStorageDataToLocal();
}


export function getConfig(editingConfigKey: string): Promise<any> {
  return new Promise((resolve) => {
    csmInstance.get({
      [JSONC_CONFIG]: {
        0: DEFAULT_DATA,
      },
    }, (result: any) => {
      if (typeof result[JSONC_CONFIG] === 'string') {
        return resolve(result[JSONC_CONFIG]);
      }
      resolve(result[JSONC_CONFIG][editingConfigKey] || DEFAULT_DATA);
    });
  });
}

export function getActiveKeys(): Promise<any> {
  return new Promise((resolve) => {
    csmInstance.get(
      {
        [ACTIVE_KEYS]: ['0'],
      }, (result: any) => {
        resolve(result[ACTIVE_KEYS]);
      });
  });
}

export function setActiveKeys(keys?: string[]): Promise<object> {
  return new Promise((resolve) => {
    csmInstance.set(
      {
        [ACTIVE_KEYS]: keys,
      },
      resolve
    );
  });
}

export function getConfigItems(): Promise<any> {
  return new Promise((resolve) => {
    csmInstance.get(
      {
        [TAB_LIST]: [{
          id: '0',
          name: 'Current',
          active: true,
        }],
      }, (result: any) => {
        resolve(result[TAB_LIST]);
      });
  });
}

export async function setConfigItemPinned(id: string, pinned: boolean): Promise<any[]> {
  const items = await getConfigItems();
  if (id === '0') return items;
  const pinnedAt = Math.max(Date.now(), ...items.map((item: any) => (item.pinnedAt || 0) + 1));
  const next = items.map((item: any) => item.id === id
    ? { ...item, pinnedAt: pinned ? pinnedAt : 0 }
    : item);
  // Pinning affects presentation only; preserve ACTIVE_KEYS and execution order.
  await new Promise<void>((resolve) => csmInstance.set({ [TAB_LIST]: next }, resolve));
  return next;
}

export function setConfigItems(items?: any): Promise<object> {
  return new Promise((resolve) => {
    csmInstance.set(
      {
        [TAB_LIST]: items.slice(),
        [ACTIVE_KEYS]: items.map((item: any) => {
          if (item.active) {
            return item.id;
          }
        }),
      },
      resolve
    );
  });
}

export function getEditingConfigKey(): Promise<string> {
  return new Promise((resolve) => {
    csmInstance.get(
      {
        [EDITING_CONFIG_KEY]: '0',
      }, (result: any) => {
        resolve(result[EDITING_CONFIG_KEY]);
      });
  });
}

export function setEditingConfigKey(key: string): Promise<object> {
  return new Promise((resolve) => {
    csmInstance.set(
      {
        [EDITING_CONFIG_KEY]: key,
      },
      resolve
    );
  });
}

export function saveConfig(jsonc: string, editingConfigKey: string): Promise<any> {
  const json = JSONC2JSON(jsonc);

  return new Promise((resolve) => {
    csmInstance.get({
      [JSONC_CONFIG]: {},
      [JSON_CONFIG]: {},
    }, (result: any) => {
      // migrate
      if (typeof result[JSONC_CONFIG] === 'string') {
        result[JSONC_CONFIG] = {};
        result[JSON_CONFIG] = {};
      }

      result[JSONC_CONFIG][editingConfigKey] = jsonc;

      JSON_Parse(json, (error, parsedJSON) => {
        if (!error) {
          result[JSON_CONFIG][editingConfigKey] = parsedJSON;
          return;
        }
        result[JSON_CONFIG][editingConfigKey] = '';
      });

      csmInstance.set(
        result,
        resolve
      );
    });
  });
}

export function getChecked(): Promise<string> {
  return new Promise((resolve) => {
    csmInstance.get({ [DISABLED]: Enabled.YES }, (result: any) => {
      resolve(result[DISABLED]);
    });
  });
}

export function setChecked(checked?: boolean): Promise<object> {
  return new Promise((resolve) => {
    csmInstance.set(
      {
        [DISABLED]: checked ? Enabled.YES : Enabled.NO,
      },
      resolve
    );
  });
}

export function getOptions(): Promise<OptionsStorage> {
  return new Promise((resolve) => {
    csmInstance.get(
      {
        [CLEAR_CACHE_ENABLED]: Enabled.YES,
        [CORS_ENABLED_STORAGE_KEY]: Enabled.YES,
      },
      (result: any) => {
        resolve({
          [CLEAR_CACHE_ENABLED]: result.clearCacheEnabled,
          [CORS_ENABLED_STORAGE_KEY]: result.corsEnabled,
        });
      }
    );
  });
}

export function setOptions(options: any): Promise<OptionsStorage> {
  return new Promise((resolve) => {
    csmInstance.set(
      {
        clearCacheEnabled: options.clearCacheEnabled
          ? Enabled.YES
          : Enabled.NO,
        corsEnabled: options.corsEnabled ? Enabled.YES : Enabled.NO,
      },
      resolve
    );
  });
}

export function openLink(url: string, isInner: boolean = false): void {
  const finalUrl = isInner && chrome.runtime ? chrome.runtime.getURL(url) : url;
  chrome.tabs.create({ url: finalUrl });
}



interface ExportConfigItem {
  name: string;
  active: boolean;
  jsonc: string;
}

export interface ExportConfigData {
  version: number;
  exportedAt: string;
  items: ExportConfigItem[];
}

/**
 * 导出全部配置项（TAB_LIST + 对应的 JSONC 内容）
 */
export function exportAllConfigs(): Promise<ExportConfigData> {
  return new Promise((resolve) => {
    csmInstance.get(
      {
        [JSONC_CONFIG]: {},
        [TAB_LIST]: [
          {
            id: '0',
            name: 'Current',
            active: true,
          },
        ],
      },
      (result: any) => {
        const tabs: Array<{ id: string; name: string; active: boolean }> =
          result[TAB_LIST] || [];
        const jsoncMap: any =
          typeof result[JSONC_CONFIG] === 'string' ? {} : result[JSONC_CONFIG] || {};

        const items: ExportConfigItem[] = tabs.map((tab) => ({
          name: tab.name,
          active: !!tab.active,
          jsonc: typeof jsoncMap[tab.id] === 'string' ? jsoncMap[tab.id] : '',
        }));

        resolve({
          version: 1,
          exportedAt: new Date().toISOString(),
          items,
        });
      }
    );
  });
}

/**
 * 检测导入数据中与现有配置重名的项，返回冲突的名称列表。
 */
export function detectImportConflicts(
  data: ExportConfigData
): Promise<string[]> {
  return new Promise((resolve, reject) => {
    if (!data || !Array.isArray(data.items)) {
      reject(new Error('Invalid config file format'));
      return;
    }
    csmInstance.get(
      {
        [TAB_LIST]: [
          {
            id: '0',
            name: 'Current',
            active: true,
          },
        ],
      },
      (result: any) => {
        const tabs: Array<{ id: string; name: string }> = Array.isArray(
          result[TAB_LIST]
        )
          ? result[TAB_LIST]
          : [];
        const existNames = new Set(tabs.map((t) => t.name));
        const conflicts: string[] = [];
        data.items.forEach((it) => {
          if (it && typeof it.name === 'string' && existNames.has(it.name)) {
            conflicts.push(it.name);
          }
        });
        resolve(conflicts);
      }
    );
  });
}

function buildTimestampSuffix(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(
    d.getHours()
  )}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

/**
 * 导入配置：根据 mode 处理重名项。
 * - overwrite: 同名覆盖 JSONC 与 active 状态（默认）
 * - rename:    同名项名称追加时间戳后追加为新项
 * 返回导入后最新的 TAB_LIST，供 UI 刷新使用。
 */
export function importConfigs(
  data: ExportConfigData,
  mode: 'overwrite' | 'rename' = 'overwrite'
): Promise<{ items: Array<{ id: string; name: string; active: boolean }>; updated: number; added: number; renamed: number }> {
  return new Promise((resolve, reject) => {
    if (!data || !Array.isArray(data.items)) {
      reject(new Error('Invalid config file format'));
      return;
    }

    csmInstance.get(
      {
        [JSONC_CONFIG]: {},
        [JSON_CONFIG]: {},
        [TAB_LIST]: [
          {
            id: '0',
            name: 'Current',
            active: true,
          },
        ],
      },
      (result: any) => {
        const tabs: Array<{ id: string; name: string; active: boolean }> = Array.isArray(
          result[TAB_LIST]
        )
          ? result[TAB_LIST].slice()
          : [];
        const jsoncMap: any =
          typeof result[JSONC_CONFIG] === 'string' || !result[JSONC_CONFIG]
            ? {}
            : { ...result[JSONC_CONFIG] };
        const jsonMap: any =
          typeof result[JSON_CONFIG] === 'string' || !result[JSON_CONFIG]
            ? {}
            : { ...result[JSON_CONFIG] };

        let updated = 0;
        let added = 0;
        let renamed = 0;
        const suffix = buildTimestampSuffix();

        data.items.forEach((incoming, idx) => {
          if (!incoming || typeof incoming.name !== 'string') {
            return;
          }
          const jsonc = typeof incoming.jsonc === 'string' ? incoming.jsonc : '';
          const exist = tabs.find((t) => t.name === incoming.name);
          let targetId: string;

          if (exist && mode === 'overwrite') {
            // 覆盖现有项
            targetId = exist.id;
            exist.active = !!incoming.active;
            updated += 1;
          } else {
            // 未重名 或 重命名模式下重命名后追加
            let finalName = incoming.name;
            if (exist && mode === 'rename') {
              let candidate = `${incoming.name}_${suffix}`;
              let i = 1;
              const usedNames = new Set(tabs.map((t) => t.name));
              while (usedNames.has(candidate)) {
                candidate = `${incoming.name}_${suffix}_${i++}`;
              }
              finalName = candidate;
              renamed += 1;
            }
            targetId = String(Date.now()) + '_' + idx;
            tabs.push({
              id: targetId,
              name: finalName,
              active: !!incoming.active,
            });
            added += 1;
          }
          jsoncMap[targetId] = jsonc;
          // 同步解析为 JSON
          const json = JSONC2JSON(jsonc);
          JSON_Parse(json, (error, parsedJSON) => {
            jsonMap[targetId] = error ? '' : parsedJSON;
          });
        });

        const activeKeys = tabs
          .filter((t) => t.active)
          .map((t) => t.id);

        csmInstance.set(
          {
            [TAB_LIST]: tabs,
            [ACTIVE_KEYS]: activeKeys,
            [JSONC_CONFIG]: jsoncMap,
            [JSON_CONFIG]: jsonMap,
          },
          () => {
            resolve({ items: tabs, updated, added, renamed });
          }
        );
      }
    );
  });
}

export function removeUnusedItems(){
  csmInstance.get({
    [JSONC_CONFIG]: {},
    [JSON_CONFIG]: {},
    [TAB_LIST]: [{
      id: '0',
      name: 'Current',
      active: true,
    }],
  }, (result: any) => {
    let stash: any = {
      [JSONC_CONFIG]: {},
      [JSON_CONFIG]: {},
    };
    result[TAB_LIST].forEach((tab: any)=>{
      stash[JSONC_CONFIG][tab.id] = result[JSONC_CONFIG][tab.id];
      stash[JSON_CONFIG][tab.id] = result[JSON_CONFIG][tab.id];
    })
    csmInstance.set(
      stash,
      ()=>{}
    );
  });
}
