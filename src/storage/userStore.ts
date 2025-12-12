import { promises as fs } from 'fs';
import path from 'path';

type UserData = {
  favorites: Record<string, string[]>;
};

const USERS_PATH = path.resolve(process.cwd(), 'users.json');
const MAX_FAVORITES = 5;

async function ensureUserFile(): Promise<void> {
  try {
    await fs.access(USERS_PATH);
  } catch {
    const empty: UserData = { favorites: {} };
    await fs.writeFile(USERS_PATH, JSON.stringify(empty, null, 2), 'utf8');
  }
}

async function readUsers(): Promise<UserData> {
  await ensureUserFile();
  const raw = await fs.readFile(USERS_PATH, 'utf8');
  return JSON.parse(raw) as UserData;
}

async function writeUsers(data: UserData): Promise<void> {
  await fs.writeFile(USERS_PATH, JSON.stringify(data, null, 2), 'utf8');
}

export async function getFavorites(userId: string): Promise<string[]> {
  const data = await readUsers();
  return data.favorites[userId] ?? [];
}

export async function addFavorite(
  userId: string,
  channelId: string,
): Promise<{ ok: true; favorites: string[] } | { ok: false; reason: 'max' | 'duplicate' }> {
  const data = await readUsers();
  const list = data.favorites[userId] ?? [];
  if (list.includes(channelId)) {
    return { ok: false, reason: 'duplicate' };
  }
  if (list.length >= MAX_FAVORITES) {
    return { ok: false, reason: 'max' };
  }
  const updated = [...list, channelId];
  data.favorites[userId] = updated;
  await writeUsers(data);
  return { ok: true, favorites: updated };
}

export async function removeFavorite(userId: string, channelId: string): Promise<string[]> {
  const data = await readUsers();
  const list = data.favorites[userId] ?? [];
  const updated = list.filter((id) => id !== channelId);
  data.favorites[userId] = updated;
  await writeUsers(data);
  return updated;
}

export async function reorderFavorites(userId: string, fromIndex: number, toIndex: number): Promise<string[]> {
  const data = await readUsers();
  const list = [...(data.favorites[userId] ?? [])];
  if (fromIndex < 0 || fromIndex >= list.length || toIndex < 0 || toIndex >= list.length) {
    return list;
  }
  const [moved] = list.splice(fromIndex, 1);
  list.splice(toIndex, 0, moved);
  data.favorites[userId] = list;
  await writeUsers(data);
  return list;
}
