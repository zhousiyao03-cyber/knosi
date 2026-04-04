import { getLocalDateString } from "./focus-shared";

export function shiftDate(date: string, deltaDays: number) {
  const [year, month, day] = date.split("-").map(Number);
  const next = new Date(year, month - 1, day + deltaDays);
  return getLocalDateString(next);
}

export function getWeekStart(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  const current = new Date(year, month - 1, day);
  const dayOfWeek = current.getDay();
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  current.setDate(current.getDate() + diff);
  return getLocalDateString(current);
}

export function formatRelativeTime(date: string | Date | null) {
  if (!date) {
    return "Never seen";
  }

  const value = typeof date === "string" ? new Date(date) : date;
  const diffMs = Date.now() - value.getTime();
  const diffMins = Math.max(Math.floor(diffMs / 60_000), 0);

  if (diffMins < 1) {
    return "Seen just now";
  }

  if (diffMins < 60) {
    return `Seen ${diffMins}m ago`;
  }

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) {
    return `Seen ${diffHours}h ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `Seen ${diffDays}d ago`;
}

export function getDeviceStatus(device: {
  revokedAt: string | Date | null;
  lastSeenAt: string | Date | null;
}) {
  if (device.revokedAt) {
    return {
      label: "Revoked",
      tone:
        "text-stone-400 dark:text-stone-500",
    };
  }

  if (device.lastSeenAt) {
    const lastSeenAt =
      typeof device.lastSeenAt === "string"
        ? new Date(device.lastSeenAt)
        : device.lastSeenAt;
    const diffMs = Date.now() - lastSeenAt.getTime();
    if (diffMs < 5 * 60_000) {
      return {
        label: "Connected",
        tone: "text-emerald-600 dark:text-emerald-300",
      };
    }

    return {
      label: "Recent device",
      tone: "text-sky-600 dark:text-sky-300",
    };
  }

  return {
    label: "Paired",
    tone: "text-amber-600 dark:text-amber-300",
  };
}

export const nonWorkLabels = {
  "social-media": "Social / Messaging",
  entertainment: "Entertainment",
  gaming: "Gaming",
} as const;
