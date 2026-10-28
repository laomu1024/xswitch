export function getDisplayItems<T extends { id: string; pinnedAt?: number }>(items: T[]): T[] {
  return items.slice().sort((a, b) => (b.pinnedAt || 0) - (a.pinnedAt || 0));
}
