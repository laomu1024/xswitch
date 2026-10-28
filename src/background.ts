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
  HEADER_STORAGE_KEY,
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
import {
  convertCaptureGroupSyntax,
  generateHeaderRules,
  DNR_RESOURCE_TYPES,
} from './dnr-utils';

const csmInstance = new ChromeStorageManager({
  useChromeStorageSyncFn: USE_CHROME_STORAGE_SYNC_FN,
});

let clearRunning: boolean = false;
let clearCacheEnabled: boolean = true;
let corsEnabled: boolean = true;
// 被 DNR 拒绝、未能生效的规则描述，非空时角标显示 '!'
let invalidRuleMessages: string[] = [];
let invalidRuleLogKey = '';
let lastBatchRejectMessage = '';
let jsonActiveKeys = ['0'];
let conf: StorageJSON = {
  0: {
    [PROXY_STORAGE_KEY]: [],
    [CORS_STORAGE]: [],
    [HEADER_STORAGE_KEY]: [],
  },
};

interface SingleConfig {
  [PROXY_STORAGE_KEY]: Array<[]>;
  [CORS_STORAGE]: string[];
  [HEADER_STORAGE_KEY]: Array<[string, Record<string, string>]>;
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
  if (!enabled) {
    action.setBadgeText({ text: 'OFF' });
    action.setBadgeBackgroundColor({ color: '#bfbfbf' });
  } else if (invalidRuleMessages.length) {
    action.setBadgeText({ text: '!' });
    action.setBadgeBackgroundColor({ color: '#f5222d' });
  } else {
    const proxyLength = forward[JSON_CONFIG]?.[PROXY_STORAGE_KEY]?.length || 0;
    const headerLength = forward[JSON_CONFIG]?.[HEADER_STORAGE_KEY]?.length || 0;
    action.setBadgeText({ text: String(proxyLength + headerLength) });
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
        [HEADER_STORAGE_KEY]: [],
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
      forward[JSON_CONFIG] = getActiveConfig(conf);
    } else {
      forward[JSON_CONFIG] = {
        [PROXY_STORAGE_KEY]: [],
        [CORS_STORAGE]: [],
        [HEADER_STORAGE_KEY]: [],
      };
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

/**
 * 合并当前勾选的分组，生成实际生效的配置
 *
 * 返回新对象，不修改入参：徽章数量和 DNR 规则会基于同一份 conf 反复重算，
 * 若原地合并会导致规则/数量被重复累加。
 */
function getActiveConfig(config: StorageJSON): any {
  const json: any = {
    [PROXY_STORAGE_KEY]: [],
    [CORS_STORAGE]: [],
    [HEADER_STORAGE_KEY]: [],
  };
  jsonActiveKeys.forEach((key: string) => {
    const item = config?.[key];
    if (!item) {
      return;
    }
    if (item[PROXY_STORAGE_KEY]) {
      json[PROXY_STORAGE_KEY] = [...json[PROXY_STORAGE_KEY], ...item[PROXY_STORAGE_KEY]];
    }
    if (item[CORS_STORAGE]) {
      json[CORS_STORAGE] = [...json[CORS_STORAGE], ...item[CORS_STORAGE]];
    }
    if (item[HEADER_STORAGE_KEY]) {
      json[HEADER_STORAGE_KEY] = [...json[HEADER_STORAGE_KEY], ...item[HEADER_STORAGE_KEY]];
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
  for (const item of proxyRules) {
    // 条目结构异常时仍生成规则交给 DNR 校验，避免同步抛错中断本次更新
    const [from, to] = Array.isArray(item) ? item : [];
    // DNR regexSubstitution uses \1, \2 syntax instead of JS $1, $2
    const dnrTo = typeof to === 'string' ? convertCaptureGroupSyntax(to) : '';
    rules.push({
      id: id++,
      priority: 1,
      action: {
        type: "redirect",
        redirect: { regexSubstitution: dnrTo }
      },
      condition: {
        regexFilter: from,
        resourceTypes: DNR_RESOURCE_TYPES,
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
        resourceTypes: DNR_RESOURCE_TYPES,
      }
    });
  }
  return rules;
}

interface DnrRuleEntry {
  rule: any;
  description: string;
}

function describeDnrRule(rule: any): string {
  const pattern = rule?.condition?.regexFilter || rule?.condition?.urlFilter || '';
  if (rule?.action?.type === 'redirect') {
    const to = String(rule.action.redirect?.regexSubstitution || '').replace(/\\(\d+)/g, '$$$1');
    return `proxy: ${pattern} → ${to}`;
  }
  if (rule?.action?.responseHeaders) {
    return `cors: ${pattern}`;
  }
  return `header: ${pattern}`;
}

async function getDynamicRuleIds(): Promise<number[]> {
  const existing = await dnr.getDynamicRules();
  return Array.isArray(existing) ? existing.map((rule: any) => rule.id) : [];
}

/**
 * 追加规则；某次提交失败时二分重试，只为定位并跳过非法规则，
 * 保证合法规则仍能生效。
 */
async function applyDnrRuleEntries(
  entries: DnrRuleEntry[],
  invalid: Array<{ description: string; error: unknown }>
): Promise<void> {
  if (!entries.length) {
    return;
  }
  try {
    await dnr.updateDynamicRules({ addRules: entries.map((entry) => entry.rule) });
  } catch (err) {
    if (entries.length === 1) {
      invalid.push({ description: entries[0].description, error: err });
      return;
    }
    const mid = Math.ceil(entries.length / 2);
    await applyDnrRuleEntries(entries.slice(0, mid), invalid);
    await applyDnrRuleEntries(entries.slice(mid), invalid);
  }
}

function setInvalidDnrRules(invalid: Array<{ description: string; error: unknown }>): void {
  invalidRuleMessages = invalid.map((item) => item.description);
  const logKey = invalidRuleMessages.join('\n');
  if (logKey && logKey !== invalidRuleLogKey) {
    invalid.slice(0, 20).forEach((item) => {
      console.error(`[XSwitch] 规则未生效（已跳过）: ${item.description} —`, item.error);
    });
    if (invalid.length > 20) {
      console.error(`[XSwitch] 另有 ${invalid.length - 20} 条规则未生效`);
    }
  }
  invalidRuleLogKey = logKey;
  syncUpdateIcon();
}

async function applyDnrRulesNow(entries: DnrRuleEntry[]): Promise<void> {
  const invalid: Array<{ description: string; error: unknown }> = [];
  try {
    await dnr.updateDynamicRules({
      removeRuleIds: await getDynamicRuleIds(),
      addRules: entries.map((entry) => entry.rule),
    });
    lastBatchRejectMessage = '';
  } catch (err) {
    // DNR 的更新是整批原子的：任一规则不合法（如 RE2 不支持 lookahead），
    // 旧规则会继续生效而角标已按新配置显示。降级为分组应用，跳过非法规则。
    const message = String(err);
    if (message !== lastBatchRejectMessage) {
      console.warn('[XSwitch] updateDynamicRules rejected the batch, retrying in chunks:', err);
      lastBatchRejectMessage = message;
    }
    await dnr.updateDynamicRules({ removeRuleIds: await getDynamicRuleIds() });
    await applyDnrRuleEntries(entries, invalid);
  }
  setInvalidDnrRules(invalid);
}

/**
 * 更新 DNR 动态规则
 *
 * 注意：必须先通过 getDynamicRules() 查询当前实际存在的规则 ID，再针对性地移除。
 * 早期实现会一次性传入 1~19999 全量 ID 作为 removeRuleIds，数组过大会导致
 * updateDynamicRules 调用静默失败（且无异常被捕获），出现"开关已关闭但旧的转发规则
 * 仍然生效"的问题。
 *
 * 连续变更（尤其是降级重试较慢时）必须串行执行，否则多次更新会交错。
 */
let dnrUpdateChain: Promise<void> = Promise.resolve();

function updateDNRRules(
  proxyRules: string[][],
  corsRules: string[],
  headerRules: Array<[string, Record<string, string>]>
): void {
  const entries: DnrRuleEntry[] = [
    ...generateRedirectRules(proxyRules, 1),
    ...generateCORSRules(corsRules, 10000),
    ...generateHeaderRules(headerRules, 20000),
  ].map((rule: any) => ({ rule, description: describeDnrRule(rule) }));

  dnrUpdateChain = dnrUpdateChain
    .then(() => applyDnrRulesNow(entries))
    .catch((err) => {
      // 暴露非规则本身导致的失败（如 getDynamicRules 异常），避免静默不一致
      console.error('[XSwitch] updateDynamicRules failed:', err);
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
        [HEADER_STORAGE_KEY]: [],
      },
    },
    [ACTIVE_KEYS]: ['0'],
    [DISABLED]: Enabled.YES,
  }, (result: any) => {
    let proxyRules: string[][] = [];
    let corsRules: string[] = [];
    let headerRules: Array<[string, Record<string, string>]> = [];
    // 当扩展被关闭时，清空所有 DNR 规则，确保转发不再生效
    // setChecked(true) 存入 Enabled.YES = 启用，setChecked(false) 存入 Enabled.NO = 禁用
    const enabled = result[DISABLED] !== Enabled.NO;
    if (enabled && result && result[JSON_CONFIG]) {
      const config = getActiveConfig(result[JSON_CONFIG]);
      proxyRules = config[PROXY_STORAGE_KEY] || [];
      corsRules = config[CORS_STORAGE] || [];
      headerRules = config[HEADER_STORAGE_KEY] || [];
    }
    updateDNRRules(proxyRules, corsRules, headerRules);
  });
}

// 初始化时加载规则
refreshRulesFromStorage();

// 监听 storage 变化，自动刷新规则
chrome.storage.onChanged.addListener((changes) => {
  if (changes[ACTIVE_KEYS]) {
    jsonActiveKeys = changes[ACTIVE_KEYS].newValue || ['0'];
  }
  if (changes[JSON_CONFIG]) {
    const nextConfig = changes[JSON_CONFIG].newValue;
    if (nextConfig && typeof nextConfig === 'object') {
      conf = nextConfig;
    }
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
  // 徽章数量取决于「勾选的分组」，必须在这里同步重算：
  // 勾选/取消分组只会改 ACTIVE_KEYS，若等异步读取后再重算，
  // 徽章会停留在上一次的状态。
  if (changes[JSON_CONFIG] || changes[ACTIVE_KEYS]) {
    forward[JSON_CONFIG] = getActiveConfig(conf);
  }
  syncUpdateIcon();
  refreshRulesFromStorage();
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
