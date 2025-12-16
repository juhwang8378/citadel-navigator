export type ScreenState =
  | { screen: 'HOME' }
  | { screen: 'PICK_CATEGORY' }
  | { screen: 'CHANNEL_LIST'; categoryId: string }
  | { screen: 'EDIT_FAVORITES' }
  | { screen: 'REMOVE_FAV' }
  | { screen: 'REORDER_FAV'; sourceIndex?: number };

export type Session = {
  userId: string;
  stack: ScreenState[];
  current: ScreenState;
};

const sessions = new Map<string, Session>();

export function getOrCreateSession(userId: string): Session {
  const existing = sessions.get(userId);
  if (existing) return existing;
  const session: Session = { userId, stack: [], current: { screen: 'HOME' } };
  sessions.set(userId, session);
  return session;
}

export function setCurrentScreen(userId: string, next: ScreenState, pushCurrent = true): Session {
  const session = getOrCreateSession(userId);
  if (pushCurrent && session.current) {
    session.stack.push(session.current);
  }
  session.current = next;
  return session;
}

export function goBack(userId: string): Session {
  const session = getOrCreateSession(userId);
  const prev = session.stack.pop();
  session.current = prev ?? { screen: 'HOME' };
  return session;
}

export function resetSession(userId: string): Session {
  const session = getOrCreateSession(userId);
  session.stack = [];
  session.current = { screen: 'HOME' };
  return session;
}
