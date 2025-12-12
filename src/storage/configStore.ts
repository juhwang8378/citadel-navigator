import { promises as fs } from 'fs';
import path from 'path';

export type Category = {
  id: string;
  name: string;
  order: number;
};

export type Config = {
  categories: Category[];
  channelRegistry: Record<string, { categoryId: string }>;
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
  config.categories = config.categories.filter((c) => c.id !== categoryId);
  for (const [channelId, entry] of Object.entries(config.channelRegistry)) {
    if (entry.categoryId === categoryId) {
      delete config.channelRegistry[channelId];
    }
  }
  await writeConfig(config);
}

export async function registerChannel(channelId: string, categoryId: string): Promise<void> {
  const config = await readConfig();
  config.channelRegistry[channelId] = { categoryId };
  await writeConfig(config);
}

export async function unregisterChannel(channelId: string): Promise<void> {
  const config = await readConfig();
  delete config.channelRegistry[channelId];
  await writeConfig(config);
}
