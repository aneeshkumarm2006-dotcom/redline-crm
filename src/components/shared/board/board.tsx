import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { readableForeground } from "@/lib/color";
import { resolvePill, type PillOption } from "../status-pill";
import { BoardCell } from "./cells";
import { BoardCsvButton } from "./csv-button";
import { boardCopy as copy } from "./copy";
import { alignClass, defaultWidths, formatMoney, formatNumber } from "./format";
import type { BoardActions, BoardCellValues, BoardColumn, BoardGroup, BoardItem, BoardMoneyAction, BoardStatusAction } from "./types";

type BoardProps = {
  /** Accessible name for the whole board. */
  label: string;
  columns: BoardColumn[];
  groups: BoardGroup[];
  /** Server action for editable status columns. */
  onStatusChange?: BoardStatusAction;
  /** Server action for editable money columns. */
  onMoneyChange?: BoardMoneyAction;
  hideEmptyGroups?: boolean;
  /** File name (without .csv) for an Export CSV button above the board; omitted means no export. */
  exportName?: string;
};

const width = (column: BoardColumn) => column.width ?? defaultWidths[column.cell];
const subjectOf = (item: BoardItem, columns: BoardColumn[]) => {
  const first = item.values[columns[0]?.id ?? ""];
  if (first && typeof first === "object" && "text" in first) return first.text;
  if (first && typeof first === "object" && "name" in first) return first.name;
  return typeof first === "string" ? first : item.id;
};

function moneySummary(column: BoardColumn) {
  return column.cell === "money" && column.summary !== false;
}
function numberSummary(column: BoardColumn) {
  return column.cell === "number" && column.summary !== false && column.format !== "percent";
}
function statusSummary(column: BoardColumn): column is Extract<BoardColumn, { cell: "status" }> {
  return column.cell === "status" && column.summary !== false;
}
function sumOf(items: BoardItem[], column: BoardColumn) {
  return items.reduce((total, item) => total + ((item.values[column.id] as BoardCellValues["money"]) ?? 0), 0);
}

/** Proportional bar of status values, using the settings colours, with a 2px gap between segments. */
function Distribution({ items, column }: { items: BoardItem[]; column: Extract<BoardColumn, { cell: "status" }> }) {
  const counts = new Map<string, { option: PillOption; count: number }>();
  for (const item of items) {
    const option = resolvePill(column.options, item.values[column.id] as BoardCellValues["status"]);
    if (!option) continue;
    const entry = counts.get(option.key) ?? { option, count: 0 };
    entry.count += 1;
    counts.set(option.key, entry);
  }
  const total = [...counts.values()].reduce((sum, entry) => sum + entry.count, 0);
  if (!total) return null;
  const ordered = [...column.options.map((option) => counts.get(option.key)).filter((entry) => entry !== undefined),
    ...[...counts.values()].filter((entry) => !column.options.some((option) => option.key === entry.option.key))];
  const description = ordered.map((entry) => `${entry.option.label} ${entry.count}`).join(", ");
  return <span role="img" aria-label={`${copy.distribution(column.header)}: ${description}`} title={description} className="flex h-6 w-full gap-0.5 overflow-hidden rounded-md">
    {ordered.map((entry) => <span key={entry.option.key} className="h-full" style={{ flexGrow: entry.count, flexBasis: 0, backgroundColor: entry.option.color }} />)}
  </span>;
}

function GroupSummary({ group, column }: { group: BoardGroup; column: BoardColumn }) {
  if (moneySummary(column)) {
    return <span className="block text-xs font-semibold tabular-nums">{formatMoney(sumOf(group.items, column), column.cell === "money" ? column.currency : undefined)}</span>;
  }
  if (numberSummary(column)) return <span className="block text-xs font-semibold tabular-nums">{formatNumber(sumOf(group.items, column))}</span>;
  if (statusSummary(column)) return <Distribution items={group.items} column={column} />;
  return null;
}

/** Group tint for header bands: the status colour washed into the card surface. */
const tint = (color: string, amount = 8) => `color-mix(in oklab, ${color} ${amount}%, var(--card))`;

function GroupHeading({ group, sticky }: { group: BoardGroup; sticky: boolean }) {
  return <summary aria-label={copy.toggleGroup(group.title)}
    className="flex min-h-12 cursor-pointer list-none items-center px-3 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden"
    style={{ backgroundColor: tint(group.color) }}>
    <span className={cn("flex min-w-0 items-center gap-2.5", sticky && "sticky left-3")}>
      <ChevronDown aria-hidden className="size-4 shrink-0 -rotate-90 text-muted-foreground transition-transform duration-200 group-open/group:rotate-0" />
      <span className="inline-flex min-h-7 items-center truncate rounded-full px-3 text-xs font-semibold" style={{ backgroundColor: group.color, color: readableForeground(group.color) }}>{group.title}</span>
      <span className="text-xs font-medium tabular-nums text-muted-foreground">{copy.items(group.items.length)}</span>
    </span>
  </summary>;
}

function DesktopGroup({ group, columns, actions }: { group: BoardGroup; columns: BoardColumn[]; actions: BoardActions }) {
  const tableWidth = columns.reduce((sum, column) => sum + width(column), 0);
  const hasSummary = columns.some((column) => moneySummary(column) || numberSummary(column) || statusSummary(column));
  const [first, ...rest] = columns;
  // overflow-clip keeps the rounded panel without becoming a scroll container, so sticky cells still work.
  // A fixed min-width (not w-max) keeps the table's 100% width definite; w-max made the two sizes depend on each other.
  return <details open={!group.collapsed} className="group/group overflow-clip rounded-2xl border bg-card shadow-xs" style={{ minWidth: tableWidth + 2 }}>
    <GroupHeading group={group} sticky />
    <table className="table-fixed border-separate border-spacing-0 text-sm" style={{ width: "100%", minWidth: tableWidth }}>
      <caption className="sr-only">{group.title}</caption>
      <colgroup>{columns.map((column) => <col key={column.id} style={{ width: width(column) }} />)}</colgroup>
      <thead>
        <tr>
          <th scope="col" className={cn("sticky top-0 left-0 z-30 border-y bg-card px-4 py-2.5 text-[0.6875rem] font-semibold tracking-[0.06em] text-muted-foreground uppercase", alignClass(first.align, first.cell))}>{first.header}</th>
          {rest.map((column) => <th key={column.id} scope="col" className={cn("sticky top-0 z-20 border-y border-l border-l-border/60 bg-card px-3 py-2.5 text-[0.6875rem] font-semibold tracking-[0.06em] text-muted-foreground uppercase", column.cell === "status" || column.cell === "label" ? "text-center" : alignClass(column.align, column.cell))}>{column.header}</th>)}
        </tr>
      </thead>
      <tbody>
        {group.items.length === 0 && <tr><td colSpan={columns.length} className="border-b bg-card px-4 py-4 text-muted-foreground">{copy.emptyGroup}</td></tr>}
        {group.items.map((item) => {
          const subject = subjectOf(item, columns);
          return <tr key={item.id} className="group/row">
            <th scope="row" className="sticky left-0 z-10 border-b bg-card p-0 pl-1 text-left font-normal transition-colors group-hover/row:bg-muted"><BoardCell column={first} item={item} subject={subject} actions={actions} /></th>
            {rest.map((column) => <td key={column.id} className={cn("border-b border-l border-l-border/60 bg-card p-0 transition-colors group-hover/row:bg-muted/60", (column.cell === "status" || column.cell === "label") && "p-px")}>
              <BoardCell column={column} item={item} subject={subject} actions={actions} />
            </td>)}
          </tr>;
        })}
      </tbody>
      {hasSummary && <tfoot>
        <tr>
          <th scope="row" className="sticky left-0 z-10 bg-muted/70 px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground backdrop-blur">{copy.total} · {copy.items(group.items.length)}</th>
          {rest.map((column) => <td key={column.id} className={cn("border-l border-l-border/60 bg-muted/70 px-3 py-2.5", alignClass(column.align, column.cell))}><GroupSummary group={group} column={column} /></td>)}
        </tr>
      </tfoot>}
    </table>
  </details>;
}

function MobileGroup({ group, columns, actions }: { group: BoardGroup; columns: BoardColumn[]; actions: BoardActions }) {
  const [first, ...rest] = columns;
  const fields = rest.filter((column) => !column.hideOnMobile);
  const summaries = columns.filter((column) => moneySummary(column) || numberSummary(column) || statusSummary(column));
  return <details open={!group.collapsed} className="group/group overflow-clip rounded-2xl border bg-card shadow-xs">
    <GroupHeading group={group} sticky={false} />
    {group.items.length === 0 && <p className="border-t p-4 text-sm text-muted-foreground">{copy.emptyGroup}</p>}
    <ul className="divide-y border-t">
      {group.items.map((item) => {
        const subject = subjectOf(item, columns);
        // Cards skip empty fields (e.g. repair columns on a car that is not in repair) to stay short on a phone.
        const shown = fields.filter((column) => column.cell === "status" || (item.values[column.id] ?? null) !== null);
        return <li key={item.id}>
          <div className="px-4 pt-3.5 pb-2"><BoardCell column={first} item={item} subject={subject} actions={actions} card /></div>
          {shown.length > 0 && <dl className="grid grid-cols-2 gap-x-4 gap-y-3 px-4 pt-1 pb-4">
            {shown.map((column) => <div key={column.id} className={cn("min-w-0", column.cell === "progress" && "col-span-2")}>
              <dt className="mb-1 truncate text-[0.6875rem] font-semibold tracking-[0.06em] text-muted-foreground uppercase">{column.header}</dt>
              <dd className="min-w-0 text-sm"><BoardCell column={column} item={item} subject={subject} actions={actions} card /></dd>
            </div>)}
          </dl>}
        </li>;
      })}
    </ul>
    {group.items.length > 0 && summaries.length > 0 && <dl className="grid grid-cols-2 gap-3 border-t bg-muted/60 p-4 text-xs">
      <div><dt className="text-muted-foreground">{copy.total}</dt><dd className="mt-1 font-semibold tabular-nums">{copy.items(group.items.length)}</dd></div>
      {summaries.map((column) => <div key={column.id} className={cn("min-w-0", column.cell === "status" && "col-span-2")}>
        <dt className="mb-1 truncate text-muted-foreground">{column.header}</dt><dd><GroupSummary group={group} column={column} /></dd>
      </div>)}
    </dl>}
  </details>;
}

/**
 * Monday-style board: collapsible coloured groups, sticky header and first column on desktop,
 * per-group footer summaries, and stacked cards from the same column definitions on mobile.
 */
export function Board({ label, columns, groups, onStatusChange, onMoneyChange, hideEmptyGroups = false, exportName }: BoardProps) {
  const visible = hideEmptyGroups ? groups.filter((group) => group.items.length > 0) : groups;
  const actions: BoardActions = { status: onStatusChange, money: onMoneyChange };
  if (!columns.length) return null;
  return <section aria-label={label} className="space-y-3">
    {exportName && <div className="flex justify-end"><BoardCsvButton columns={columns} groups={visible} filename={exportName} /></div>}
    <div className="scrollbar-thin hidden max-h-[calc(100dvh-10rem)] space-y-5 overflow-auto rounded-2xl pb-2 lg:block">
      {visible.map((group) => <DesktopGroup key={group.id} group={group} columns={columns} actions={actions} />)}
    </div>
    <div className="space-y-4 lg:hidden">
      {visible.map((group) => <MobileGroup key={group.id} group={group} columns={columns} actions={actions} />)}
    </div>
  </section>;
}
