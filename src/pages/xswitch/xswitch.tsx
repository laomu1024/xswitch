import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Switch, Checkbox, Input, Popconfirm, message } from 'antd';
import {
  DeleteOutlined,
  EditTwoTone,
  QuestionCircleTwoTone,
  CodeTwoTone,
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
  const [dragoverKey, setDragoverKey] = useState('');
  const [newItem, setNewItem] = useState('');
  const [items, setItems] = useState<ConfigItem[]>([]);

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
    ev.dataTransfer.setData('application/my-app', ev.currentTarget.id);
    ev.dataTransfer.effectAllowed = 'move';
  };

  const dragOver = (ev: React.DragEvent<HTMLLIElement>) => {
    ev.preventDefault();
    const li = (ev.target as HTMLElement).closest('li');
    if (li?.id) {
      setDragoverKey(li.id);
    }
    ev.dataTransfer.dropEffect = 'move';
  };

  const drop = (ev: React.DragEvent<HTMLLIElement>) => {
    ev.preventDefault();
    const id = ev.dataTransfer.getData('application/my-app');
    const targetId = (ev.target as HTMLElement).closest('li')?.id;
    setDragoverKey('');
    if (targetId) {
      swapItem(id, targetId);
    }
  };

  const swapItem = (srcItemId: string, destItemId: string) => {
    let srcItemIdx = -1;
    let destItemIdx = -1;
    let srcItem: ConfigItem | undefined;
    let destItem: ConfigItem | undefined;

    items.forEach((item, idx) => {
      if (item.id === srcItemId) {
        srcItemIdx = idx;
        srcItem = item;
      }
      if (item.id === destItemId) {
        destItemIdx = idx;
        destItem = item;
      }
    });

    if (!srcItem || !destItem || srcItemIdx < 0 || destItemIdx < 0) {
      console.warn('srcItem or destItem is undefined, swap aborted.');
      return;
    }

    const next = [...items];
    next[srcItemIdx] = destItem;
    next[destItemIdx] = srcItem;
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
    const i = items.indexOf(item);
    if (i < 0) {
      return;
    }
    const next = items.filter((_, idx) => idx !== i);
    setItems(next);
    if (i > 0 && next[i - 1]) {
      await setEditingKeyHandler(next[i - 1].id);
    }
    setConfigItems(next);
  };

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
                  item.id === dragoverKey ? 'dragovering' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                draggable
                onClick={() => onTabClick(item)}
                onDragStart={dragStart}
                onDragOver={dragOver}
                onDrop={drop}
              >
                <Checkbox
                  checked={item.active}
                  onChange={(e) => setActive(item, e)}
                  disabled={item.id === '0'}
                  onClick={(e) => e.stopPropagation()}
                />
                <span className="label">&nbsp;{item.name}</span>
                <Popconfirm
                  title="Are you sure to delete?"
                  onConfirm={() => remove(item)}
                >
                  <DeleteOutlined
                    className="delete-icon"
                    style={{ color: '#f5222d' }}
                    onClick={(e) => e.stopPropagation()}
                  />
                </Popconfirm>
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
