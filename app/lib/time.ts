// All timezone math relies on Intl. No external date libraries.

// Returns the UTC offset (in minutes) for the given IANA zone at the
// given UTC instant. East-of-UTC zones return positive values.
export function getZoneOffsetMinutes(utcDate: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(utcDate);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return Math.round((asUtc - utcDate.getTime()) / 60000);
}

// Convert a wall-clock time in a given timezone to a UTC Date.
// e.g. wallTimeToUtc(2026, 5, 24, 21, 0, "Pacific/Rarotonga") returns
// the Date corresponding to "9:00pm in the Cook Islands on 2026-05-24".
export function wallTimeToUtc(
  year: number,
  month: number, // 1-12
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  // First guess: treat the wall-time fields as UTC.
  let utcMs = Date.UTC(year, month - 1, day, hour, minute);
  // Refine twice — once is enough for fixed offsets, twice handles DST
  // transitions on either side of the guess.
  for (let i = 0; i < 2; i++) {
    const offset = getZoneOffsetMinutes(new Date(utcMs), timeZone);
    const wallAsUtc = Date.UTC(year, month - 1, day, hour, minute);
    utcMs = wallAsUtc - offset * 60000;
  }
  return new Date(utcMs);
}

export function formatTimeInZone(utcDate: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(utcDate);
}

export function formatDateInZone(utcDate: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(utcDate);
}

export function formatOffset(minutes: number): string {
  const sign = minutes >= 0 ? "+" : "−";
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return m === 0 ? `UTC${sign}${h}` : `UTC${sign}${h}:${String(m).padStart(2, "0")}`;
}

// Day-of-year (1-365/366) of `date` interpreted in UTC.
function dayOfYearUtc(date: Date): number {
  const start = Date.UTC(date.getUTCFullYear(), 0, 1);
  return Math.floor((date.getTime() - start) / 86400000) + 1;
}

// Returns the subsolar point (longitude, latitude) in degrees for `date`.
// Approximation good to ~1° — fine for a UI overlay.
export function subsolarPoint(date: Date): { lon: number; lat: number } {
  const n = dayOfYearUtc(date);
  // Solar declination (Cooper formula).
  const declRad = (23.44 * Math.PI) / 180 *
    Math.sin((2 * Math.PI * (284 + n)) / 365);
  const lat = (declRad * 180) / Math.PI;

  // Hours since UTC midnight, with fractional minutes.
  const utcHours =
    date.getUTCHours() +
    date.getUTCMinutes() / 60 +
    date.getUTCSeconds() / 3600;
  // Sun is directly above longitude where local apparent solar time is noon.
  // At UTC noon, subsolar lon ≈ 0°. The sun moves westward 15°/hour.
  let lon = (12 - utcHours) * 15;
  if (lon > 180) lon -= 360;
  if (lon < -180) lon += 360;
  return { lon, lat };
}

// Is (lon, lat) on the daylight side at this subsolar point?
export function isDaylight(
  lon: number,
  lat: number,
  sub: { lon: number; lat: number },
): boolean {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const cosAngle =
    Math.sin(toRad(sub.lat)) * Math.sin(toRad(lat)) +
    Math.cos(toRad(sub.lat)) * Math.cos(toRad(lat)) *
      Math.cos(toRad(lon - sub.lon));
  return cosAngle > 0;
}
