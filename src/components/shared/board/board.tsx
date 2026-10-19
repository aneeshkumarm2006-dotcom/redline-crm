import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
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

const EDGE = 6;
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

function GroupHeading({ group, sticky }: { group: BoardGroup; sticky: boolean }) {
  return <summary aria-label={copy.toggleGroup(group.title)}
    className={cn("flex min-h-11 w-max max-w-full cursor-pointer list-none items-center gap-2 rounded-lg pr-3 text-base font-semibold focus-visible:outline-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden", sticky && "sticky left-0 z-30")}>
    <ChevronDown aria-hidden className="size-4 shrink-0 -rotate-90 transition-transform group-open/group:rotate-0" style={{ color: group.color }} />
    <span className="truncate" style={{ color: group.color }}>{group.title}</span>
    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">{copy.items(group.items.length)}</span>
  </summary>;
}

function DesktopGroup({ group, columns, actions }: { group: BoardGroup; columns: BoardColumn[]; actions: BoardActions }) {
  const tableWidth = EDGE + columns.reduce((sum, column) => sum + width(column), 0);
  const hasSummary = columns.some((column) => moneySummary(column) || numberSummary(column) || statusSummary(column));
  const edge = { backgroundColor: group.color };
  const [first, ...rest] = columns;
  return <details open={!group.collapsed} className="group/group">
    <GroupHeading group={group} sticky />
    <table className="mt-1 table-fixed border-separate border-spacing-0 text-sm" style={{ width: tableWidth }}>
      <caption className="sr-only">{group.title}</caption>
      <colgroup><col style={{ width: EDGE }} />{columns.map((column) => <col key={column.id} style={{ width: width(column) }} />)}</colgroup>
      <thead>
        <tr>
          <th aria-hidden className="sticky top-0 left-0 z-30 rounded-tl-lg p-0" style={edge} />
          <th scope="col" style={{ left: EDGE }} className={cn("sticky top-0 z-30 border-y border-r bg-card px-3 py-2 text-xs font-medium text-muted-foreground", alignClass(first.align, first.cell))}>{first.header}</th>
          {rest.map((column) => <th key={column.id} scope="col" className={cn("sticky top-0 z-20 border-y border-r bg-card px-3 py-2 text-xs font-medium text-muted-foreground last:rounded-tr-lg", column.cell === "status" || column.cell === "label" ? "text-center" : alignClass(column.align, column.cell))}>{column.header}</th>)}
        </tr>
      </thead>
      <tbody>
        {group.items.length === 0 && <tr><td aria-hidden className="sticky left-0 z-10 p-0" style={edge} /><td colSpan={columns.length} className="border-r border-b bg-card px-3 py-3 text-muted-foreground">{copy.emptyGroup}</td></tr>}
        {group.items.map((item) => {
          const subject = subjectOf(item, columns);
          return <tr key={item.id} className="group/row">
            <td aria-hidden className="sticky left-0 z-10 p-0" style={edge} />
            <th scope="row" style={{ left: EDGE }} className="sticky z-10 border-r border-b bg-card p-0 text-left font-normal group-hover/row:bg-muted"><BoardCell column={first} item={item} subject={subject} actions={actions} /></th>
            {rest.map((column) => <td key={column.id} className={cn("border-r border-b bg-card p-0 group-hover/row:bg-muted/60", (column.cell === "status" || column.cell === "label") && "p-px")}>
              <BoardCell column={column} item={item} subject={subject} actions={actions} />
            </td>)}
          </tr>;
        })}
      </tbody>
      {hasSummary && <tfoot>
        <tr>
          <td aria-hidden className="p-0" />
          <th scope="row" style={{ left: EDGE }} className="sticky z-10 rounded-bl-lg border-r border-b border-l bg-muted px-3 py-2 text-left text-xs font-medium text-muted-foreground">{copy.total} · {copy.items(group.items.length)}</th>
          {rest.map((column) => <td key={column.id} className={cn("border-r border-b bg-muted px-3 py-2 last:rounded-br-lg", alignClass(column.align, column.cell))}><GroupSummary group={group} column={column} /></td>)}
        </tr>
      </tfoot>}
    </table>
  </details>;
}

function MobileGroup({ group, columns, actions }: { group: BoardGroup; columns: BoardColumn[]; actions: BoardActions }) {
  const [first, ...rest] = columns;
  const fields = rest.filter((column) => !column.hideOnMobile);
  const summaries = columns.filter((column) => moneySummary(column) || numberSummary(column) || statusSummary(column));
  return <details open={!group.collapsed} className="group/group space-y-2">
    <GroupHeading group={group} sticky={false} />
    {group.items.length === 0 && <p className="rounded-xl border border-dashed bg-card p-4 text-sm text-muted-foreground">{copy.emptyGroup}</p>}
    <ul className="space-y-2">
      {group.items.map((item) => {
        const subject = subjectOf(item, columns);
        // Cards skip empty fields (e.g. repair columns on a car that is not in repair) to stay short on a phone.
        const shown = fields.filter((column) => column.cell === "status" || (item.values[column.id] ?? null) !== null);
        return <li key={item.id} className="overflow-hidden rounded-xl border border-l-[6px] bg-card shadow-xs" style={{ borderLeftColor: group.color }}>
          <div className="p-3"><BoardCell column={first} item={item} subject={subject} actions={actions} card /></div>
          {shown.length > 0 && <dl className="grid grid-cols-2 gap-x-3 gap-y-3 border-t px-3 py-3">
            {shown.map((column) => <div key={column.id} className={cn("min-w-0", column.cell === "progress" && "col-span-2")}>
              <dt className="mb-1 truncate text-xs text-muted-foreground">{column.header}</dt>
              <dd className="min-w-0 text-sm"><BoardCell column={column} item={item} subject={subject} actions={actions} card /></dd>
            </div>)}
          </dl>}
        </li>;
      })}
    </ul>
    {group.items.length > 0 && summaries.length > 0 && <dl className="grid grid-cols-2 gap-3 rounded-xl border bg-surface-raised p-3 text-xs">
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
    <div className="scrollbar-thin hidden max-h-[calc(100dvh-11rem)] space-y-6 overflow-auto rounded-xl pb-2 lg:block">
      {visible.map((group) => <DesktopGroup key={group.id} group={group} columns={columns} actions={actions} />)}
    </div>
    <div className="space-y-6 lg:hidden">
      {visible.map((group) => <MobileGroup key={group.id} group={group} columns={columns} actions={actions} />)}
    </div>
  </section>;
}
