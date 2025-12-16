import { nanoid } from 'nanoid';

type PendingAction =
  | {
      type: 'CAT_ADD';
      payload: { id: string; name: string; order: number };
    }
  | {
      type: 'CAT_REMOVE';
      payload: { categoryId: string; name: string };
    }
  | {
      type: 'CHANNEL_ADD';
      payload: { channelId: string; categoryId: string; categoryName: string; channelName: string };
    }
  | {
      type: 'CHANNEL_REMOVE';
      payload: { channelId: string; categoryId: string; categoryName: string; channelName: string };
    };

type PendingActionEntry = PendingAction & { userId: string };

const pending = new Map<string, PendingActionEntry>();

export function createPendingAction(action: PendingActionEntry): string {
  const token = nanoid(12);
  pending.set(token, action);
  return token;
}

export function getPendingAction(token: string): PendingActionEntry | undefined {
  return pending.get(token);
}

export function consumePendingAction(token: string): PendingActionEntry | undefined {
  const entry = pending.get(token);
  if (entry) {
    pending.delete(token);
  }
  return entry;
}

export function cancelPendingAction(token: string): void {
  pending.delete(token);
}
