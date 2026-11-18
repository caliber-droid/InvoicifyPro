import React, { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { formatCompactUsd, formatUsd } from '../lib/money';

export interface MonthlyTrendPoint {
  label: string;
  revenueCents: number;
  collectedCents: number;
  expensesCents: number;
}

export const RevenueTrendChart: React.FC<{ data: MonthlyTrendPoint[]; height?: number }> = ({
  data,
  height = 240,
}) => {
  const reduced = useReducedMotion();
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (data.length === 0) {
    return (
      <div className="h-[240px] flex items-center justify-center text-sm text-slate-400">
        No trend data in the selected range.
      </div>
    );
  }

  const width = 640;
  const padLeft = 58;
  const padRight = 20;
  const padTop = 20;
  const padBottom = 34;
  const innerW = width - padLeft - padRight;
  const innerH = height - padTop - padBottom;

  const maxVal = Math.max(
    10000,
    ...data.flatMap((d) => [d.revenueCents, d.collectedCents, d.expensesCents])
  );

  const xAt = (i: number) =>
    data.length === 1 ? padLeft + innerW / 2 : padLeft + (i / (data.length - 1)) * innerW;
  const yAt = (cents: number) => padTop + innerH - (cents / maxVal) * innerH;

  const buildPath = (vals: number[]) =>
    vals.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i).toFixed(1)} ${yAt(v).toFixed(1)}`).join(' ');

  const collectedPath = buildPath(data.map((d) => d.collectedCents));
  const revenuePath = buildPath(data.map((d) => d.revenueCents));
  const areaPath =
    data.length > 0
      ? `${collectedPath} L ${xAt(data.length - 1).toFixed(1)} ${(padTop + innerH).toFixed(1)} L ${xAt(0).toFixed(1)} ${(padTop + innerH).toFixed(1)} Z`
      : '';

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((r) => Math.round(maxVal * r));

  return (
    <div className="relative w-full">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible">
        <defs>
          <linearGradient id="invoicifyAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2563EB" stopOpacity="0.24" />
            <stop offset="100%" stopColor="#2563EB" stopOpacity="0.01" />
          </linearGradient>
        </defs>

        {yTicks.map((tick, idx) => {
          const y = yAt(tick);
          return (
            <g key={idx}>
              <line x1={padLeft} y1={y} x2={width - padRight} y2={y} stroke="#E2E8F0" strokeDasharray="3 3" />
              <text
                x={padLeft - 10}
                y={y + 4}
                textAnchor="end"
                className="fill-slate-400 text-[10px] font-mono tabular-nums"
              >
                {formatCompactUsd(tick)}
              </text>
            </g>
          );
        })}

        {areaPath && (
          <motion.path
            d={areaPath}
            fill="url(#invoicifyAreaGrad)"
            initial={reduced ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.45 }}
          />
        )}

        <motion.path
          d={revenuePath}
          fill="none"
          stroke="#94A3B8"
          strokeWidth={2}
          strokeDasharray="4 4"
          initial={reduced ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        />

        <motion.path
          d={collectedPath}
          fill="none"
          stroke="#2563EB"
          strokeWidth={2.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={reduced ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        />

        {data.map((pt, idx) => {
          const cx = xAt(idx);
          const cy = yAt(pt.collectedCents);
          const isHover = hoveredIdx === idx;
          return (
            <g
              key={pt.label}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              className="cursor-pointer"
            >
              <rect x={cx - 18} y={padTop} width={36} height={innerH + 20} fill="transparent" />
              {isHover && (
                <line x1={cx} y1={padTop} x2={cx} y2={padTop + innerH} stroke="#CBD5E1" strokeWidth={1} />
              )}
              <circle
                cx={cx}
                cy={cy}
                r={isHover ? 5.5 : 3.5}
                fill="#FFFFFF"
                stroke="#2563EB"
                strokeWidth={2.5}
              />
              <text
                x={cx}
                y={height - 10}
                textAnchor="middle"
                className="fill-slate-500 text-[10.5px] font-medium"
              >
                {pt.label}
              </text>
            </g>
          );
        })}
      </svg>

      {hoveredIdx !== null && data[hoveredIdx] && (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-4 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs">
          <span className="font-semibold text-[#172033]">{data[hoveredIdx].label}</span>
          <div className="flex flex-wrap items-center gap-4 tabular-nums">
            <span className="text-slate-600">
              Invoiced: <strong className="text-[#172033]">{formatUsd(data[hoveredIdx].revenueCents)}</strong>
            </span>
            <span className="text-[#2563EB]">
              Collected: <strong>{formatUsd(data[hoveredIdx].collectedCents)}</strong>
            </span>
            <span className="text-amber-700">
              Expenses: <strong>{formatUsd(data[hoveredIdx].expensesCents)}</strong>
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export const BarComparisonChart: React.FC<{
  items: Array<{ label: string; valueCents: number; color: string }>;
}> = ({ items }) => {
  const reduced = useReducedMotion();
  const max = Math.max(100, ...items.map((i) => i.valueCents));

  return (
    <div className="space-y-3.5">
      {items.map((item) => {
        const pct = Math.min(100, Math.round((item.valueCents / max) * 100));
        return (
          <div key={item.label} className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-700 truncate pr-3">{item.label}</span>
              <span className="font-mono font-medium text-[#172033] tabular-nums shrink-0">
                {formatUsd(item.valueCents)}
              </span>
            </div>
            <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
              <motion.div
                initial={reduced ? false : { scaleX: 0 }}
                animate={{ scaleX: pct / 100 }}
                transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                style={{ transformOrigin: 'left center', backgroundColor: item.color }}
                className="h-full w-full rounded-full"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

export const ForecastChart: React.FC<{
  points: Array<{ label: string; actualCents: number; projectedCents: number; lowCents: number; highCents: number }>;
}> = ({ points }) => {
  const reduced = useReducedMotion();
  if (points.length === 0) return null;

  const width = 620;
  const height = 210;
  const padL = 58;
  const padR = 20;
  const padT = 18;
  const padB = 30;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const maxVal = Math.max(10000, ...points.flatMap((p) => [p.actualCents, p.highCents, p.projectedCents]));

  const xAt = (i: number) => (points.length === 1 ? padL + innerW / 2 : padL + (i / (points.length - 1)) * innerW);
  const yAt = (v: number) => padT + innerH - (v / maxVal) * innerH;

  const bandTop = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i).toFixed(1)} ${yAt(p.highCents).toFixed(1)}`).join(' ');
  const bandBottom = [...points]
    .reverse()
    .map((p, idx) => `L ${xAt(points.length - 1 - idx).toFixed(1)} ${yAt(p.lowCents).toFixed(1)}`)
    .join(' ');
  const bandPath = `${bandTop} ${bandBottom} Z`;

  const projectedLine = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i).toFixed(1)} ${yAt(p.projectedCents).toFixed(1)}`)
    .join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible">
      {[0, 0.5, 1].map((r, i) => {
        const val = Math.round(maxVal * r);
        const y = yAt(val);
        return (
          <g key={i}>
            <line x1={padL} y1={y} x2={width - padR} y2={y} stroke="#E2E8F0" strokeDasharray="3 3" />
            <text x={padL - 8} y={y + 4} textAnchor="end" className="fill-slate-400 text-[10px] font-mono tabular-nums">
              {formatCompactUsd(val)}
            </text>
          </g>
        );
      })}
      <motion.path
        d={bandPath}
        fill="#38BDF8"
        fillOpacity={0.18}
        initial={reduced ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.45 }}
      />
      <motion.path
        d={projectedLine}
        fill="none"
        stroke="#0284C7"
        strokeWidth={2.5}
        strokeDasharray="6 4"
        initial={reduced ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.65 }}
      />
      {points.map((p, idx) => (
        <g key={p.label}>
          <circle cx={xAt(idx)} cy={yAt(p.projectedCents)} r={4} fill="#FFFFFF" stroke="#0284C7" strokeWidth={2.5} />
          <text x={xAt(idx)} y={height - 8} textAnchor="middle" className="fill-slate-500 text-[10px]">
            {p.label}
          </text>
        </g>
      ))}
    </svg>
  );
};
