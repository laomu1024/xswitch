import {
  getAllConfigs,
  getActiveKeys,
  getChecked,
  getConfig,
  getConfigItems,
  getOptions,
  saveConfig,
  setConfigItems,
} from '../src/chrome-storage';
import { Enabled } from '../src/enums';
import { installXSwitchApi } from '../src/xswitch-api';

const groups = [
  { id: '0', name: 'Current', active: true },
  { id: 'a', name: 'local', active: false },
];

beforeEach(async () => {
  localStorage.clear();
  await setConfigItems(groups);
  await saveConfig('{ "proxy": [] }', '0');
  await saveConfig('{ "proxy": [ }', 'a');
});

test('list 返回分组名称、勾选状态与配置详情', async () => {
  const api = installXSwitchApi();
  expect((window as any).xswitch).toBe(api);

  const list = await api.list();
  expect(list.map((g) => [g.id, g.name, g.active])).toEqual([
    ['0', 'Current', true],
    ['a', 'local', false],
  ]);
  expect(list[0].config).toEqual({ proxy: [] });
  expect(list[0].error).toBe('');
  expect(list[1].config).toBeNull();
  expect(list[1].error).toContain('JSON 格式错误');
});

test('get 支持 id 与名称查询，未知分组返回 null', async () => {
  const api = installXSwitchApi();
  expect((await api.get('local'))!.id).toBe('a');
  expect((await api.get('0'))!.name).toBe('Current');
  expect(await api.get('missing')).toBeNull();
});

test('set 更新配置并同步页面状态', async () => {
  const changed: string[] = [];
  const api = installXSwitchApi({ onConfigChange: (id) => { changed.push(id); } });

  const group = await api.set('local', {
    proxy: [['https://a.com/(.*)', 'http://localhost:3000/$1']],
  });
  expect(group.id).toBe('a');
  expect(group.error).toBe('');
  expect(group.config).toEqual({
    proxy: [['https://a.com/(.*)', 'http://localhost:3000/$1']],
  });
  expect(changed).toEqual(['a']);
  expect(await getConfig('a')).toContain('https://a.com/(.*)');
});

test('set 接受 JSONC 字符串，非法配置拒绝写入', async () => {
  const api = installXSwitchApi();

  const group = await api.set('local', '{\n  // comment\n  "proxy": [],\n}');
  expect(group.config).toEqual({ proxy: [] });

  await expect(api.set('local', '{ "proxy": [ }')).rejects.toThrow('JSON 格式错误');
  await expect(api.set('missing', {})).rejects.toThrow('未找到配置分组：missing');
  expect(await getConfig('a')).toBe('{\n  // comment\n  "proxy": [],\n}');
});

test('add 新建分组，重名或配置非法时拒绝且不写入', async () => {
  const changed: Array<string | undefined> = [];
  const api = installXSwitchApi({
    onGroupsChange: (removedId) => { changed.push(removedId); },
  });

  const created = await api.add('mock', { cors: ['m.api.com'] });
  expect(created.name).toBe('mock');
  expect(created.active).toBe(true);
  expect(created.config).toEqual({ cors: ['m.api.com'] });
  expect((await api.list()).map((g) => g.name)).toEqual(['Current', 'local', 'mock']);
  expect(changed).toEqual([undefined]);

  const empty = await api.add('empty');
  expect(empty.config).toEqual({});

  const snapshot = JSON.stringify(localStorage.getItem('xswitch_store'));
  await expect(api.add('mock', {})).rejects.toThrow('分组已存在：mock');
  await expect(api.add('bad', '{ "proxy": [ }')).rejects.toThrow('JSON 格式错误');
  expect(JSON.stringify(localStorage.getItem('xswitch_store'))).toBe(snapshot);
  expect((await api.list()).length).toBe(4);
});

test('remove 删除分组并清理配置与生效项', async () => {
  const api = installXSwitchApi();
  await api.setActive('local', true);

  const removed = await api.remove('local');
  expect(removed.id).toBe('a');
  expect((await api.list()).map((g) => g.id)).toEqual(['0']);
  expect((await getAllConfigs()).a).toBeUndefined();
  expect(await getActiveKeys()).toEqual(['0']);
  await expect(api.remove('local')).rejects.toThrow('未找到配置分组：local');
});

test('setActive 勾选或取消勾选分组', async () => {
  const api = installXSwitchApi();

  const group = await api.setActive('local', true);
  expect(group.active).toBe(true);
  expect(await getActiveKeys()).toEqual(['0', 'a']);

  expect((await api.setActive('local', false)).active).toBe(false);
  expect(await getActiveKeys()).toEqual(['0']);
});

test('setState 按字段更新 getState 的全部字段', async () => {
  const changes: any[] = [];
  const api = installXSwitchApi({ onStateChange: (state) => { changes.push(state); } });

  const disabled = await api.setState({ enabled: false });
  expect(disabled).toEqual({ enabled: false, clearCacheEnabled: true, corsEnabled: true });
  expect(await getChecked()).toBe(Enabled.NO);

  const options = await api.setState({ corsEnabled: false });
  expect(options).toEqual({ enabled: false, clearCacheEnabled: true, corsEnabled: false });
  expect(await getOptions()).toEqual({
    clearCacheEnabled: Enabled.YES,
    corsEnabled: Enabled.NO,
  });
  expect(await api.getState()).toEqual(options);
  expect(changes.length).toBe(2);

  await expect(api.setState({ nope: true } as any)).rejects.toThrow('不支持的字段：nope');
  await expect(api.setState({ enabled: 'yes' } as any)).rejects.toThrow('enabled 必须是布尔值');
  await expect(api.setState(null as any)).rejects.toThrow('setState 需要传入对象');
});

test('list 不对未保存过的分组报错', async () => {
  localStorage.clear();
  await setConfigItems(groups);
  const api = installXSwitchApi();

  const list = await api.list();
  expect(list.map((g) => g.jsonc)).toEqual(['', '']);
  expect(list.map((g) => g.error)).toEqual(['', '']);
  expect(list.map((g) => g.config)).toEqual([null, null]);
  expect((await getConfigItems()).length).toBe(2);
});
