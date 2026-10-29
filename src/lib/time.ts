const DAY = 24 * 60 * 60 * 1000;

function startOfDay(t: number) {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function clockTime(t: number) {
  return new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/** Compact time for the Messages list: "now", "12m", "3:41 PM", "Yesterday", "Tue", "Oct 12". */
export function listTime(t: number, now = Date.now()) {
  const diff = now - t;
  if (diff < 60_000) return 'now';
  if (diff < 60 * 60_000) return `${Math.floor(diff / 60_000)}m`;
  const today = startOfDay(now);
  if (t >= today) return clockTime(t);
  if (t >= today - DAY) return 'Yesterday';
  if (t >= today - 6 * DAY) return new Date(t).toLocaleDateString([], { weekday: 'short' });
  return new Date(t).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

/** Separator label between days in a chat: "Today", "Yesterday", "Mon, Oct 26". */
export function dayLabel(t: number, now = Date.now()) {
  const today = startOfDay(now);
  if (t >= today) return 'Today';
  if (t >= today - DAY) return 'Yesterday';
  return new Date(t).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

export const sameDay = (a: number, b: number) => startOfDay(a) === startOfDay(b);
