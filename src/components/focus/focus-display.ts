export const WEB_FOCUS_DISPLAY_MIN_SECS = 10 * 60;

type FocusDisplaySession = {
  durationSecs: number;
  focusedSecs?: number;
};

export function getSessionDisplaySecs(session: FocusDisplaySession) {
  return session.focusedSecs ?? session.durationSecs;
}

export function splitSessionsByDisplayThreshold<T extends FocusDisplaySession>(
  sessions: T[],
  minSecs = WEB_FOCUS_DISPLAY_MIN_SECS
) {
  const visibleSessions: T[] = [];
  const hiddenSessions: T[] = [];
  let hiddenTotalSecs = 0;

  for (const session of sessions) {
    if (getSessionDisplaySecs(session) >= minSecs) {
      visibleSessions.push(session);
      continue;
    }

    hiddenSessions.push(session);
    hiddenTotalSecs += getSessionDisplaySecs(session);
  }

  return {
    visibleSessions,
    hiddenSessions,
    hiddenCount: hiddenSessions.length,
    hiddenTotalSecs,
  };
}
