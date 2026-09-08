import { getDisplayItems } from '../src/config-display';

test('pins follow Current in newest-first order without mutating execution order', () => {
  const items = [
    { id: '0' }, { id: 'a' }, { id: 'b', pinnedAt: 10 },
    { id: 'c' }, { id: 'd', pinnedAt: 20 },
  ];
  expect(getDisplayItems(items).map((item) => item.id)).toEqual(['0', 'd', 'b', 'a', 'c']);
  expect(items.map((item) => item.id)).toEqual(['0', 'a', 'b', 'c', 'd']);
  const unpinned = items.map((item) => item.id === 'b' ? { ...item, pinnedAt: 0 } : item);
  expect(getDisplayItems(unpinned).map((item) => item.id)).toEqual(['0', 'd', 'a', 'b', 'c']);
});
