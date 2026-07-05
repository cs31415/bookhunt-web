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

const HOVER_OFFSET = 8;

export function PieChart({ slices, onPick, size = 160 }: PieChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  const radius = size / 2;
  const center = size / 2;

  const arcs = slices.reduce<
    { slice: PieSlice; index: number; startAngle: number; endAngle: number }[]
  >((acc, slice, index) => {
    const startAngle = acc.length > 0 ? acc[acc.length - 1].endAngle : 0;
    const endAngle = total > 0 ? startAngle + (slice.value / total) * 2 * Math.PI : startAngle;
    acc.push({ slice, index, startAngle, endAngle });
    return acc;
  }, []);

  return (
    <svg
      className={styles.chart}
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      role="img"
      aria-label="Pie chart"
    >
      {arcs.map(({ slice, index, startAngle, endAngle }) => {
        const isHovered = hoveredIndex === index;
        const isDimmed = hoveredIndex != null && !isHovered;
        const mid = midAngle(startAngle, endAngle);
        const offsetX = isHovered ? Math.sin(mid) * HOVER_OFFSET : 0;
        const offsetY = isHovered ? -Math.cos(mid) * HOVER_OFFSET : 0;

        return (
          <path
            key={slice.label}
            d={arcPath(center, center, radius - 2, startAngle, endAngle)}
            fill={slice.color ?? DEFAULT_PIE_COLORS[index % DEFAULT_PIE_COLORS.length]}
            className={styles.slice}
            style={{
              transform: `translate(${offsetX}px, ${offsetY}px)`,
              opacity: isDimmed ? 0.6 : 1,
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
  );
}
