import type { PillOption } from "../status-pill";

/**
 * A board is plain, serializable data: column definitions plus groups of items whose
 * `values` are keyed by column id. Server screens build it; client cells only edit.
 */
type ColumnBase = {
  id: string;
  header: string;
  /** Desktop width in px. Defaults per cell type. */
  width?: number;
  align?: "start" | "center" | "end";
  /** Leave out of the stacked mobile cards. */
  hideOnMobile?: boolean;
};

export type BoardColumn =
  | ColumnBase & { cell: "status"; options: PillOption[]; editable?: boolean; summary?: boolean }
  | ColumnBase & { cell: "person" }
  | ColumnBase & { cell: "date"; timeZone?: string }
  | ColumnBase & { cell: "days"; warnDays?: number; criticalDays?: number }
  | ColumnBase & { cell: "money"; currency?: string; summary?: boolean; editable?: boolean }
  | ColumnBase & { cell: "label" }
  // Counts sum in the group footer; percentages (0–1) never do.
  | ColumnBase & { cell: "number"; format?: "number" | "percent"; summary?: boolean }
  | ColumnBase & { cell: "link" }
  | ColumnBase & { cell: "progress" };

export type BoardCellType = BoardColumn["cell"];

export type BoardCellValues = {
  status: string | null;
  person: { name: string; detail?: string; href?: string } | null;
  date: string | null;
  days: number | null;
  money: number | null;
  label: { text: string; color?: string } | null;
  link: { text: string; href: string; description?: string; imageUrl?: string | null } | null;
  number: number | null;
  // `label` replaces the default "value of max" text, e.g. when there is no target.
  progress: { value: number; max: number; label?: string } | null;
};
export type BoardCellValue = BoardCellValues[BoardCellType];

export type BoardItem = {
  id: string;
  /** Optimistic-concurrency token passed back to edit actions (e.g. a document revision). */
  version?: number;
  values: Record<string, BoardCellValue | undefined>;
};

export type BoardGroup = {
  id: string;
  title: string;
  color: string;
  items: BoardItem[];
  collapsed?: boolean;
};

export type BoardStatusChange = { itemId: string; version?: number; columnId: string; value: string };
export type BoardMoneyChange = { itemId: string; version?: number; columnId: string; value: number };
/** `href` on a failure sends the user to a screen that can make the change instead (e.g. a form it needs). */
export type BoardActionResult = { ok: true; warning?: string } | { ok: false; message: string; href?: string };
/** A server action that applies one inline status edit. */
export type BoardStatusAction = (input: BoardStatusChange) => Promise<BoardActionResult>;
/** A server action that applies one inline money edit. */
export type BoardMoneyAction = (input: BoardMoneyChange) => Promise<BoardActionResult>;
export type BoardActions = { status?: BoardStatusAction; money?: BoardMoneyAction };
