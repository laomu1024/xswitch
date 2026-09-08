export function getDisplayItems<T extends { id: string; pinnedAt?: number }>(items: T[]): T[] {
  return items.slice().sort((a, b) => {
    if (a.id === '0') return b.id === '0' ? 0 : -1;
    if (b.id === '0') return 1;
    return (b.pinnedAt || 0) - (a.pinnedAt || 0);
  });
}
