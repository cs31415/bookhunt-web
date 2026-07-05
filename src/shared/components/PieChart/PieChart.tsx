import { useState } from 'react';
import { arcPath, DEFAULT_PIE_COLORS, midAngle } from '../../lib/colors';
import styles from './PieChart.module.css';

export interface PieSlice {
  label: string;
  value: number;
  color?: string;
}

export interface PieChartProps {
  slices: PieSlice[];
  onPick?: (slice: PieSlice) => void;
  size?: number;
}

const HOVER_OFFSET = 6;
const PAD = 10;

export function PieChart({ slices, onPick, size = 168 }: PieChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  const radius = size / 2;
  const center = radius + PAD;
  const box = size + PAD * 2;

  const arcs = slices.reduce<
    { slice: PieSlice; index: number; startAngle: number; endAngle: number; color: string }[]
  >((acc, slice, index) => {
    const startAngle = acc.length > 0 ? acc[acc.length - 1].endAngle : 0;
    const endAngle = total > 0 ? startAngle + (slice.value / total) * 2 * Math.PI : startAngle;
    const color = slice.color ?? DEFAULT_PIE_COLORS[index % DEFAULT_PIE_COLORS.length];
    acc.push({ slice, index, startAngle, endAngle, color });
    return acc;
  }, []);

  return (
    <div className={styles.wrap}>
      <svg
        className={styles.chart}
        viewBox={`0 0 ${box} ${box}`}
        width={box}
        height={box}
        role="img"
        aria-label="Pie chart"
      >
        {arcs.map(({ slice, index, startAngle, endAngle, color }) => {
          const isHovered = hoveredIndex === index;
          const isDimmed = hoveredIndex != null && !isHovered;
          const mid = midAngle(startAngle, endAngle);
          const offsetX = isHovered ? Math.sin(mid) * HOVER_OFFSET : 0;
          const offsetY = isHovered ? -Math.cos(mid) * HOVER_OFFSET : 0;
          // A single 100% slice degenerates to a zero-length arc (start === end) — draw a circle instead.
          const isFullCircle = arcs.length === 1;

          return (
            <path
              key={slice.label}
              d={
                isFullCircle
                  ? `M ${center - radius} ${center} A ${radius} ${radius} 0 1 1 ${center + radius} ${center} A ${radius} ${radius} 0 1 1 ${center - radius} ${center} Z`
                  : arcPath(center, center, radius, startAngle, endAngle)
              }
              fill={color}
              className={styles.slice}
              style={{
                transform: `translate(${offsetX}px, ${offsetY}px)`,
                opacity: isDimmed ? 0.55 : 1,
              }}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
              onClick={() => onPick?.(slice)}
            >
              <title>{`${slice.label}: ${slice.value}`}</title>
            </path>
          );
        })}
      </svg>
      <div className={styles.legend}>
        {arcs.map(({ slice, index, color }) => (
          <div
            key={slice.label}
            className={styles.legendRow}
            style={{ opacity: hoveredIndex != null && hoveredIndex !== index ? 0.5 : 1 }}
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
            onClick={() => onPick?.(slice)}
          >
            <span className={styles.swatch} style={{ background: color }} />
            <span className={styles.legendLabel}>{slice.label}</span>
            <span className={styles.legendValue}>{slice.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
