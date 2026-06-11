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

// 注意：由于 MV3 Service Worker 可能在 async 回调执行前被终止，
// 我们立即调用一次 syncUpdateIcon() 设置默认状态，
// 然后立即调用 restoreExtensionState() 从 storage 读取真实状态并纠正图标。
syncUpdateIcon();
restoreExtensionState();

/**
 * 同步更新图标和徽章（仅依赖当前内存中的 forward 对象状态）
 */
function syncUpdateIcon() {
  // setChecked(true) 存入 DISABLED = Enabled.YES，表示扩展启用
  // setChecked(false) 存入 DISABLED = Enabled.NO，表示扩展禁用
  // 因此：DISABLED !== Enabled.NO 即为启用状态
  const enabled = forward[DISABLED] !== Enabled.NO;
  const action = (chrome as any).action || (chrome as any).browserAction;
  if (!action) {
    return;
  }
  // 设置图标文件
  action.setIcon({ path: enabled ? BLUE_ICON_PATH : GREY_ICON_PATH });
  // 设置徽章
  if (parseError) {
    action.setBadgeText({ text: '!' });
    action.setBadgeBackgroundColor({ color: '#f5222d' });
  } else if (!enabled) {
    action.setBadgeText({ text: 'OFF' });
    action.setBadgeBackgroundColor({ color: '#bfbfbf' });
  } else {
    const proxyLength = forward[JSON_CONFIG]?.[PROXY_STORAGE_KEY]?.length || 0;
    action.setBadgeText({ text: String(proxyLength) });
    action.setBadgeBackgroundColor({ color: '#1890ff' });
  }
}

/**
 * 从 storage 恢复扩展完整状态（配置、启用状态、图标、徽章）
 * 合并为单一读取操作，避免多个异步回调之间的竞态条件
 */
function restoreExtensionState() {
  csmInstance.get({
    [JSON_CONFIG]: {
      0: {
        [PROXY_STORAGE_KEY]: [],
        [CORS_STORAGE]: [],
      },
    },
    [ACTIVE_KEYS]: ['0'],
    [DISABLED]: Enabled.YES,
    [CLEAR_CACHE_ENABLED]: Enabled.YES,
    [CORS_ENABLED_STORAGE_KEY]: Enabled.YES,
  }, (result: any) => {
    // 恢复配置
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

    // 恢复启用/禁用状态
    forward[DISABLED] = result[DISABLED];
    clearCacheEnabled = result[CLEAR_CACHE_ENABLED] === Enabled.YES;
    corsEnabled = result[CORS_ENABLED_STORAGE_KEY] === Enabled.YES;

    // 状态和配置都已就绪，同步更新图标和徽章
    syncUpdateIcon();
  });
}

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

// 浏览器启动时恢复扩展状态，确保重启后图标和徽章正确展示
chrome.runtime.onStartup.addListener(() => {
  restoreExtensionState();
  refreshRulesFromStorage();
});

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
 *
 * 注意：必须先通过 getDynamicRules() 查询当前实际存在的规则 ID，再针对性地移除。
 * 早期实现会一次性传入 1~19999 全量 ID 作为 removeRuleIds，数组过大会导致
 * updateDynamicRules 调用静默失败（且无异常被捕获），出现"开关已关闭但旧的转发规则
 * 仍然生效"的问题。
 */
async function updateDNRRules(proxyRules: string[][], corsRules: string[]) {
  try {
    const existing = await dnr.getDynamicRules();
    const removeRuleIds: number[] = Array.isArray(existing)
      ? existing.map((rule: any) => rule.id)
      : [];

    await dnr.updateDynamicRules({
      removeRuleIds,
      addRules: [
        ...generateRedirectRules(proxyRules, 1),
        ...generateCORSRules(corsRules, 10000),
      ],
    });
  } catch (err) {
    // 主动暴露 DNR 更新失败信息，避免静默失败导致开关状态与实际规则不一致
    console.error('[XSwitch] updateDynamicRules failed:', err);
  }
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
    // setChecked(true) 存入 Enabled.YES = 启用，setChecked(false) 存入 Enabled.NO = 禁用
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
  // 同步更新图标（此时 forward[DISABLED] 已从 changes 中更新）
  syncUpdateIcon();
  // 异步更新配置（不影响图标，只更新 forward[JSON_CONFIG]）
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
  });
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
  // setIcon 保留为向后兼容的封装，内部委托给 syncUpdateIcon
  syncUpdateIcon();
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
  // 委托给 syncUpdateIcon 统一处理图标和徽章
  syncUpdateIcon();
}

// 注意：图标和徽章的同步更新已在顶部顶层代码中通过 syncUpdateIcon() 完成，
// restoreExtensionState() 的 async 回调中会再次同步更新，确保最终状态正确。
