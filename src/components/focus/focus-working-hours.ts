function formatDuration(totalSecs: number) {
  const hours = Math.floor(totalSecs / 3600);
  const minutes = Math.floor((totalSecs % 3600) / 60);
  const seconds = totalSecs % 60;
  const parts: string[] = [];

  if (hours > 0) {
    parts.push(`${hours}h`);
  }

  if (minutes > 0) {
    parts.push(`${minutes}m`);
  }

  if (hours === 0 && seconds > 0) {
    parts.push(`${seconds}s`);
  }

  return parts.join(" ");
}

export function getWorkingHoursBaselineCopy(workHoursSecs: number | null | undefined) {
  if (workHoursSecs == null) {
    return "Waiting for more data.";
  }

  if (workHoursSecs >= 8 * 3600) {
    return "Past the 8h working-hours baseline.";
  }

  return `${formatDuration(8 * 3600 - workHoursSecs)} left to reach 8h.`;
}
