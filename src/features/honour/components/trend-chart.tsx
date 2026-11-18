"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { CHART } from "../chart-colors";
import type { DailyPoint } from "../rules";

const HEIGHT = 240;
const PAD = { top: 16, right: 52, bottom: 28, left: 40 };
const GOOD = CHART.good;
const BAD = CHART.bad;

const num = new Intl.NumberFormat("en-GB");
const dayFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const longFmt = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const parse = (key: string) => new Date(`${key}T12:00:00Z`);

/** Round the y-axis max up to a friendly number (5, 10, 20, 25, 50, 100…). */
function niceMax(v: number): number {
  if (v <= 0) return 10;
  const exp = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * exp >= v) return m * exp;
  return 10 * exp;
}

export function TrendChart({ data }: { data: DailyPoint[] }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(320);
  const [active, setActive] = useState<number | null>(null);
  const tipId = useId();

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(200, Math.floor(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const geo = useMemo(() => {
    const max = niceMax(Math.max(...data.map((d) => Math.max(d.good, d.bad)), 0));
    const plotW = width - PAD.left - PAD.right;
    const plotH = HEIGHT - PAD.top - PAD.bottom;
    const x = (i: number) => PAD.left + (data.length === 1 ? plotW / 2 : (i / (data.length - 1)) * plotW);
    const y = (v: number) => PAD.top + plotH - (Math.max(0, v) / max) * plotH;
    const path = (key: "good" | "bad") => data.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(d[key]).toFixed(1)}`).join("");
    const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);
    return { max, plotW, plotH, x, y, path, ticks };
  }, [data, width]);

  const last = data.length - 1;
  // Direct end-of-line labels; nudge apart when they'd collide.
  let goodLabelY = geo.y(data[last].good);
  let badLabelY = geo.y(data[last].bad);
  if (Math.abs(goodLabelY - badLabelY) < 14) {
    const mid = (goodLabelY + badLabelY) / 2;
    const goodAbove = data[last].good >= data[last].bad;
    goodLabelY = mid + (goodAbove ? -7 : 7);
    badLabelY = mid + (goodAbove ? 7 : -7);
  }

  const xLabelIdx = [...new Set([0, Math.floor(last / 2), last])];

  function indexFromPointer(clientX: number, rect: DOMRect) {
    const px = ((clientX - rect.left) / rect.width) * width;
    const t = (px - PAD.left) / geo.plotW;
    return Math.min(last, Math.max(0, Math.round(t * last)));
  }

  const point = active === null ? null : data[active];
  const tipLeft = active === null ? 0 : geo.x(active);

  return (
    <div>
      {/* Legend (always present for 2 series); line keys mirror the marks */}
      <ul className="mb-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-silver-300" aria-label="Legend">
        <li className="flex items-center gap-2">
          <svg width="18" height="4" aria-hidden="true">
            <line x1="0" y1="2" x2="18" y2="2" style={{ stroke: GOOD }} strokeWidth="2" strokeLinecap="round" />
          </svg>
          Good points
        </li>
        <li className="flex items-center gap-2">
          <svg width="18" height="4" aria-hidden="true">
            <line x1="0" y1="2" x2="18" y2="2" style={{ stroke: BAD }} strokeWidth="2" strokeLinecap="round" />
          </svg>
          Bad points
        </li>
      </ul>

      <div ref={wrapRef} className="relative w-full">
        <svg
          width={width}
          height={HEIGHT}
          viewBox={`0 0 ${width} ${HEIGHT}`}
          role="img"
          aria-label={`Line chart of good and bad points per day over the last ${data.length} days. Use the arrow keys for daily values, or open the data table below.`}
          className="block max-w-full touch-pan-y outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          tabIndex={0}
          aria-describedby={point ? tipId : undefined}
          onPointerMove={(e) => setActive(indexFromPointer(e.clientX, e.currentTarget.getBoundingClientRect()))}
          onPointerDown={(e) => setActive(indexFromPointer(e.clientX, e.currentTarget.getBoundingClientRect()))}
          onPointerLeave={() => setActive(null)}
          onBlur={() => setActive(null)}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") setActive((a) => Math.max(0, (a ?? last + 1) - 1));
            else if (e.key === "ArrowRight") setActive((a) => Math.min(last, (a ?? -1) + 1));
            else if (e.key === "Home") setActive(0);
            else if (e.key === "End") setActive(last);
            else if (e.key === "Escape") setActive(null);
            else return;
            e.preventDefault();
          }}
        >
          {/* Recessive grid + y axis */}
          {geo.ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={width - PAD.right} y1={geo.y(t)} y2={geo.y(t)} style={{ stroke: CHART.grid }} strokeWidth="1" />
              <text x={PAD.left - 8} y={geo.y(t)} dy="0.32em" textAnchor="end" fontSize="11" style={{ fill: CHART.ink }}>
                {num.format(t)}
              </text>
            </g>
          ))}
          {xLabelIdx.map((i) => (
            <text
              key={i}
              x={geo.x(i)}
              y={HEIGHT - 8}
              textAnchor={i === 0 ? "start" : i === last ? "end" : "middle"}
              fontSize="11"
              style={{ fill: CHART.ink }}
            >
              {dayFmt.format(parse(data[i].date))}
            </text>
          ))}

          {/* Lines: bad first so good draws on top; 2px with a surface halo for overlaps */}
          {(["bad", "good"] as const).map((key) => (
            <g key={key}>
              <path d={geo.path(key)} fill="none" style={{ stroke: CHART.surface }} strokeWidth="5" strokeLinejoin="round" strokeLinecap="round" />
              <path
                d={geo.path(key)}
                fill="none"
                style={{ stroke: key === "good" ? GOOD : BAD }}
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
                data-testid={`trend-line-${key}`}
              />
            </g>
          ))}

          {/* Direct labels at line ends (text ink, not series colour) */}
          <text x={geo.x(last) + 8} y={goodLabelY} dy="0.32em" fontSize="12" style={{ fill: CHART.inkStrong }}>
            Good
          </text>
          <text x={geo.x(last) + 8} y={badLabelY} dy="0.32em" fontSize="12" style={{ fill: CHART.inkStrong }}>
            Bad
          </text>

          {/* Crosshair */}
          {point && active !== null && (
            <g pointerEvents="none">
              <line x1={geo.x(active)} x2={geo.x(active)} y1={PAD.top} y2={HEIGHT - PAD.bottom} style={{ stroke: CHART.hair }} strokeWidth="1" />
              {(["bad", "good"] as const).map((key) => (
                <circle
                  key={key}
                  cx={geo.x(active)}
                  cy={geo.y(point[key])}
                  r="4.5"
                  style={{ fill: key === "good" ? GOOD : BAD, stroke: CHART.surface }}
                  strokeWidth="2"
                />
              ))}
            </g>
          )}
        </svg>

        {point && active !== null && (
          <div
            id={tipId}
            role="status"
            className="pointer-events-none absolute top-2 z-10 min-w-36 rounded-lg border border-obsidian-600 bg-obsidian-950/95 px-3 py-2 text-sm shadow-lg"
            style={{
              left: Math.min(Math.max(tipLeft - 72, 0), width - 150),
            }}
          >
            <p className="text-xs text-silver-300">{longFmt.format(parse(point.date))}</p>
            {(["good", "bad"] as const).map((key) => (
              <p key={key} className="mt-1 flex items-center gap-2">
                <svg width="12" height="4" aria-hidden="true">
                  <line x1="0" y1="2" x2="12" y2="2" style={{ stroke: key === "good" ? GOOD : BAD }} strokeWidth="2" strokeLinecap="round" />
                </svg>
                <strong className="font-semibold text-silver-100">{num.format(point[key])}</strong>
                <span className="text-silver-300">{key === "good" ? "good" : "bad"}</span>
              </p>
            ))}
          </div>
        )}
      </div>

      <details className="mt-3 text-sm">
        <summary className="min-h-11 cursor-pointer py-2 text-emerald-300">Show data table</summary>
        <div className="max-h-64 overflow-auto">
          <table className="w-full text-left">
            <caption className="sr-only">Good and bad points per day</caption>
            <thead className="text-silver-300">
              <tr>
                <th scope="col" className="py-1 pr-4 font-normal">
                  Day
                </th>
                <th scope="col" className="py-1 pr-4 text-right font-normal">
                  Good
                </th>
                <th scope="col" className="py-1 text-right font-normal">
                  Bad
                </th>
              </tr>
            </thead>
            <tbody className="text-silver-100">
              {[...data].reverse().map((d) => (
                <tr key={d.date} className="border-t border-obsidian-700">
                  <th scope="row" className="py-1 pr-4 font-normal">
                    {longFmt.format(parse(d.date))}
                  </th>
                  <td className="py-1 pr-4 text-right tabular-nums">{num.format(d.good)}</td>
                  <td className="py-1 text-right tabular-nums">{num.format(d.bad)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
