"use client";

import { SOURCE_ZONES } from "@/app/lib/cities";

type Props = {
  time: string; // "HH:mm" in 24h
  zone: string;
  onTimeChange: (t: string) => void;
  onZoneChange: (z: string) => void;
  onNow: () => void;
};

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function minutesToTime(m: number): string {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function formatBigTime(t: string): { hm: string; period: string } {
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return {
    hm: `${h12}:${String(m).padStart(2, "0")}`,
    period,
  };
}

export default function TimeInput({
  time,
  zone,
  onTimeChange,
  onZoneChange,
  onNow,
}: Props) {
  const minutes = timeToMinutes(time);
  const { hm, period } = formatBigTime(time);

  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-white/10 bg-white/5 px-5 py-5 backdrop-blur-md">
      {/* Timezone selector — above the time */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-1 min-w-[16rem] flex-col">
          <label className="mb-1 text-[10px] font-medium uppercase tracking-wider text-zinc-400">
            In timezone
          </label>
          <select
            value={zone}
            onChange={(e) => onZoneChange(e.target.value)}
            className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-white outline-none focus:border-cyan-400/60 focus:ring-1 focus:ring-cyan-400/40"
          >
            {SOURCE_ZONES.map((z) => (
              <option key={z.tz} value={z.tz} className="bg-zinc-900">
                {z.label} — {z.tz}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={onNow}
          className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-200 transition hover:bg-white/10 hover:text-white"
        >
          Now
        </button>
      </div>

      {/* Big time readout */}
      <div className="flex items-baseline justify-center gap-3 select-none">
        <span className="font-mono text-6xl font-semibold tracking-tight text-cyan-200 tabular-nums drop-shadow-[0_0_24px_rgba(34,211,238,0.25)] sm:text-7xl">
          {hm}
        </span>
        <span className="text-2xl font-medium tracking-wide text-cyan-300/70">
          {period}
        </span>
      </div>

      {/* Slider — below the time */}
      <div className="flex flex-col gap-2">
        <input
          type="range"
          min={0}
          max={1439}
          step={1}
          value={minutes}
          onChange={(e) => onTimeChange(minutesToTime(Number(e.target.value)))}
          aria-label="Time of day"
          className="time-slider w-full"
        />
        <div className="flex justify-between font-mono text-[10px] uppercase tracking-wider text-zinc-500">
          <span>12 AM</span>
          <span>6 AM</span>
          <span>12 PM</span>
          <span>6 PM</span>
          <span>12 AM</span>
        </div>
      </div>
    </div>
  );
}
