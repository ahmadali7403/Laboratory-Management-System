// Laboratories operate in Pakistan Standard Time (UTC+5, no DST).
export const LAB_TZ = "Asia/Karachi";
const OFFSET = "+05:00";

export function startOfToday(now = new Date()) {
  const ymd = new Intl.DateTimeFormat("en-CA", {
    timeZone: LAB_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return new Date(`${ymd}T00:00:00${OFFSET}`);
}

export function daysAgo(n, now = new Date()) {
  const d = startOfToday(now);
  return new Date(d.getTime() - n * 86_400_000);
}

export function dayKey(date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: LAB_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
