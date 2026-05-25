"use client";

import { useEffect, useMemo, useState } from "react";
import TimeInput from "./components/TimeInput";
import TimezoneStrip from "./components/TimezoneStrip";
import { wallTimeToUtc, formatDateInZone } from "./lib/time";

const DEFAULT_ZONE = "Pacific/Rarotonga"; // Cook Islands, per spec
const DEFAULT_TIME = "21:00"; // 9:00pm

function parseHHMM(s: string): { hour: number; minute: number } {
  const [h, m] = s.split(":").map(Number);
  return { hour: Number.isFinite(h) ? h : 0, minute: Number.isFinite(m) ? m : 0 };
}

// Today's date (year/month/day) interpreted in `zone`, so "9pm in Rarotonga
// today" doesn't slide to yesterday/tomorrow as the user's machine clock ticks.
function todayInZone(zone: string): { y: number; m: number; d: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  return { y: get("year"), m: get("month"), d: get("day") };
}

export default function Home() {
  const [time, setTime] = useState(DEFAULT_TIME);
  const [zone, setZone] = useState(DEFAULT_ZONE);
  // Bumped when "Now" is clicked, to refresh the implicit "today" reference.
  const [nowTick, setNowTick] = useState(0);

  const baseUtc = useMemo(() => {
    const { hour, minute } = parseHHMM(time);
    const { y, m, d } = todayInZone(zone);
    return wallTimeToUtc(y, m, d, hour, minute, zone);
    // nowTick triggers a re-derivation of "today" from the wall clock
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [time, zone, nowTick]);

  // Auto-advance the "today" reference once per minute so the strip's
  // day/night terminator drifts even if the user leaves the tab open.
  useEffect(() => {
    const id = setInterval(() => setNowTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const handleNow = () => {
    const d = new Date();
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    setTime(`${hh}:${mm}`);
    setZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
    setNowTick((n) => n + 1);
  };

  const sourceDateLabel = formatDateInZone(baseUtc, zone);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-8 sm:px-8">
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.25em] text-cyan-300/80">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-cyan-300" />
          World Clock
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
          One time, every city.
        </h1>
        <p className="max-w-2xl text-sm text-zinc-400">
          Type a time in any timezone — the world map updates instantly with the
          equivalent local time in major cities everywhere. Source date:{" "}
          <span className="text-zinc-200">{sourceDateLabel}</span>.
        </p>
      </header>

      <TimeInput
        time={time}
        zone={zone}
        onTimeChange={setTime}
        onZoneChange={setZone}
        onNow={handleNow}
      />

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.2em] text-zinc-500">
          <span>Day · Night across the planet</span>
          <span className="font-mono text-zinc-400">UTC offset bands</span>
        </div>
        <TimezoneStrip baseUtc={baseUtc} sourceZone={zone} />
      </div>

      <footer className="pt-2 text-center text-[11px] text-zinc-500">
        Built with Next.js and d3-geo · timezones via the browser&apos;s Intl
        API.
      </footer>
    </main>
  );
}
