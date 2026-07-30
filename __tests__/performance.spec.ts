/**
 * 性能测试：模拟 popup 打开时的存储层和解析层开销
 *
 * 背景：用户反馈点击扩展图标后 popup 展开慢甚至卡死。
 * 根因分析：
 * 1. popup 初始化时 4 次串行 chrome.storage IPC（getEditingConfigKey → getConfig → getConfigItems → removeUnusedItems）
 * 2. removeUnusedItems() 每次打开都执行全量读写，即使无变化
 * 3. saveConfig 无防抖，每次按键触发完整的 读取→解析→写入 级联
 * 4. 所有规则组内容存于 JSONC_CONFIG 单 key，规则多时反序列化 MB 级数据
 */

// ---- 模拟 localStorage（LocalStorageAdapter 依赖）----
const store: Record<string, string> = {};
(global as any).localStorage = {
  getItem: (key: string) => (key in store ? store[key] : null),
  setItem: (key: string, value: string) => { store[key] = String(value); },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
};

// 模拟 chrome API（模块级迁移检查仅在 production 执行，此处为 test 环境）
(global as any).chrome = {
  storage: {
    sync: { get: (_q: any, cb: Function) => cb({}), set: (_o: any, cb?: Function) => cb && cb() },
    local: { get: (_q: any, cb: Function) => cb({}), set: (_o: any, cb?: Function) => cb && cb() },
    onChanged: { addListener: () => {} },
  },
  runtime: { getURL: (p: string) => p },
  tabs: { create: () => {} },
};

import { JSONC2JSON, JSON_Parse } from '../src/utils';
import { stripJsonComments } from '../src/strip-json-comments';
import {
  getConfig,
  saveConfig,
  getConfigItems,
  getEditingConfigKey,
  removeUnusedItems,
} from '../src/chrome-storage';
import { JSONC_CONFIG, JSON_CONFIG, TAB_LIST, EDITING_CONFIG_KEY } from '../src/constants';

// ---- 测试数据生成器 ----

/** 生成包含 N 条代理规则的 JSONC 配置 */
function generateLargeJSONC(ruleCount: number): string {
  const rules: string[] = [];
  for (let i = 0; i < ruleCount; i++) {
    rules.push(`    [
      "https://cdn${i}.example.com/assets/(.*)\\\\.js", // rule ${i}: 代理到本地开发服务器
      "http://localhost:${3000 + (i % 10)}/assets/$1.js"
    ]`);
  }
  return `{
  // XSwitch 性能测试配置 - ${ruleCount} rules
  "proxy": [
${rules.join(',\n')}
  ],
  "cors": [
    "api.example.com"
  ]
}`;
}

/** 生成 N 个规则组的 items 列表 */
function generateConfigItems(count: number): Array<{ id: string; name: string; active: boolean }> {
  const items = [{ id: '0', name: 'Current', active: true }];
  for (let i = 1; i < count; i++) {
    items.push({ id: String(i), name: `Rule Group ${i}`, active: i % 3 !== 0 });
  }
  return items;
}

/** 向 localStorage 写入模拟的大数据量存储状态 */
function seedStorage(groupCount: number, rulesPerGroup: number) {
  localStorage.clear();
  const jsoncMap: Record<string, string> = {};
  const jsonMap: Record<string, object> = {};
  const items = generateConfigItems(groupCount);

  items.forEach((item) => {
    const jsonc = generateLargeJSONC(rulesPerGroup);
    jsoncMap[item.id] = jsonc;
    jsonMap[item.id] = JSON.parse(JSONC2JSON(jsonc));
  });

  const raw = localStorage.getItem('xswitch_store');
  const state = raw ? JSON.parse(raw) : {};
  state[JSONC_CONFIG] = jsoncMap;
  state[JSON_CONFIG] = jsonMap;
  state[TAB_LIST] = items;
  state[EDITING_CONFIG_KEY] = '0';
  localStorage.setItem('xswitch_store', JSON.stringify(state));
}

function now(): number {
  return performance.now();
}

// ---- 性能测试 ----

describe('Performance: JSONC 解析层', () => {
  test('stripJsonComments 处理 100 条规则配置应在 50ms 内完成', () => {
    const jsonc = generateLargeJSONC(100);
    const start = now();
    const result = stripJsonComments(jsonc);
    const elapsed = now() - start;

    // 注释内容应被移除（URL 中的 // 属于字符串内容，会被正确保留）
    expect(result).not.toContain('rule 0: 代理到本地开发服务器');
    expect(result).not.toContain('XSwitch 性能测试配置');
    expect(elapsed).toBeLessThan(50);
  });

  test('JSONC2JSON 处理 100 条规则配置应在 100ms 内完成', () => {
    const jsonc = generateLargeJSONC(100);
    const start = now();
    const json = JSONC2JSON(jsonc);
    const elapsed = now() - start;

    expect(() => JSON.parse(json)).not.toThrow();
    expect(elapsed).toBeLessThan(100);
  });

  test('JSONC2JSON 处理 500 条规则配置应在 500ms 内完成', () => {
    const jsonc = generateLargeJSONC(500);
    const start = now();
    const json = JSONC2JSON(jsonc);
    const elapsed = now() - start;

    expect(() => JSON.parse(json)).not.toThrow();
    expect(elapsed).toBeLessThan(500);
  });

  test('JSON_Parse 解析大配置应在 50ms 内完成', () => {
    const json = JSONC2JSON(generateLargeJSONC(200));
    const start = now();
    JSON_Parse(json, (error, parsed) => {
      expect(error).toBe(false);
      expect(parsed).toBeDefined();
    });
    const elapsed = now() - start;
    expect(elapsed).toBeLessThan(50);
  });
});

describe('Performance: 存储层操作', () => {
  beforeEach(() => {
    // 模拟中等规模数据：10 个规则组，每组 50 条规则
    seedStorage(10, 50);
  });

  test('getConfig 读取大配置应在 100ms 内完成', async () => {
    const start = now();
    const config = await getConfig('0');
    const elapsed = now() - start;

    expect(typeof config).toBe('string');
    expect((config as string).length).toBeGreaterThan(1000);
    expect(elapsed).toBeLessThan(100);
  });

  test('getConfigItems 应在 50ms 内完成', async () => {
    const start = now();
    const items = await getConfigItems();
    const elapsed = now() - start;

    expect(items.length).toBe(10);
    expect(elapsed).toBeLessThan(50);
  });

  test('saveConfig 完整读写周期应在 200ms 内完成', async () => {
    const jsonc = generateLargeJSONC(100);
    const start = now();
    await saveConfig(jsonc, '0');
    const elapsed = now() - start;

    // 验证数据确实写入
    const saved = await getConfig('0');
    expect(saved).toBe(jsonc);
    expect(elapsed).toBeLessThan(200);
  });

  test('removeUnusedItems 全量读写应在 200ms 内完成', async () => {
    const start = now();
    removeUnusedItems();
    // removeUnusedItems 是同步触发异步操作，等待一个 tick
    await new Promise((resolve) => setTimeout(resolve, 50));
    const elapsed = now() - start;

    expect(elapsed).toBeLessThan(200);
  });
});

describe('Performance: 模拟 popup 初始化序列', () => {
  beforeEach(() => {
    // 模拟较大规模数据：20 个规则组，每组 100 条规则
    seedStorage(20, 100);
  });

  test('完整初始化序列（串行 4 次读取）应在 500ms 内完成', async () => {
    const start = now();

    // 模拟 xswitch.tsx useEffect 中的初始化序列
    const editingConfigKey = await getEditingConfigKey();
    const config = await getConfig(editingConfigKey);
    const configItems = await getConfigItems();
    removeUnusedItems();
    await new Promise((resolve) => setTimeout(resolve, 10));

    const elapsed = now() - start;

    expect(editingConfigKey).toBe('0');
    expect(typeof config).toBe('string');
    expect(configItems.length).toBe(20);
    // 注意：真实环境中每次 chrome.storage IPC 额外增加 5-20ms 延迟，
    // 此处仅测试数据序列化/反序列化开销
    expect(elapsed).toBeLessThan(500);
  });

  test('连续快速 saveConfig（模拟无防抖输入）10 次应在 2s 内完成', async () => {
    const baseJsonc = generateLargeJSONC(50);
    const start = now();

    // 模拟用户快速输入 10 个字符，每次触发 onDidChangeModelContent → saveConfig
    for (let i = 0; i < 10; i++) {
      await saveConfig(baseJsonc + `\n// keystroke ${i}`, '0');
    }

    const elapsed = now() - start;
    // 每次 saveConfig = 全量读取 + JSONC2JSON + JSON.parse + 全量写入
    // 如果此值接近 2s，说明真实环境（含 IPC 延迟）中快速输入会导致明显卡顿
    expect(elapsed).toBeLessThan(2000);
  });

  test('大数据量下 saveConfig 单次耗时应小于 300ms（防抖阈值参考）', async () => {
    seedStorage(20, 200); // 更大配置
    const jsonc = generateLargeJSONC(200);

    const start = now();
    await saveConfig(jsonc, '0');
    const elapsed = now() - start;

    // 此值说明防抖间隔至少应大于单次 saveConfig 耗时
    expect(elapsed).toBeLessThan(300);
  });
});

describe('Performance: 存储数据规模基准', () => {
  test('20 组 x 100 规则的 JSONC_CONFIG 序列化大小应可被 chrome.storage.local 接受', () => {
    seedStorage(20, 100);
    const raw = localStorage.getItem('xswitch_store') || '';
    const state = JSON.parse(raw);
    const jsoncSize = JSON.stringify(state[JSONC_CONFIG]).length;

    // chrome.storage.local 配额 5MB，单 key 过大时序列化/反序列化变慢
    // 记录实际大小供监控（超过 2MB 时 popup 打开会有明显延迟）
    expect(jsoncSize).toBeLessThan(5 * 1024 * 1024);
    // 输出实际大小便于观察趋势
    console.log(`[perf] JSONC_CONFIG size: ${(jsoncSize / 1024).toFixed(1)} KB (20 groups x 100 rules)`);
  });
});
