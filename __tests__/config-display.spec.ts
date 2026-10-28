import { getDisplayItems } from '../src/config-display';

test('pins are displayed first in newest-first order without mutating execution order', () => {
  const items = [
    { id: '0' }, { id: 'a' }, { id: 'b', pinnedAt: 10 },
    { id: 'c' }, { id: 'd', pinnedAt: 20 },
  ];
  expect(getDisplayItems(items).map((item) => item.id)).toEqual(['d', 'b', '0', 'a', 'c']);
  expect(items.map((item) => item.id)).toEqual(['0', 'a', 'b', 'c', 'd']);
  const unpinned = items.map((item) => item.id === 'b' ? { ...item, pinnedAt: 0 } : item);
  expect(getDisplayItems(unpinned).map((item) => item.id)).toEqual(['d', '0', 'a', 'b', 'c']);
});
