import type { ValueFormat } from "./format";

/** A series; `color` comes from settings (status/stage colours) or falls back to the theme order. */
export type ChartSeries = { key: string; label: string; color?: string };

/** One category on the x axis (or one slice). `href` links the mark to its filtered board. */
export type ChartDatum = { label: string; href?: string; values: Record<string, number>;
  /** Per-category colour for single-series bars (e.g. aging buckets); ignored with several series. */
  color?: string };

export type CartesianChartProps = {
  /** Accessible title; also the caption of the hidden data table. */
  title: string;
  data: ChartDatum[];
  series: ChartSeries[];
  format?: ValueFormat;
  height?: number;
};

export type Segment = { key: string; label: string; value: number; color?: string; href?: string };
