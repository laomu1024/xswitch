import {
  ALL_URLS,
  BLOCKING,
  EMPTY_STRING,
  MILLISECONDS_PER_WEEK,
  REQUEST_HEADERS,
  RESPONSE_HEADERS,
  JSON_CONFIG,
  DISABLED,
  CLEAR_CACHE_ENABLED,
  CORS_ENABLED_STORAGE_KEY,
  PROXY_STORAGE_KEY,
  CORS_STORAGE,
  ACTIVE_KEYS,
  USE_CHROME_STORAGE_SYNC_FN,
  GREY_ICON_PATH,
  BLUE_ICON_PATH,
} from './constants';
import {
  BadgeText,
  Enabled,
  IconBackgroundColor,
} from './enums';
import forward from './forward';
import { ChromeStorageManager } from './chrome-storage';
import { convertCaptureGroupSyntax } from './dnr-utils';

const csmInstance = new ChromeStorageManager({
  useChromeStorageSyncFn: USE_CHROME_STORAGE_SYNC_FN,
});

let clearRunning: boolean = false;
let clearCacheEnabled: boolean = true;
let corsEnabled: boolean = true;
let parseError: boolean = false;
let jsonActiveKeys = ['0'];
let conf: StorageJSON = {
  0: {
    [PROXY_STORAGE_KEY]: [],
    [CORS_STORAGE]: [],
  },
};

interface SingleConfig {
  [PROXY_STORAGE_KEY]: Array<[]>;
  [CORS_STORAGE]: string[];
}

interface StorageJSON {
  0: SingleConfig;
  [key: string]: any;
}

csmInstance.get({
  [JSON_CONFIG]: {
    0: {
      [PROXY_STORAGE_KEY]: [],
      [CORS_STORAGE]: [],
    },
  },
  [ACTIVE_KEYS]: ['0'],
}, (result: any) => {
  jsonActiveKeys = result[ACTIVE_KEYS];
  if (result && result[JSON_CONFIG]) {
    conf = result[JSON_CONFIG];
    const config = getActiveConfig(conf);
    forward[JSON_CONFIG] = { ...config };
  } else {
    forward[JSON_CONFIG] = {
      [PROXY_STORAGE_KEY]: [],
      [CORS_STORAGE]: [],
    };
    parseError = false;
  }
});

// 使用类型断言，避免TS报错
const dnr: any = (chrome as any).declarativeNetRequest;

function getActiveConfig(config: StorageJSON): any {
  const activeKeys = [...jsonActiveKeys];
  const json = config['0'];
  activeKeys.forEach((key: string) => {
    if (config[key] && key !== '0') {
      if (config[key][PROXY_STORAGE_KEY]) {
        if (!json[PROXY_STORAGE_KEY]) {
          json[PROXY_STORAGE_KEY] = [];
        }
        json[PROXY_STORAGE_KEY] = [...json[PROXY_STORAGE_KEY], ...config[key][PROXY_STORAGE_KEY]];
      }

      if (config[key][CORS_STORAGE]) {
        if (!json[CORS_STORAGE]) {
          json[CORS_STORAGE] = [];
        }
        json[CORS_STORAGE] = [...json[CORS_STORAGE], ...config[key][CORS_STORAGE]];
      }
    }
  });
  return json;
}

csmInstance.get(
  {
    [DISABLED]: Enabled.YES,
    [CLEAR_CACHE_ENABLED]: Enabled.YES,
    [CORS_ENABLED_STORAGE_KEY]: Enabled.YES,
  },
  (result: any) => {
    forward[DISABLED] = result[DISABLED];
    clearCacheEnabled = result[CLEAR_CACHE_ENABLED] === Enabled.YES;
    corsEnabled = result[CORS_ENABLED_STORAGE_KEY] === Enabled.YES;
    setIcon();
  }
);

/**
 * 生成 DNR 重定向规则
 */
export function generateRedirectRules(proxyRules: string[][], ruleIdStart = 1) {
  const rules = [];
  let id = ruleIdStart;
  for (const [from, to] of proxyRules) {
    // DNR regexSubstitution uses \1, \2 syntax instead of JS $1, $2
    const dnrTo = convertCaptureGroupSyntax(to);
    rules.push({
      id: id++,
      priority: 1,
      action: {
        type: "redirect",
        redirect: { regexSubstitution: dnrTo }
      },
      condition: {
        regexFilter: from,
        resourceTypes: ["main_frame", "sub_frame", "xmlhttprequest", "script", "stylesheet", "image", "font", "other"]
      }
    });
  }
  return rules;
}

/**
 * 生成 DNR CORS 规则
 */
function generateCORSRules(corsRules: string[], ruleIdStart = 10000) {
  const rules = [];
  let id = ruleIdStart;
  for (const corsUrl of corsRules) {
    rules.push({
      id: id++,
      priority: 1,
      action: {
        type: "modifyHeaders",
        responseHeaders: [
          { header: "Access-Control-Allow-Origin", operation: "set", value: "*" },
          { header: "Access-Control-Allow-Methods", operation: "set", value: "GET, POST, PUT, DELETE, OPTIONS" },
          { header: "Access-Control-Allow-Headers", operation: "set", value: "*" },
          { header: "Access-Control-Allow-Credentials", operation: "set", value: "true" }
        ]
      },
      condition: {
        urlFilter: corsUrl,
        resourceTypes: ["xmlhttprequest", "main_frame", "sub_frame", "script", "stylesheet", "image", "font", "other"]
      }
    });
  }
  return rules;
}

/**
 * 更新 DNR 动态规则
 */
async function updateDNRRules(proxyRules: string[][], corsRules: string[]) {
  // 先移除所有动态规则
  const allIds = [];
  for (let i = 1; i < 10000; i++) allIds.push(i);
  for (let i = 10000; i < 20000; i++) allIds.push(i);

  await dnr.updateDynamicRules({
    removeRuleIds: allIds,
    addRules: [
      ...generateRedirectRules(proxyRules, 1),
      ...generateCORSRules(corsRules, 10000)
    ]
  });
}

/**
 * 监听配置变化，动态更新规则
 */
function refreshRulesFromStorage() {
  csmInstance.get({
    [JSON_CONFIG]: {
      0: {
        [PROXY_STORAGE_KEY]: [],
        [CORS_STORAGE]: [],
      },
    },
    [ACTIVE_KEYS]: ['0'],
    [DISABLED]: Enabled.YES,
  }, (result: any) => {
    let proxyRules: string[][] = [];
    let corsRules: string[] = [];
    // 当扩展被关闭时，清空所有 DNR 规则，确保转发不再生效
    const enabled = result[DISABLED] !== Enabled.NO;
    if (enabled && result && result[JSON_CONFIG]) {
      const config = getActiveConfig(result[JSON_CONFIG]);
      proxyRules = config[PROXY_STORAGE_KEY] || [];
      corsRules = config[CORS_STORAGE] || [];
    }
    updateDNRRules(proxyRules, corsRules);
  });
}

// 初始化时加载规则
refreshRulesFromStorage();

// 监听 storage 变化，自动刷新规则
chrome.storage.onChanged.addListener((changes) => {
  refreshRulesFromStorage();
  if (changes[ACTIVE_KEYS]) {
    jsonActiveKeys = changes[ACTIVE_KEYS].newValue;
  }
  if (changes[JSON_CONFIG]) {
    const config = getActiveConfig(changes[JSON_CONFIG].newValue);
    forward[JSON_CONFIG] = { ...config };
  }
  if (changes[DISABLED]) {
    forward[DISABLED] = changes[DISABLED].newValue;
  }
  if (changes[CLEAR_CACHE_ENABLED]) {
    clearCacheEnabled = changes[CLEAR_CACHE_ENABLED].newValue === Enabled.YES;
  }
  if (changes[CORS_ENABLED_STORAGE_KEY]) {
    corsEnabled = changes[CORS_ENABLED_STORAGE_KEY].newValue === Enabled.YES;
  }
  csmInstance.get({
    [JSON_CONFIG]: {
      0: {
        [PROXY_STORAGE_KEY]: [],
        [CORS_STORAGE]: [],
      },
    },
  }, (result: any) => {
    if (result && result[JSON_CONFIG]) {
      conf = result[JSON_CONFIG];
      const config = getActiveConfig(conf);
      forward[JSON_CONFIG] = { ...config };
    }
    setIcon();
  });
  checkAndChangeIcons();
});

function setBadgeAndBackgroundColor(
  text: string | number,
  color: string
): void {
  // MV3: chrome.browserAction has been replaced by chrome.action.
  const action =
    (chrome as any).action || (chrome as any).browserAction;
  if (!action) {
    return;
  }
  action.setBadgeText({
    text: EMPTY_STRING + text,
  });
  action.setBadgeBackgroundColor({
    color,
  });
}

function setIcon(): void {
  if (parseError) {
    setBadgeAndBackgroundColor(BadgeText.ERROR, IconBackgroundColor.ERROR);
    return;
  }

  if (forward[DISABLED] !== Enabled.NO) {
    setBadgeAndBackgroundColor(
      forward[JSON_CONFIG][PROXY_STORAGE_KEY].length,
      IconBackgroundColor.ON
    );
  } else {
    setBadgeAndBackgroundColor(BadgeText.OFF, IconBackgroundColor.OFF);
    return;
  }
}

function headersReceivedListener(
  details: chrome.webRequest.WebResponseHeadersDetails): chrome.webRequest.BlockingResponse {
  return forward.onHeadersReceivedCallback(details, corsEnabled);
}

function clearCache(): void {
  if (!clearRunning) {
    clearRunning = true;
    const millisecondsPerWeek = MILLISECONDS_PER_WEEK;
    const oneWeekAgo = new Date().getTime() - millisecondsPerWeek;
    chrome.browsingData.removeCache(
      {
        since: oneWeekAgo,
      },
      () => {
        clearRunning = false;
      }
    );
  }
}

function checkAndChangeIcons() {
  // MV3 service worker has no `window`/`matchMedia`, so the original
  // dark-mode based icon switching cannot run here. Fall back to
  // toggling the icon according to the enabled state of the extension:
  // blue when active, grey when disabled.
  const action =
    (chrome as any).action || (chrome as any).browserAction;
  if (!action) {
    return;
  }
  const enabled = forward[DISABLED] !== Enabled.NO;
  action.setIcon({ path: enabled ? BLUE_ICON_PATH : GREY_ICON_PATH });
}

// check when extension is loaded
checkAndChangeIcons();
