"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { geoEquirectangular, geoPath } from "d3-geo";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import worldTopo from "world-atlas/countries-110m.json";
import { CITIES } from "@/app/lib/cities";
import {
  formatTimeInZone,
  getZoneOffsetMinutes,
  subsolarPoint,
} from "@/app/lib/time";

type Props = {
  baseUtc: Date;
  sourceZone: string;
};

// Shift the map a few degrees east so Avarua (Cook Is, ~−160°) hugs the
// left edge and New Zealand (~+175°) has breathing room on the right edge.
const CENTER_LON = 10;

export default function TimezoneStrip({ baseUtc, sourceZone }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(1024);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const w = Math.max(320, Math.floor(el.getBoundingClientRect().width));
      setWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Equirectangular world is 2:1 — keep that ratio so countries don't squash.
  const HEIGHT = Math.round(width / 2);

  const land: FeatureCollection<Geometry> = useMemo(() => {
    const topo = worldTopo as unknown as Topology;
    const obj = topo.objects.countries as GeometryCollection;
    return feature(topo, obj) as FeatureCollection<Geometry>;
  }, []);

  const project = useMemo(() => {
    return geoEquirectangular()
      .scale(width / (2 * Math.PI))
      .translate([width / 2, HEIGHT / 2])
      .rotate([-CENTER_LON, 0, 0]);
  }, [width, HEIGHT]);

  const pathGen = useMemo(() => geoPath(project), [project]);

  const sub = useMemo(() => subsolarPoint(baseUtc), [baseUtc]);

  const nightPath = useMemo(
    () => buildNightPath(sub, width, HEIGHT),
    [sub, width, HEIGHT],
  );

  const sourceCity = useMemo(
    () => CITIES.find((c) => c.tz === sourceZone),
    [sourceZone],
  );

  // Drop labels that would crowd a nearby city — keep the source city
  // first, then walk the list and skip anything inside one label-bbox
  // of a city already taken.
  const visibleCities = useMemo(() => {
    // Label bbox grows with map width so we don't over-cull on small screens.
    const minDx = Math.max(70, Math.round(width * 0.08));
    const minDy = 30;
    const ordered = [...CITIES].sort((a, b) => {
      if (a.tz === sourceZone) return -1;
      if (b.tz === sourceZone) return 1;
      return 0;
    });
    const kept: { c: (typeof CITIES)[number]; x: number; y: number }[] = [];
    for (const c of ordered) {
      const xy = project([c.lng, c.lat]);
      if (!xy) continue;
      const [x, y] = xy;
      const crowded = kept.some(
        (k) => Math.abs(k.x - x) < minDx && Math.abs(k.y - y) < minDy,
      );
      if (crowded) continue;
      kept.push({ c, x, y });
    }
    return kept;
  }, [project, width, sourceZone]);

  const sourceLon = sourceCity?.lng ?? 0;
  const sourceProj = project([sourceLon, 0]);
  const sourceX = sourceProj ? sourceProj[0] : 0;

  // Timezone offset tick marks across the bottom (every hour from -12 to +12).
  const ticks = useMemo(() => {
    const out: { x: number; label: string; lon: number }[] = [];
    for (let h = -12; h <= 12; h += 1) {
      const lon = h * 15;
      const xy = project([lon, 0]);
      if (!xy) continue;
      const sign = h >= 0 ? "+" : "−";
      out.push({ x: xy[0], label: `${sign}${Math.abs(h)}`, lon });
    }
    // Keep them in left-to-right order regardless of the rotation wrap.
    return out.sort((a, b) => a.x - b.x);
  }, [project]);

  const sourceOffset = getZoneOffsetMinutes(baseUtc, sourceZone);

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden rounded-3xl border border-white/10 bg-[linear-gradient(180deg,_rgba(10,18,35,1),_rgba(2,4,10,1))]"
    >
      <svg width={width} height={HEIGHT} className="block">
        <defs>
          <linearGradient id="seaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0e1a32" />
            <stop offset="100%" stopColor="#070d1c" />
          </linearGradient>
          <linearGradient id="dayWash" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(255, 220, 140, 0.05)" />
            <stop offset="100%" stopColor="rgba(255, 220, 140, 0)" />
          </linearGradient>
          <filter id="terminatorBlur" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="1.2" />
          </filter>
        </defs>

        {/* Ocean */}
        <rect x={0} y={0} width={width} height={HEIGHT} fill="url(#seaGrad)" />

        {/* Subtle hour grid */}
        {ticks.map((t) => (
          <line
            key={`grid-${t.label}`}
            x1={t.x}
            x2={t.x}
            y1={0}
            y2={HEIGHT}
            stroke="rgba(255,255,255,0.04)"
            strokeWidth={1}
          />
        ))}

        {/* Day wash on top of ocean */}
        <rect x={0} y={0} width={width} height={HEIGHT} fill="url(#dayWash)" />

        {/* Countries — daytime fill */}
        <g>
          {(land.features as Feature<Geometry>[]).map((f, i) => {
            const d = pathGen(f);
            if (!d) return null;
            return (
              <path
                key={i}
                d={d}
                fill="#2f415d"
                stroke="rgba(122,160,210,0.35)"
                strokeWidth={0.4}
              />
            );
          })}
        </g>

        {/* Night overlay (terminator) */}
        <path
          d={nightPath}
          fill="rgba(2,4,10,0.62)"
          stroke="rgba(120,180,255,0.45)"
          strokeWidth={1}
          filter="url(#terminatorBlur)"
        />

        {/* Source-zone vertical highlight */}
        <line
          x1={sourceX}
          x2={sourceX}
          y1={0}
          y2={HEIGHT}
          stroke="#22d3ee"
          strokeWidth={1.5}
          strokeDasharray="3 4"
        />
        <rect
          x={Math.max(0, sourceX - 10)}
          y={0}
          width={20}
          height={HEIGHT}
          fill="rgba(34, 211, 238, 0.06)"
        />

        {/* Cities — culled to avoid label crowding */}
        {visibleCities.map(({ c, x, y }) => {
          const isSource = c.tz === sourceZone;
          return (
            <g key={c.name} transform={`translate(${x},${y})`}>
              <circle
                r={isSource ? 6 : 3.5}
                fill={isSource ? "#22d3ee" : "#fde68a"}
                stroke={isSource ? "rgba(34,211,238,0.45)" : "rgba(253,230,138,0.4)"}
                strokeWidth={isSource ? 4 : 2.5}
              />
              <text
                x={9}
                y={-7}
                fontSize={isSource ? 16 : 13}
                fontWeight={isSource ? 700 : 600}
                fill={isSource ? "#22d3ee" : "#fde68a"}
                style={{ paintOrder: "stroke" }}
                stroke="rgba(2,4,10,0.92)"
                strokeWidth={3.6}
              >
                {c.name}
              </text>
              <text
                x={9}
                y={10}
                fontSize={isSource ? 14 : 12}
                fontWeight={isSource ? 600 : 500}
                fill={isSource ? "#a5f3fc" : "rgba(255,255,255,0.92)"}
                style={{
                  paintOrder: "stroke",
                  fontFamily:
                    "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                }}
                stroke="rgba(2,4,10,0.92)"
                strokeWidth={3.6}
              >
                {formatTimeInZone(baseUtc, c.tz)}
              </text>
            </g>
          );
        })}

        {/* Subsolar marker (small sun) */}
        {(() => {
          const xy = project([sub.lon, sub.lat]);
          if (!xy) return null;
          const [x, y] = xy;
          return (
            <g transform={`translate(${x},${y})`}>
              <circle r={7} fill="rgba(255,220,140,0.18)" />
              <circle r={3} fill="#ffe49b" />
            </g>
          );
        })()}

        {/* Hour tick labels along the bottom (UTC offset bands) */}
        {ticks.map((t) => (
          <g key={`tick-${t.label}`}>
            <line
              x1={t.x}
              x2={t.x}
              y1={HEIGHT - 18}
              y2={HEIGHT - 8}
              stroke="rgba(255,255,255,0.25)"
            />
            <text
              x={t.x}
              y={HEIGHT - 2}
              fontSize={11}
              textAnchor="middle"
              fill="rgba(255,255,255,0.6)"
              fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
            >
              {t.label}
            </text>
          </g>
        ))}
      </svg>

      <div className="pointer-events-none absolute right-4 top-3 rounded-md border border-cyan-400/30 bg-cyan-400/10 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-cyan-200">
        Source · UTC{sourceOffset >= 0 ? "+" : "−"}
        {Math.floor(Math.abs(sourceOffset) / 60)}
        {sourceOffset % 60 !== 0
          ? `:${String(Math.abs(sourceOffset) % 60).padStart(2, "0")}`
          : ""}
      </div>
    </div>
  );
}

// Build a closed SVG path covering the night hemisphere. Uses a custom
// equirectangular projection (no antimeridian clipping) so the polygon
// spans the full visible map width — d3's clip wraps any point past the
// rotated antimeridian back to the left edge, which would collapse the
// polar-close points to (0, H) and shade the wrong half of the map.
function buildNightPath(
  sub: { lon: number; lat: number },
  width: number,
  height: number,
): string {
  const declRaw = sub.lat;
  const decl =
    Math.abs(declRaw) < 0.5 ? (declRaw >= 0 ? 0.5 : -0.5) : declRaw;
  const declRad = (decl * Math.PI) / 180;

  const project = (lon: number, lat: number): [number, number] => {
    let dLon = lon - CENTER_LON;
    while (dLon > 180) dLon -= 360;
    while (dLon < -180) dLon += 360;
    return [
      ((dLon + 180) / 360) * width,
      ((90 - lat) / 180) * height,
    ];
  };

  const pts: [number, number][] = [];
  for (let dLon = -180; dLon <= 180; dLon += 1) {
    const lon = CENTER_LON + dLon;
    const lonRel = ((lon - sub.lon) * Math.PI) / 180;
    const lat =
      (Math.atan(-Math.cos(lonRel) / Math.tan(declRad)) * 180) / Math.PI;
    pts.push(project(lon, lat));
  }

  // Close around the polar night cap. For decl > 0 (sun in N), the dark
  // hemisphere wraps the South Pole — close along the bottom edge of the
  // map. For decl < 0, close along the top edge instead.
  const polarY = decl > 0 ? height : 0;
  pts.push([width, polarY]);
  pts.push([0, polarY]);

  return (
    "M " +
    pts.map((p) => `${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(" L ") +
    " Z"
  );
}
