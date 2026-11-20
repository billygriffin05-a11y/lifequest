import { CHART } from "@/features/honour/chart-colors";
import { formatKg } from "../rules";

const W = 640;
const H = 200;
const PAD = { l: 52, r: 16, t: 14, b: 28 };
const dayFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const label = (d: string) => dayFmt.format(new Date(`${d}T12:00:00Z`));

/** Body-weight trend (last 90 days). Single series: the heading names it, no legend. */
export function WeightChart({ points }: { points: { day: string; grams: number }[] }) {
  if (points.length < 2) {
    return <p className="mt-3 text-sm text-silver-300">Log your weight on two or more days to see a trend.</p>;
  }
  const t0 = Date.parse(points[0].day);
  const t1 = Date.parse(points[points.length - 1].day);
  const values = points.map((p) => p.grams);
  const lo = Math.floor((Math.min(...values) - 500) / 1000) * 1000;
  const hi = Math.ceil((Math.max(...values) + 500) / 1000) * 1000;
  const x = (d: string) => PAD.l + ((Date.parse(d) - t0) / Math.max(1, t1 - t0)) * (W - PAD.l - PAD.r);
  const y = (g: number) => PAD.t + (1 - (g - lo) / (hi - lo)) * (H - PAD.t - PAD.b);
  const ticks = [lo, Math.round((lo + hi) / 2 / 100) * 100, hi];
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(p.day).toFixed(1)},${y(p.grams).toFixed(1)}`).join(" ");
  const first = points[0];
  const last = points[points.length - 1];
  const change = last.grams - first.grams;

  return (
    <figure className="mt-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-labelledby="weight-desc" data-testid="weight-chart">
        <desc id="weight-desc">
          Weight from {formatKg(first.grams)} on {label(first.day)} to {formatKg(last.grams)} on {label(last.day)}.
        </desc>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} style={{ stroke: CHART.grid }} strokeWidth={1} />
            <text x={PAD.l - 8} y={y(t) + 4} textAnchor="end" fontSize={11} style={{ fill: CHART.ink }}>
              {formatKg(t)}
            </text>
          </g>
        ))}
        <text x={PAD.l} y={H - 8} fontSize={11} style={{ fill: CHART.ink }}>
          {label(first.day)}
        </text>
        <text x={W - PAD.r} y={H - 8} textAnchor="end" fontSize={11} style={{ fill: CHART.ink }}>
          {label(last.day)}
        </text>
        <path d={path} fill="none" style={{ stroke: CHART.good }} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p) => (
          <g key={p.day}>
            <circle cx={x(p.day)} cy={y(p.grams)} r={4} style={{ fill: CHART.good, stroke: CHART.surface }} strokeWidth={2} />
            {/* larger invisible hit target carries the tooltip */}
            <circle cx={x(p.day)} cy={y(p.grams)} r={12} fill="transparent">
              <title>{`${label(p.day)}: ${formatKg(p.grams)}`}</title>
            </circle>
          </g>
        ))}
      </svg>
      <figcaption className="mt-1 text-sm text-silver-300">
        {change === 0 ? "No change" : `${change > 0 ? "+" : "−"}${formatKg(Math.abs(change))}`} since {label(first.day)}.
      </figcaption>
      <details className="mt-1 text-sm">
        <summary className="min-h-11 cursor-pointer py-2 text-silver-300">Show as table</summary>
        <table className="text-silver-100">
          <thead>
            <tr>
              <th className="pr-6 text-left font-normal text-silver-300">Day</th>
              <th className="text-left font-normal text-silver-300">Weight</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.day}>
                <td className="pr-6">{label(p.day)}</td>
                <td>{formatKg(p.grams)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
