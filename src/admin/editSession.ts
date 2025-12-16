export type EditMode = 'ADD_CHANNEL' | 'DELETE_CHANNEL' | 'ORDER_CHANNEL' | 'ORDER_CATEGORY';

export type EditStep =
  | { step: 'PICK_ADD_CHANNELS'; channels: string[] }
  | { step: 'ADD_METHOD'; channels: string[] }
  | { step: 'ADD_EXISTING_CATEGORY'; channels: string[] }
  | { step: 'ADD_NEW_CATEGORY_NAME'; channels: string[] }
  | { step: 'ADD_NEW_CATEGORY_ORDER'; channels: string[]; categoryName: string }
  | { step: 'ADD_CONFIRM'; channels: string[]; categoryId: string; categoryName: string; overrideNeeded: string[] }
  | { step: 'ADD_NEW_CONFIRM'; channels: string[]; categoryName: string; position: number; overrideNeeded: string[] }
  | { step: 'DELETE_PICK_CHANNELS'; channels: string[] }
  | { step: 'DELETE_CONFIRM'; channels: string[] }
  | { step: 'ORDER_PICK_CATEGORY' }
  | { step: 'ORDER_PICK_CHANNEL'; categoryId: string }
  | { step: 'ORDER_PICK_POSITION'; categoryId: string; channelId: string }
  | { step: 'CATEGORY_ORDER_PICK' }
  | { step: 'CATEGORY_ORDER_POSITION'; categoryId: string };

export type EditSession = {
  userId: string;
  mode: EditMode;
  current: EditStep;
};

const sessions = new Map<string, EditSession>();

export function startEditSession(userId: string, mode: EditMode): EditSession {
  const session: EditSession = {
    userId,
    mode,
    current: { step: 'PICK_ADD_CHANNELS', channels: [] },
  };
  sessions.set(userId, session);
  return session;
}

export function getEditSession(userId: string): EditSession | undefined {
  return sessions.get(userId);
}

export function setEditSession(userId: string, current: EditStep): EditSession | undefined {
  const session = sessions.get(userId);
  if (!session) return undefined;
  session.current = current;
  return session;
}

export function endEditSession(userId: string): void {
  sessions.delete(userId);
}
