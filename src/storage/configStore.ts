import { promises as fs } from 'fs';
import path from 'path';

export type Category = {
  id: string;
  name: string;
  order: number;
};

export type Config = {
  categories: Category[];
  channelRegistry: Record<string, { categoryId: string; position?: number }>;
};

const CONFIG_PATH = path.resolve(process.cwd(), 'config.json');

async function ensureConfigFile(): Promise<void> {
  try {
    await fs.access(CONFIG_PATH);
  } catch {
    const empty: Config = { categories: [], channelRegistry: {} };
    await fs.writeFile(CONFIG_PATH, JSON.stringify(empty, null, 2), 'utf8');
  }
}

export async function readConfig(): Promise<Config> {
  await ensureConfigFile();
  const raw = await fs.readFile(CONFIG_PATH, 'utf8');
  return JSON.parse(raw) as Config;
}

export async function writeConfig(config: Config): Promise<void> {
  await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
}

export async function addCategory(category: Category): Promise<void> {
  const config = await readConfig();
  config.categories.push(category);
  config.categories.sort((a, b) => a.order - b.order);
  await writeConfig(config);
}

export async function removeCategory(categoryId: string): Promise<void> {
  const config = await readConfig();
  config.categories = config.categories
    .filter((c) => c.id !== categoryId)
    .sort((a, b) => a.order - b.order)
    .map((c, idx) => ({ ...c, order: idx + 1 }));
  for (const [channelId, entry] of Object.entries(config.channelRegistry)) {
    if (entry.categoryId === categoryId) {
      delete config.channelRegistry[channelId];
    }
  }
  await writeConfig(config);
}

export async function registerChannel(channelId: string, categoryId: string): Promise<void> {
  const config = await readConfig();
  const existingInCategory = Object.entries(config.channelRegistry)
    .filter(([, entry]) => entry.categoryId === categoryId)
    .sort(([, a], [, b]) => (a.position ?? 0) - (b.position ?? 0));
  const nextPosition = existingInCategory.length + 1;
  config.channelRegistry[channelId] = { categoryId, position: nextPosition };
  await writeConfig(config);
}

export async function unregisterChannel(channelId: string): Promise<void> {
  const config = await readConfig();
  const entry = config.channelRegistry[channelId];
  delete config.channelRegistry[channelId];
  if (entry) {
    const channels = getChannelsByCategory(config, entry.categoryId);
    channels.forEach((id, idx) => {
      if (config.channelRegistry[id]) {
        config.channelRegistry[id].position = idx + 1;
      }
    });
  }
  await writeConfig(config);
}

export async function reorderCategory(categoryId: string, newIndex: number): Promise<void> {
  const config = await readConfig();
  const categories = [...config.categories].sort((a, b) => a.order - b.order);
  const currentIndex = categories.findIndex((c) => c.id === categoryId);
  if (currentIndex === -1) return;
  const [moved] = categories.splice(currentIndex, 1);
  categories.splice(newIndex, 0, moved);
  config.categories = categories.map((c, idx) => ({ ...c, order: idx + 1 }));
  await writeConfig(config);
}

export async function insertCategoryAt(category: Category, index: number): Promise<void> {
  const config = await readConfig();
  const categories = [...config.categories].sort((a, b) => a.order - b.order);
  const insertIndex = Math.max(0, Math.min(index, categories.length));
  categories.splice(insertIndex, 0, category);
  config.categories = categories.map((c, idx) => ({ ...c, order: idx + 1 }));
  await writeConfig(config);
}

export function getChannelsByCategory(config: Config, categoryId: string): string[] {
  return Object.entries(config.channelRegistry)
    .filter(([, entry]) => entry.categoryId === categoryId)
    .sort(([, a], [, b]) => (a.position ?? 0) - (b.position ?? 0))
    .map(([channelId]) => channelId);
}

export async function reorderChannels(categoryId: string, channelId: string, targetIndex: number): Promise<void> {
  const config = await readConfig();
  const channels = getChannelsByCategory(config, categoryId);
  const fromIndex = channels.indexOf(channelId);
  if (fromIndex === -1 || targetIndex < 0 || targetIndex >= channels.length) return;
  channels.splice(targetIndex, 0, channels.splice(fromIndex, 1)[0]);
  channels.forEach((id, idx) => {
    const entry = config.channelRegistry[id];
    if (entry) entry.position = idx + 1;
  });
  await writeConfig(config);
}
