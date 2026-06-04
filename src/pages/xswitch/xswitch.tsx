import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Switch, Checkbox, Input, Dropdown, Modal, message } from 'antd';
import type { InputRef } from 'antd';
import type { MenuProps } from 'antd';
import {
  EditTwoTone,
  QuestionCircleTwoTone,
  CodeTwoTone,
  MoreOutlined,
} from '@ant-design/icons';
import type { CheckboxChangeEvent } from 'antd/es/checkbox';

import './xswitch.less';

import {
  ANYTHING,
  FORMAT_DOCUMENT_CMD,
  KEY_CODE_S,
  KEY_DOWN,
  LANGUAGE_JSON,
  MONACO_CONTRIBUTION_PATH,
  MONACO_VS_PATH,
  PLATFORM_MAC,
  RULE,
  RULE_COMPLETION,
  POPUP_HTML_PATH,
  HELP_URL,
  DEFAULT_DUP_DATA,
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
} from '../../chrome-storage';
import { getEditorConfig } from '../../editor-config';

interface ConfigItem {
  id: string;
  name: string;
  active: boolean;
}

let editor: any;

export default function XSwitch() {
  const [checked, setChecked] = useState(true);
  const [editingKey, setEditingKey] = useState('0');
  const [draggingKey, setDraggingKey] = useState('');
  const [dragoverKey, setDragoverKey] = useState('');
  const [dragoverPosition, setDragoverPosition] = useState<'top' | 'bottom'>(
    'bottom'
  );
  const [newItem, setNewItem] = useState('');
  const [items, setItems] = useState<ConfigItem[]>([]);
  const [renamingKey, setRenamingKey] = useState('');
  const [renameValue, setRenameValue] = useState('');
  const renameInputRef = useRef<InputRef>(null);

  const tabsRef = useRef<HTMLUListElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const editingKeyRef = useRef(editingKey);
  editingKeyRef.current = editingKey;

  const setEditorValue = useCallback((value: string) => {
    editor?.setValue(value);
  }, []);

  const setEditingKeyHandler = useCallback(
    async (id: string) => {
      setEditingKey(id);
      const config = await getConfig(id);
      setEditorValue((config as string) || DEFAULT_DUP_DATA);
      setEditingConfigKey(id);
    },
    [setEditorValue]
  );

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const enabled = (await getChecked()) !== Enabled.NO;
      if (!cancelled) {
        setChecked(enabled);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let monacoReady = true;

    (async () => {
      const editingConfigKey = await getEditingConfigKey();
      const config = await getConfig(editingConfigKey);
      const configItems = await getConfigItems();
      await removeUnusedItems();

      if (cancelled) {
        return;
      }

      setEditingKey(editingConfigKey);
      setItems(Array.from(configItems as ConfigItem[]));

      window.require.config({ paths: { vs: MONACO_VS_PATH } });
      window.require([MONACO_CONTRIBUTION_PATH], () => {
        if (cancelled || !shellRef.current) {
          return;
        }

        editor = window.monaco.editor.create(
          shellRef.current,
          getEditorConfig(config as string)
        );

        saveConfig(editor.getValue(), editingConfigKey);

        window.monaco.languages.registerCompletionItemProvider(LANGUAGE_JSON, {
          provideCompletionItems: () => {
            const textArr: { label: string; kind: number }[] = [];
            chrome.extension
              .getBackgroundPage()
              ?._forward.urls.forEach((item: string) => {
                if (item) {
                  textArr.push({
                    label: item,
                    kind: window.monaco.languages.CompletionItemKind.Text,
                  });
                }
              });

            const extraItems = [
              {
                label: RULE,
                kind: window.monaco.languages.CompletionItemKind.Method,
                insertText: {
                  value: RULE_COMPLETION,
                },
              },
            ];
            return [...textArr, ...extraItems];
          },
        });

        editor.onDidChangeModelContent(() => {
          saveConfig(editor!.getValue(), editingKeyRef.current);
        });

        editor.onDidScrollChange(() => {
          if (monacoReady) {
            editor!.trigger(ANYTHING, FORMAT_DOCUMENT_CMD);
            monacoReady = false;
          }
        });
      });
    })();

    const preventSave = (e: KeyboardEvent) => {
      const controlKeyDown = navigator.platform.match(PLATFORM_MAC)
        ? e.metaKey
        : e.ctrlKey;
      if (e.keyCode === KEY_CODE_S && controlKeyDown) {
        e.preventDefault();
      }
    };

    document.addEventListener(KEY_DOWN, preventSave, false);

    return () => {
      cancelled = true;
      document.removeEventListener(KEY_DOWN, preventSave, false);
      editor?.dispose();
      editor = undefined;
    };
  }, [setEditorValue]);

  const toggleButton = (value: boolean) => {
    setChecked(value);
    setCheckedStorage(value);
  };

  const openNewTab = () => {
    openLink(POPUP_HTML_PATH, true);
  };

  const openReadme = () => {
    openLink(HELP_URL);
  };

  const dragStart = (ev: React.DragEvent<HTMLLIElement>) => {
    if (ev.currentTarget.id === '0') {
      ev.preventDefault();
      return;
    }
    ev.dataTransfer.setData('application/my-app', ev.currentTarget.id);
    ev.dataTransfer.effectAllowed = 'move';
    setDraggingKey(ev.currentTarget.id);
  };

  const dragOver = (ev: React.DragEvent<HTMLLIElement>) => {
    ev.preventDefault();
    const li = (ev.target as HTMLElement).closest('li');
    if (li?.id) {
      const rect = li.getBoundingClientRect();
      let isTop = ev.clientY - rect.top < rect.height / 2;
      // Default "Current" item must always stay at top:
      // never allow inserting another item above it.
      if (li.id === '0') {
        isTop = false;
      }
      setDragoverKey(li.id);
      setDragoverPosition(isTop ? 'top' : 'bottom');
    }
    ev.dataTransfer.dropEffect = 'move';
  };

  const dragEnd = () => {
    setDraggingKey('');
    setDragoverKey('');
  };

  const drop = (ev: React.DragEvent<HTMLLIElement>) => {
    ev.preventDefault();
    const srcId = ev.dataTransfer.getData('application/my-app');
    const targetLi = (ev.target as HTMLElement).closest('li');
    const targetId = targetLi?.id;
    let position: 'top' | 'bottom' = dragoverPosition;
    if (targetLi) {
      const rect = targetLi.getBoundingClientRect();
      position = ev.clientY - rect.top < rect.height / 2 ? 'top' : 'bottom';
    }
    // Default "Current" item must always stay at top.
    if (targetId === '0') {
      position = 'bottom';
    }
    setDraggingKey('');
    setDragoverKey('');
    if (srcId && targetId) {
      reorderItem(srcId, targetId, position);
    }
  };

  const reorderItem = (
    srcItemId: string,
    destItemId: string,
    position: 'top' | 'bottom'
  ) => {
    // Default "Current" item is pinned at the top.
    if (srcItemId === '0') {
      return;
    }
    if (srcItemId === destItemId) {
      return;
    }
    const srcIdx = items.findIndex((i) => i.id === srcItemId);
    if (srcIdx < 0 || items.findIndex((i) => i.id === destItemId) < 0) {
      return;
    }
    const next = [...items];
    const [moved] = next.splice(srcIdx, 1);
    let insertIdx = next.findIndex((i) => i.id === destItemId);
    if (insertIdx < 0) {
      return;
    }
    if (position === 'bottom') {
      insertIdx += 1;
    }
    next.splice(insertIdx, 0, moved);
    setItems(next);
    setConfigItems(next);
  };

  const onTabClick = async (item: ConfigItem) => {
    await setEditingKeyHandler(item.id);
  };

  const setActive = (item: ConfigItem, e: CheckboxChangeEvent) => {
    const next = items.map((i) =>
      i.id === item.id ? { ...i, active: e.target.checked } : i
    );
    setItems(next);
    setConfigItems(next);
  };

  const add = async () => {
    if (newItem.trim() === '') {
      message.error('Rule name should not be an empty string!');
      return;
    }
    const id = String(Date.now());
    const next = [
      ...items,
      {
        id,
        name: newItem,
        active: true,
      },
    ];
    setItems(next);
    setConfigItems(next);
    setEditingKey(id);
    setEditingConfigKey(id);
    await setEditingKeyHandler(id);
    setTimeout(() => {
      if (tabsRef.current) {
        tabsRef.current.scrollTop = tabsRef.current.scrollHeight;
      }
    }, 0);
    setNewItem('');
  };

  const remove = async (item: ConfigItem, ev?: React.MouseEvent) => {
    ev?.stopPropagation();
    const i = items.findIndex((it) => it.id === item.id);
    if (i < 0) {
      return;
    }
    const next = items.filter((it) => it.id !== item.id);
    setItems(next);
    if (i > 0 && next[i - 1]) {
      await setEditingKeyHandler(next[i - 1].id);
    }
    await setConfigItems(next);
    removeUnusedItems();
  };

  const startRename = (item: ConfigItem) => {
    setRenamingKey(item.id);
    setRenameValue(item.name);
    setTimeout(() => {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }, 0);
  };

  const cancelRename = () => {
    setRenamingKey('');
    setRenameValue('');
  };

  const commitRename = (item: ConfigItem) => {
    const trimmed = renameValue.trim();
    if (trimmed === '') {
      message.error('Rule name should not be an empty string!');
      return;
    }
    if (trimmed === item.name) {
      cancelRename();
      return;
    }
    const next = items.map((i) =>
      i.id === item.id ? { ...i, name: trimmed } : i
    );
    setItems(next);
    setConfigItems(next);
    cancelRename();
  };

  const confirmDelete = (item: ConfigItem) => {
    Modal.confirm({
      title: 'Are you sure to delete?',
      content: item.name,
      okText: 'Delete',
      okButtonProps: { danger: true },
      cancelText: 'Cancel',
      onOk: () => remove(item),
    });
  };

  const getMenuItems = (item: ConfigItem): MenuProps['items'] => [
    {
      key: 'rename',
      label: 'Rename',
      onClick: ({ domEvent }) => {
        domEvent.stopPropagation();
        startRename(item);
      },
    },
    {
      key: 'delete',
      label: 'Delete',
      danger: true,
      onClick: ({ domEvent }) => {
        domEvent.stopPropagation();
        confirmDelete(item);
      },
    },
  ];

  return (
    <>
      <div className="xswitch-wrapper">
        <div className="xswitch-left-area">
          <ul className="xswitch-tabs" ref={tabsRef}>
            {items.map((item) => (
              <li
                key={item.id}
                id={item.id}
                className={[
                  item.id === editingKey ? 'editing' : '',
                  item.id === draggingKey ? 'dragging' : '',
                  item.id === dragoverKey && item.id !== draggingKey
                    ? `dragover-${dragoverPosition}`
                    : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                draggable={item.id !== '0'}
                onClick={() => onTabClick(item)}
                onDragStart={dragStart}
                onDragOver={dragOver}
                onDragEnd={dragEnd}
                onDrop={drop}
              >
                <Checkbox
                  checked={item.active}
                  onChange={(e) => setActive(item, e)}
                  disabled={item.id === '0'}
                  onClick={(e) => e.stopPropagation()}
                />
                {item.id === renamingKey ? (
                  <Input
                    ref={renameInputRef}
                    size="small"
                    className="rename-input"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onPressEnter={() => commitRename(item)}
                    onBlur={() => commitRename(item)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        cancelRename();
                      }
                    }}
                  />
                ) : (
                  <span className="label">&nbsp;{item.name}</span>
                )}
                {item.id !== '0' && item.id !== renamingKey && (
                  <Dropdown
                    menu={{ items: getMenuItems(item) }}
                    trigger={['click']}
                    placement="bottomRight"
                  >
                    <MoreOutlined
                      className="more-icon"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </Dropdown>
                )}
              </li>
            ))}
          </ul>
          <div className="xswitch-new-item-container">
            <Input
              size="small"
              autoComplete="off"
              placeholder="Add a rule"
              className="new-item"
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              onPressEnter={add}
            />
            <EditTwoTone className="confirm-button" onClick={add} />
          </div>
        </div>
        <div className="xswitch-container" ref={shellRef} />
      </div>
      <div className="toolbar-area">
        <Switch
          checked={checked}
          onChange={toggleButton}
          className="xswitch-toggle"
          title={checked ? 'Disable proxy' : 'Enable proxy'}
        />
        <a
          className="open-readme"
          title="Open help page"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            openReadme();
          }}
        >
          <QuestionCircleTwoTone style={{ fontSize: 22 }} />
        </a>
        <a
          className="new-tab-control"
          title="Open in new tab"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            openNewTab();
          }}
        >
          <CodeTwoTone style={{ fontSize: 22 }} />
        </a>
      </div>
    </>
  );
}
