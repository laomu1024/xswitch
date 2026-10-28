import {
  getAllConfigs,
  getChecked,
  getConfigItems,
  getOptions,
  removeUnusedItems,
  saveConfig,
  setChecked,
  setConfigItems,
  setOptions,
} from './chrome-storage';
import { Enabled } from './enums';
import { JSONC2JSON, JSON_Parse, getConfigError } from './utils';

export interface XSwitchGroup {
  /** 分组 id，稳定标识，重命名后不变 */
  id: string;
  /** 分组名称 */
  name: string;
  /** 分组是否勾选，参与规则合并 */
  active: boolean;
  /** 置顶时间戳，未置顶为 0 */
  pinnedAt: number;
  /** 原始 JSONC 文本，未保存过的分组为空字符串 */
  jsonc: string;
  /** 解析后的配置对象，格式非法或未保存时为 null */
  config: Record<string, any> | null;
  /** JSON 格式错误信息，合法时为空字符串 */
  error: string;
}

export interface XSwitchState {
  /** 扩展总开关，关闭时所有规则都不生效 */
  enabled: boolean;
  /** 是否启用清除缓存 */
  clearCacheEnabled: boolean;
  /** 是否启用 CORS 代理 */
  corsEnabled: boolean;
}

export interface XSwitchApiHooks {
  /** 分组配置更新后触发，用于同步弹窗内的编辑器与错误标记 */
  onConfigChange?: (id: string) => void | Promise<void>;
  /** 分组列表变化后触发；removedId 表示刚从列表中删除的分组 */
  onGroupsChange?: (removedId?: string) => void | Promise<void>;
  /** 总开关或选项状态变化后触发 */
  onStateChange?: (state: XSwitchState) => void | Promise<void>;
}

export interface XSwitchApi {
  /** 列出全部分组及其配置详情 */
  list(): Promise<XSwitchGroup[]>;
  /** 按 id 或名称查询单个分组，找不到返回 null */
  get(nameOrId: string): Promise<XSwitchGroup | null>;
  /** 新建分组，config 支持 JSON 对象或 JSONC 字符串，名称重复时报错 */
  add(name: string, config?: string | Record<string, any>): Promise<XSwitchGroup>;
  /** 按 id 或名称更新分组配置，config 支持 JSON 对象或 JSONC 字符串 */
  set(nameOrId: string, config: string | Record<string, any>): Promise<XSwitchGroup>;
  /** 按 id 或名称删除分组，返回被删除的分组信息 */
  remove(nameOrId: string): Promise<XSwitchGroup>;
  /** 按 id 或名称勾选/取消勾选分组 */
  setActive(nameOrId: string, active: boolean): Promise<XSwitchGroup>;
  /** 读取扩展总开关与选项状态 */
  getState(): Promise<XSwitchState>;
  /** 按字段更新总开关与选项，未传入的字段保持不变 */
  setState(state: Partial<XSwitchState>): Promise<XSwitchState>;
}

function parseGroupConfig(jsonc: string): {
  config: Record<string, any> | null;
  error: string;
} {
  // 未保存过的分组不算错误，避免新装环境误报
  if (!jsonc) {
    return { config: null, error: '' };
  }
  const error = getConfigError(jsonc);
  if (error) {
    return { config: null, error };
  }
  let parsed: any = null;
  JSON_Parse(JSONC2JSON(jsonc), (_error, json) => {
    parsed = json;
  });
  return { config: parsed, error: '' };
}

function toGroup(item: any, jsonc: string): XSwitchGroup {
  const { config, error } = parseGroupConfig(jsonc);
  return {
    id: item.id,
    name: item.name,
    active: !!item.active,
    pinnedAt: item.pinnedAt || 0,
    jsonc,
    config,
    error,
  };
}

function toList(items: any): any[] {
  return Array.isArray(items) ? items : [];
}

function findIndexByNameOrId(items: any[], nameOrId: string): number {
  const byId = items.findIndex((item) => item.id === nameOrId);
  return byId >= 0 ? byId : items.findIndex((item) => item.name === nameOrId);
}

function requireIndex(items: any[], nameOrId: string): number {
  const index = findIndexByNameOrId(items, nameOrId);
  if (index < 0) {
    throw new Error(`未找到配置分组：${nameOrId}`);
  }
  return index;
}

/** 把对象或 JSONC 文本转成校验通过的 JSONC，校验失败直接抛错，不产生写入 */
function toJsonc(config: string | Record<string, any>): string {
  const jsonc = typeof config === 'string' ? config : JSON.stringify(config, null, 2);
  if (typeof jsonc !== 'string') {
    throw new Error('配置必须是 JSON 对象');
  }
  const error = getConfigError(jsonc);
  if (error) {
    throw new Error(error);
  }
  return jsonc;
}

/** 生成不与现有分组冲突的 id，与手动添加规则时的格式保持一致 */
function createGroupId(items: any[]): string {
  const used = new Set(items.map((item) => item.id));
  const base = String(Date.now());
  let id = base;
  let suffix = 1;
  while (used.has(id)) {
    id = `${base}_${suffix++}`;
  }
  return id;
}

async function readGroup(item: any): Promise<XSwitchGroup> {
  const configs = await getAllConfigs();
  const jsonc = typeof configs[item.id] === 'string' ? configs[item.id] : '';
  return toGroup(item, jsonc);
}

function getState(): Promise<XSwitchState> {
  return Promise.all([getChecked(), getOptions()]).then(([disabled, opts]) => ({
    enabled: disabled !== Enabled.NO,
    clearCacheEnabled: (opts as any).clearCacheEnabled !== Enabled.NO,
    corsEnabled: (opts as any).corsEnabled !== Enabled.NO,
  }));
}

const STATE_KEYS: Array<keyof XSwitchState> = ['enabled', 'clearCacheEnabled', 'corsEnabled'];

/** 校验 setState 入参，未知字段或非布尔值直接抛错，避免拼错字段被静默忽略 */
function normalizeStatePatch(state: Partial<XSwitchState>): Partial<XSwitchState> {
  if (!state || typeof state !== 'object' || Array.isArray(state)) {
    throw new Error('setState 需要传入对象，例如 { enabled: false }');
  }
  Object.keys(state).forEach((key) => {
    if (!STATE_KEYS.includes(key as keyof XSwitchState)) {
      throw new Error(`不支持的字段：${key}`);
    }
    if (typeof (state as any)[key] !== 'boolean') {
      throw new Error(`${key} 必须是布尔值`);
    }
  });
  return state;
}

export function installXSwitchApi(hooks: XSwitchApiHooks = {}): XSwitchApi {
  const api: XSwitchApi = {
    async list() {
      const [items, configs] = await Promise.all([getConfigItems(), getAllConfigs()]);
      return toList(items).map((item) => {
        const jsonc = typeof configs[item.id] === 'string' ? configs[item.id] : '';
        return toGroup(item, jsonc);
      });
    },

    async get(nameOrId: string) {
      const items = toList(await getConfigItems());
      const index = findIndexByNameOrId(items, nameOrId);
      return index < 0 ? null : readGroup(items[index]);
    },

    async add(name: string, config: string | Record<string, any> = {}) {
      const trimmed = typeof name === 'string' ? name.trim() : '';
      if (!trimmed) {
        throw new Error('分组名称不能为空');
      }
      const items = toList(await getConfigItems());
      if (items.some((item) => item.name === trimmed)) {
        throw new Error(`分组已存在：${trimmed}`);
      }
      const jsonc = toJsonc(config);
      const id = createGroupId(items);
      const item = { id, name: trimmed, active: true };
      await saveConfig(jsonc, id);
      await setConfigItems([...items, item]);
      await hooks.onGroupsChange?.();
      return readGroup(item);
    },

    async set(nameOrId: string, config: string | Record<string, any>) {
      const items = toList(await getConfigItems());
      const index = requireIndex(items, nameOrId);
      const item = items[index];
      const jsonc = toJsonc(config);
      await saveConfig(jsonc, item.id);
      await hooks.onConfigChange?.(item.id);
      return readGroup(item);
    },

    async remove(nameOrId: string) {
      const items = toList(await getConfigItems());
      const index = requireIndex(items, nameOrId);
      const removed = await readGroup(items[index]);
      await setConfigItems(items.filter((_item, i) => i !== index));
      await removeUnusedItems();
      await hooks.onGroupsChange?.(removed.id);
      return removed;
    },

    async setActive(nameOrId: string, active: boolean) {
      const items = toList(await getConfigItems());
      const index = requireIndex(items, nameOrId);
      const next = items.map((item, i) =>
        i === index ? { ...item, active: !!active } : item
      );
      await setConfigItems(next);
      await hooks.onGroupsChange?.();
      return readGroup(next[index]);
    },

    getState,

    async setState(state: Partial<XSwitchState>) {
      const patch = normalizeStatePatch(state);
      const current = await getState();
      const next: XSwitchState = {
        enabled: patch.enabled === undefined ? current.enabled : patch.enabled,
        clearCacheEnabled:
          patch.clearCacheEnabled === undefined
            ? current.clearCacheEnabled
            : patch.clearCacheEnabled,
        corsEnabled:
          patch.corsEnabled === undefined ? current.corsEnabled : patch.corsEnabled,
      };
      if (patch.enabled !== undefined) {
        await setChecked(next.enabled);
      }
      if (patch.clearCacheEnabled !== undefined || patch.corsEnabled !== undefined) {
        await setOptions({
          clearCacheEnabled: next.clearCacheEnabled,
          corsEnabled: next.corsEnabled,
        });
      }
      if (Object.keys(patch).length) {
        await hooks.onStateChange?.(next);
      }
      return next;
    },
  };

  (window as any).xswitch = api;
  return api;
}
