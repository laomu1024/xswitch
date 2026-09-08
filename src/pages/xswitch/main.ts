/**
 * XSwitch Popup - 原生 JS 实现（无 React/Antd 依赖）
 *
 * 性能优化：
 * 1. 移除 React 19 + Antd 6（原 bundle 612KB → 预计 <30KB）
 * 2. Monaco Editor 延迟加载（首屏不阻塞）
 * 3. 初始化 storage 读取改为并行 Promise.all
 * 4. saveConfig 增加防抖（300ms）
 */
import {
  MONACO_VS_PATH,
  LANGUAGE_JSON,
  FORMAT_DOCUMENT_CMD,
  ANYTHING,
  POPUP_HTML_PATH,
  HELP_URL,
  DEFAULT_DATA,
  DEFAULT_DUP_DATA,
  PLATFORM_MAC,
  KEY_CODE_S,
} from '../../constants';
import { Enabled } from '../../enums';
import {
  getConfig,
  saveConfig,
  setChecked as setCheckedStorage,
  getChecked,
  openLink,
  getEditingConfigKey,
  setEditingConfigKey,
  setConfigItems,
  getConfigItems,
  removeUnusedItems,
  exportAllConfigs,
  importConfigs,
  detectImportConflicts,
  getOptions,
  setOptions,
} from '../../chrome-storage';
import type { ExportConfigData } from '../../chrome-storage';
import { getEditorConfig } from '../../editor-config';

import './xswitch.css';

// ---- 状态 ----
interface ConfigItem {
  id: string;
  name: string;
  active: boolean;
}

let items: ConfigItem[] = [];
let editingKey = '0';
let checked = true;
let clearCacheEnabled = true;
let corsEnabled = true;
let editor: any = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

// ---- DOM 引用 ----
let tabsEl: HTMLUListElement;
let editorContainer: HTMLDivElement;
let toggleEl: HTMLButtonElement;
let newInput: HTMLInputElement;

// ---- 工具函数 ----
function $(sel: string, parent: Element | Document = document): Element | null {
  return parent.querySelector(sel);
}

function createEl<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs?: Record<string, string>,
  text?: string
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (attrs) {
    Object.entries(attrs).forEach(([k, v]) => {
      if (k === 'className') el.className = v;
      else el.setAttribute(k, v);
    });
  }
  if (text) el.textContent = text;
  return el;
}

// ---- 防抖保存 ----
function debouncedSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    if (editor) {
      saveConfig(editor.getValue(), editingKey);
    }
  }, 300);
}

// ---- 渲染规则列表 ----
function renderTabs() {
  tabsEl.innerHTML = '';
  const query = newInput.value.trim().toLocaleLowerCase();
  const visibleItems = items.filter((item) => item.name.toLocaleLowerCase().includes(query));
  if (!visibleItems.length) {
    const empty = createEl('li', { className: 'search-empty', role: 'status' }, 'No matches. Press Enter to add a rule.');
    tabsEl.appendChild(empty);
  }
  visibleItems.forEach((item) => {
    const li = createEl('li');
    li.id = item.id;
    li.draggable = item.id !== '0';
    if (item.id === editingKey) li.classList.add('editing');

    // checkbox
    const cb = createEl('input', { type: 'checkbox', className: 'tab-checkbox' }) as HTMLInputElement;
    cb.checked = item.active;
    cb.disabled = item.id === '0';
    cb.addEventListener('change', () => {
      const next = items.map((i) =>
        i.id === item.id ? { ...i, active: cb.checked } : i
      );
      items = next;
      setConfigItems(next);
    });
    cb.addEventListener('click', (e) => e.stopPropagation());
    li.appendChild(cb);

    // label
    const label = createEl('span', { className: 'label' }, `\u00a0${item.name}`);
    li.appendChild(label);

    // more icon (非 Current 项)
    if (item.id !== '0') {
      const more = createEl('span', { className: 'more-icon' }, '⋯');
      more.addEventListener('click', (e) => {
        e.stopPropagation();
        showItemMenu(item, more);
      });
      li.appendChild(more);
    }

    // 点击切换
    li.addEventListener('click', () => switchTab(item.id));

    // 拖拽
    li.addEventListener('dragstart', (ev) => {
      if (item.id === '0') { ev.preventDefault(); return; }
      (ev as DragEvent).dataTransfer!.setData('text/plain', item.id);
      (ev as DragEvent).dataTransfer!.effectAllowed = 'move';
      li.classList.add('dragging');
    });
    li.addEventListener('dragend', () => {
      li.classList.remove('dragging');
      clearDragIndicators();
    });
    li.addEventListener('dragover', (ev) => {
      ev.preventDefault();
      clearDragIndicators();
      const rect = li.getBoundingClientRect();
      const isTop = (ev as DragEvent).clientY - rect.top < rect.height / 2;
      if (item.id === '0') {
        li.classList.add('dragover-bottom');
      } else {
        li.classList.add(isTop ? 'dragover-top' : 'dragover-bottom');
      }
    });
    li.addEventListener('drop', (ev) => {
      ev.preventDefault();
      clearDragIndicators();
      const srcId = (ev as DragEvent).dataTransfer!.getData('text/plain');
      const rect = li.getBoundingClientRect();
      let position: 'top' | 'bottom' =
        (ev as DragEvent).clientY - rect.top < rect.height / 2 ? 'top' : 'bottom';
      if (item.id === '0') position = 'bottom';
      reorderItem(srcId, item.id, position);
    });

    tabsEl.appendChild(li);
  });
}

function clearDragIndicators() {
  tabsEl.querySelectorAll('.dragover-top,.dragover-bottom').forEach((el) => {
    el.classList.remove('dragover-top', 'dragover-bottom');
  });
}

function reorderItem(srcId: string, destId: string, position: 'top' | 'bottom') {
  if (srcId === '0' || srcId === destId) return;
  const srcIdx = items.findIndex((i) => i.id === srcId);
  if (srcIdx < 0 || items.findIndex((i) => i.id === destId) < 0) return;
  const next = [...items];
  const [moved] = next.splice(srcIdx, 1);
  let insertIdx = next.findIndex((i) => i.id === destId);
  if (position === 'bottom') insertIdx += 1;
  next.splice(insertIdx, 0, moved);
  items = next;
  setConfigItems(next);
  renderTabs();
}

// ---- 右键菜单（重命名/删除）----
function showItemMenu(item: ConfigItem, anchor: Element) {
  removeExistingMenu();
  const menu = createEl('div', { className: 'xs-dropdown-menu' });
  const rect = anchor.getBoundingClientRect();
  menu.style.top = `${rect.bottom + 2}px`;
  menu.style.left = `${rect.left - 60}px`;

  const renameBtn = createEl('div', { className: 'xs-menu-item' }, 'Rename');
  renameBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    removeExistingMenu();
    startRename(item);
  });

  const deleteBtn = createEl('div', { className: 'xs-menu-item xs-menu-danger' }, 'Delete');
  deleteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    removeExistingMenu();
    confirmDelete(item);
  });

  menu.appendChild(renameBtn);
  menu.appendChild(deleteBtn);
  document.body.appendChild(menu);

  setTimeout(() => {
    document.addEventListener('click', removeExistingMenu, { once: true });
  }, 0);
}

function removeExistingMenu() {
  document.querySelectorAll('.xs-dropdown-menu').forEach((el) => el.remove());
}

function startRename(item: ConfigItem) {
  const li = tabsEl.querySelector(`li[id="${item.id}"]`);
  if (!li) return;
  const label = li.querySelector('.label');
  if (!label) return;

  const input = createEl('input', { className: 'rename-input', type: 'text' }) as HTMLInputElement;
  input.value = item.name;
  label.replaceWith(input);
  input.focus();
  input.select();

  const commit = () => {
    const trimmed = input.value.trim();
    if (trimmed && trimmed !== item.name) {
      items = items.map((i) => (i.id === item.id ? { ...i, name: trimmed } : i));
      setConfigItems(items);
    }
    renderTabs();
  };

  input.addEventListener('blur', commit);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') commit();
    if (e.key === 'Escape') renderTabs();
    e.stopPropagation();
  });
  input.addEventListener('click', (e) => e.stopPropagation());
}

function confirmDelete(item: ConfigItem) {
  if (!confirm(`Are you sure to delete "${item.name}"?`)) return;
  const idx = items.findIndex((i) => i.id === item.id);
  if (idx < 0) return;
  items = items.filter((i) => i.id !== item.id);
  if (idx > 0 && items[idx - 1]) {
    switchTab(items[idx - 1].id);
  }
  setConfigItems(items);
  removeUnusedItems();
  renderTabs();
}

// ---- 切换规则组 ----
async function switchTab(id: string) {
  editingKey = id;
  setEditingConfigKey(id);
  const config = await getConfig(id);
  if (editor) {
    editor.setValue((config as string) || DEFAULT_DUP_DATA);
  }
  renderTabs();
}

// ---- 添加规则组 ----
async function addRule() {
  const name = newInput.value.trim();
  if (!name) return;
  const id = String(Date.now());
  items = [...items, { id, name, active: true }];
  setConfigItems(items);
  newInput.value = '';
  editingKey = id;
  setEditingConfigKey(id);
  const config = await getConfig(id);
  if (editor) {
    editor.setValue((config as string) || DEFAULT_DUP_DATA);
  }
  renderTabs();
  // 滚动到底部
  tabsEl.scrollTop = tabsEl.scrollHeight;
}

// ---- 工具栏 ----
function renderToolbar() {
  const toolbar = createEl('div', { className: 'toolbar-area' });

  // 开关
  toggleEl = createEl('button', {
    className: `xs-switch${checked ? ' xs-switch-checked' : ''}`,
    role: 'switch',
    'aria-checked': String(checked),
    title: checked ? 'Disable proxy' : 'Enable proxy',
  });
  const knob = createEl('span', { className: 'xs-switch-knob' });
  toggleEl.appendChild(knob);
  toggleEl.addEventListener('click', () => {
    checked = !checked;
    setCheckedStorage(checked);
    toggleEl.classList.toggle('xs-switch-checked', checked);
    toggleEl.setAttribute('aria-checked', String(checked));
    toggleEl.title = checked ? 'Disable proxy' : 'Enable proxy';
  });
  toolbar.appendChild(toggleEl);

  // 新窗口打开
  const newTabLink = createEl('a', { className: 'toolbar-action toolbar-newtab', title: 'Open in new tab', href: '#' });
  newTabLink.innerHTML = '&#60;/&#62;';
  newTabLink.addEventListener('click', (e) => {
    e.preventDefault();
    openLink(POPUP_HTML_PATH, true);
  });
  toolbar.appendChild(newTabLink);

  // 更多菜单
  const moreLink = createEl('a', { className: 'toolbar-action toolbar-more', title: 'More actions', href: '#' });
  moreLink.textContent = '⋯';
  moreLink.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    showMoreMenu(moreLink);
  });
  toolbar.appendChild(moreLink);

  // 隐藏的文件输入
  const fileInput = createEl('input', {
    type: 'file',
    accept: 'application/json,.json',
    className: 'import-file-input',
  }) as HTMLInputElement;
  fileInput.style.display = 'none';
  fileInput.addEventListener('change', handleImportFile);
  toolbar.appendChild(fileInput);

  document.body.appendChild(toolbar);
}

function showMoreMenu(anchor: Element) {
  removeExistingMenu();
  const menu = createEl('div', { className: 'xs-dropdown-menu xs-dropdown-right' });
  const rect = anchor.getBoundingClientRect();
  menu.style.top = `${rect.bottom + 4}px`;
  menu.style.right = `${window.innerWidth - rect.right}px`;

  const menuItems: Array<{ label: string; checked?: boolean; danger?: boolean; onClick: () => void }> = [
    {
      label: 'Enable Clear Cache',
      checked: clearCacheEnabled,
      onClick: () => {
        clearCacheEnabled = !clearCacheEnabled;
        setOptions({ clearCacheEnabled, corsEnabled });
        removeExistingMenu();
      },
    },
    {
      label: 'Enable CORS',
      checked: corsEnabled,
      onClick: () => {
        corsEnabled = !corsEnabled;
        setOptions({ clearCacheEnabled, corsEnabled });
        removeExistingMenu();
      },
    },
    { label: '---', onClick: () => {} },
    { label: 'Export config', onClick: () => { removeExistingMenu(); handleExport(); } },
    {
      label: 'Import config',
      onClick: () => {
        removeExistingMenu();
        (document.querySelector('.import-file-input') as HTMLInputElement)?.click();
      },
    },
    { label: '---', onClick: () => {} },
    { label: 'Help / Docs', onClick: () => { removeExistingMenu(); openLink(HELP_URL); } },
  ];

  menuItems.forEach(({ label, checked: isChecked, danger, onClick }) => {
    if (label === '---') {
      menu.appendChild(createEl('div', { className: 'xs-menu-divider' }));
      return;
    }
    const item = createEl('div', { className: `xs-menu-item${danger ? ' xs-menu-danger' : ''}` });
    if (isChecked !== undefined) {
      item.textContent = `${isChecked ? '✓ ' : '\u00a0\u00a0'}${label}`;
    } else {
      item.textContent = label;
    }
    item.addEventListener('click', onClick);
    menu.appendChild(item);
  });

  document.body.appendChild(menu);
  setTimeout(() => {
    document.addEventListener('click', removeExistingMenu, { once: true });
  }, 0);
}

// ---- 导出/导入 ----
async function handleExport() {
  try {
    const data = await exportAllConfigs();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = createEl('a') as HTMLAnchorElement;
    const ts = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').replace('Z', '');
    a.href = url;
    a.download = `xswitch-config-${ts}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Exported ${data.items.length} rule(s).`);
  } catch (e: any) {
    showToast(`Export failed: ${e?.message || e}`, true);
  }
}

async function handleImportFile(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text) as ExportConfigData;
    if (!data || !Array.isArray(data.items)) {
      showToast('Invalid config file format.', true);
      return;
    }
    const conflicts = await detectImportConflicts(data);
    if (conflicts.length === 0) {
      await performImport(data, 'overwrite');
    } else {
      showConflictModal(data, conflicts);
    }
  } catch (err: any) {
    showToast(`Import failed: ${err?.message || err}`, true);
  }
}

async function performImport(data: ExportConfigData, mode: 'overwrite' | 'rename') {
  try {
    const { items: nextItems, updated, added, renamed } = await importConfigs(data, mode);
    items = Array.from(nextItems as ConfigItem[]);
    const config = await getConfig(editingKey);
    if (editor) editor.setValue((config as string) || DEFAULT_DUP_DATA);
    renderTabs();
    const parts: string[] = [];
    if (added) parts.push(`${added} added`);
    if (updated) parts.push(`${updated} overwritten`);
    if (renamed) parts.push(`${renamed} renamed`);
    showToast(`Imported: ${parts.join(', ') || 'no change'}.`);
  } catch (err: any) {
    showToast(`Import failed: ${err?.message || err}`, true);
  }
}

function showConflictModal(data: ExportConfigData, conflicts: string[]) {
  const overlay = createEl('div', { className: 'xs-modal-overlay' });
  const modal = createEl('div', { className: 'xs-modal' });
  modal.innerHTML = `
    <h3>Duplicate names detected</h3>
    <p>The following ${conflicts.length} name(s) already exist:</p>
    <ul class="xs-conflict-list">${conflicts.map((n) => `<li>${n}</li>`).join('')}</ul>
    <p><strong>Overwrite</strong>: replace existing rules. <strong>Rename &amp; Import</strong>: append timestamp suffix.</p>
    <div class="xs-modal-actions">
      <button class="xs-btn" data-action="cancel">Cancel</button>
      <button class="xs-btn" data-action="rename">Rename &amp; Import</button>
      <button class="xs-btn xs-btn-danger" data-action="overwrite">Overwrite</button>
    </div>
  `;
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  modal.addEventListener('click', async (e) => {
    const action = (e.target as HTMLElement).dataset.action;
    if (!action) return;
    overlay.remove();
    if (action === 'cancel') return;
    await performImport(data, action as 'overwrite' | 'rename');
  });
}

// ---- Toast 提示 ----
function showToast(msg: string, isError = false) {
  const toast = createEl('div', { className: `xs-toast${isError ? ' xs-toast-error' : ''}` }, msg);
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('xs-toast-visible'), 10);
  setTimeout(() => {
    toast.classList.remove('xs-toast-visible');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ---- Monaco Editor 延迟加载 ----
// 注意：MV3 的 CSP 禁止 eval()，Monaco AMD loader (require/define) 内部依赖 eval，
// 因此不能使用 loader.js + require() 方式加载。
// 改用动态 <script> 标签直接加载（浏览器正常执行脚本，不受 CSP 限制）。
function loadMonacoEditor(config: string) {
  const vsPath = MONACO_VS_PATH;

  // 动态注入 Monaco CSS（不阻塞首屏）
  const cssLink = document.createElement('link');
  cssLink.rel = 'stylesheet';
  cssLink.href = `${vsPath}/editor/editor.main.css`;
  document.head.appendChild(cssLink);

  // 辅助函数：动态加载脚本（返回 Promise）
  function loadScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load: ${src}`));
      document.head.appendChild(script);
    });
  }

  // 顺序加载：loader.js(提供 define/require) → 配置路径 → nls → editor.main → json contribution → 初始化
  // 注意：所有脚本通过 <script> 标签加载（浏览器直接执行，CSP 合规），
  // 不使用 require() 动态加载 JS 模块（其内部 eval 被 CSP 拦截）。
  // 但 AMD 的 CSS 插件通过 <link> 标签加载样式，不涉及 eval，CSP 合规。
  loadScript(`${vsPath}/loader.js`)
    .then(() => {
      // 配置 AMD 路径映射，让 CSS 插件能找到样式文件
      (window as any).require.config({ paths: { vs: vsPath } });
      return loadScript(`${vsPath}/editor/editor.main.nls.js`);
    })
    .then(() => loadScript(`${vsPath}/editor/editor.main.js`))
    .then(() => loadScript(`${vsPath}/language/json/monaco.contribution.js`))
    .then(() => initEditor(config))
    .catch((err) => {
      console.error('[XSwitch] Monaco Editor load failed:', err);
      editorContainer.innerHTML = '<div class="editor-loading" style="color:red">Editor load failed. Check console.</div>';
    });
}

function initEditor(config: string) {
  const monaco = (window as any).monaco;
  // 清除 "Loading editor..." 占位符，否则 Monaco 编辑器会被挤到可视区域外
  editorContainer.innerHTML = '';
  editor = monaco.editor.create(editorContainer, getEditorConfig(config));

  // 初始保存
  saveConfig(editor.getValue(), editingKey);

  // 内容变化 → 防抖保存
  editor.onDidChangeModelContent(() => {
    debouncedSave();
  });

  // 首次滚动时格式化
  let formatted = false;
  editor.onDidScrollChange(() => {
    if (!formatted) {
      editor.trigger(ANYTHING, FORMAT_DOCUMENT_CMD);
      formatted = true;
    }
  });
}

// ---- 初始化 ----
async function init() {
  // 构建 DOM 骨架
  const wrapper = createEl('div', { className: 'xswitch-wrapper' });
  const leftArea = createEl('div', { className: 'xswitch-left-area' });
  tabsEl = createEl('ul', { className: 'xswitch-tabs' }) as HTMLUListElement;
  const newItemContainer = createEl('div', { className: 'xswitch-new-item-container' });
  newInput = createEl('input', {
    className: 'new-item',
    placeholder: 'Search or add',
    type: 'text',
    autocomplete: 'off',
  }) as HTMLInputElement;
  newInput.addEventListener('input', () => {
    renderTabs();
    tabsEl.scrollTop = 0;
  });
  newInput.addEventListener('keydown', (e) => {
    if (e.isComposing) return;
    if (e.key === 'Enter') addRule();
    if (e.key === 'Escape') {
      newInput.value = '';
      renderTabs();
    }
  });
  const addBtn = createEl('button', { className: 'confirm-button', title: 'Add rule' }, '✎');
  addBtn.addEventListener('click', addRule);
  newItemContainer.appendChild(newInput);
  newItemContainer.appendChild(addBtn);
  leftArea.appendChild(tabsEl);
  leftArea.appendChild(newItemContainer);

  editorContainer = createEl('div', { className: 'xswitch-container' }) as HTMLDivElement;
  // 编辑器加载占位
  editorContainer.innerHTML = '<div class="editor-loading">Loading editor...</div>';

  wrapper.appendChild(leftArea);
  wrapper.appendChild(editorContainer);
  document.getElementById('root')!.appendChild(wrapper);

  renderToolbar();

  // 并行读取所有初始状态（优化：原代码为串行 4 次 await）
  const [editingConfigKey, configItems, enabledState, opts] = await Promise.all([
    getEditingConfigKey(),
    getConfigItems(),
    getChecked(),
    getOptions(),
  ]);

  editingKey = editingConfigKey;
  items = Array.from(configItems as ConfigItem[]);
  checked = enabledState !== Enabled.NO;
  clearCacheEnabled = (opts as any).clearCacheEnabled !== Enabled.NO;
  corsEnabled = (opts as any).corsEnabled !== Enabled.NO;

  // 更新开关状态
  toggleEl.classList.toggle('xs-switch-checked', checked);
  toggleEl.setAttribute('aria-checked', String(checked));

  // 读取当前编辑的配置
  const currentConfig = await getConfig(editingKey);

  renderTabs();

  // 延迟加载 Monaco（首屏 UI 已渲染完毕）
  requestAnimationFrame(() => {
    loadMonacoEditor((currentConfig as string) || DEFAULT_DATA);
  });

  // 阻止 Ctrl/Cmd+S
  document.addEventListener('keydown', (e) => {
    const controlKeyDown = navigator.platform.match(PLATFORM_MAC) ? e.metaKey : e.ctrlKey;
    if (e.keyCode === KEY_CODE_S && controlKeyDown) {
      e.preventDefault();
    }
  });
}

// 启动
init();
