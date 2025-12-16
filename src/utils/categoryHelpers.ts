import type { Category, Config } from '../storage/configStore.js';
import { readConfig } from '../storage/configStore.js';

export function findCategoryByInput(config: Config, input: string): Category | undefined {
  const trimmed = input.trim();
  const normalized = trimmed.toLowerCase();
  return (
    config.categories.find((c) => c.id === trimmed) ??
    config.categories.find((c) => c.name.toLowerCase() === normalized)
  );
}

export async function getSortedCategories(): Promise<Category[]> {
  const config = await readConfig();
  return [...config.categories].sort((a, b) => a.order - b.order);
}
