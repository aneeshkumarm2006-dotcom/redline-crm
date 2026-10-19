import Link from "next/link";
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { PersonChip } from "../avatar";
import { StatusPill, resolvePill } from "../status-pill";
import { StatusCell } from "./status-cell";
import { MoneyCell } from "./money-cell";
import { boardCopy as copy } from "./copy";
import { agingLevel, alignClass, formatBoardDate, formatMoney, formatNumber } from "./format";
import type { BoardActions, BoardCellValues, BoardColumn, BoardItem } from "./types";

type CellProps = { column: BoardColumn; item: BoardItem; subject: string; actions: BoardActions; card?: boolean };

const value = <K extends keyof BoardCellValues>(item: BoardItem, column: { id: string }) =>
  (item.values[column.id] ?? null) as BoardCellValues[K];

const empty = <span className="text-muted-foreground">{copy.none}</span>;

/** Renders one cell; the same definition drives desktop rows and stacked mobile cards. */
export function BoardCell({ column, item, subject, actions, card = false }: CellProps) {
  const padded = cn("flex min-h-11 items-center px-3 py-1.5", alignClass(column.align, column.cell), card && "min-h-0 justify-start p-0 text-left");
  switch (column.cell) {
    case "status": {
      const key = value<"status">(item, column);
      if (column.editable && actions.status) {
        return <StatusCell itemId={item.id} version={item.version} columnId={column.id} header={column.header} subject={subject}
          value={key} options={column.options} action={actions.status} fill={!card} />;
      }
      return card ? <StatusPill option={resolvePill(column.options, key)} className="min-h-7 px-3" />
        : <StatusPill option={resolvePill(column.options, key)} fill className="min-h-11" />;
    }
    case "label": {
      const label = value<"label">(item, column);
      if (!label) return card ? empty : <span className={padded}>{empty}</span>;
      if (label.color) {
        const option = { key: label.text, label: label.text, color: label.color };
        return card ? <StatusPill option={option} className="min-h-7 px-3" /> : <StatusPill option={option} fill className="min-h-11" />;
      }
      return <span className={cn(padded, "truncate")}>{label.text}</span>;
    }
    case "person": {
      const person = value<"person">(item, column);
      if (!person) return card ? empty : <span className={padded}>{empty}</span>;
      const chip = <PersonChip name={person.name} detail={person.detail} />;
      return <span className={padded}>{person.href ? <Link href={person.href} className="min-w-0 rounded hover:underline focus-visible:outline-2 focus-visible:outline-ring">{chip}</Link> : chip}</span>;
    }
    case "date": {
      const date = value<"date">(item, column);
      return <span className={cn(padded, "tabular-nums")}>{date ? <time dateTime={date}>{formatBoardDate(date, column.timeZone)}</time> : empty}</span>;
    }
    case "days": {
      const days = value<"days">(item, column);
      if (days === null) return card ? empty : <span className={padded}>{empty}</span>;
      const level = agingLevel(days, column.warnDays, column.criticalDays);
      return <span className={padded}>
        <span title={copy.daysLong(days)} className={cn("inline-flex min-h-6 items-center gap-1.5 rounded-full px-2 text-xs font-semibold tabular-nums",
          level === "critical" ? "bg-danger/12 text-danger" : level === "warn" ? "bg-warning/12 text-warning" : "bg-muted text-foreground")}>
          {level !== "ok" && <span aria-hidden className={cn("size-1.5 rounded-full", level === "critical" ? "bg-danger" : "bg-warning")} />}
          {copy.days(days)}
          {level !== "ok" && <span className="sr-only">{copy.aging[level]}</span>}
        </span>
      </span>;
    }
    case "money": {
      const money = value<"money">(item, column);
      if (column.editable && actions.money && money !== null) {
        return <MoneyCell itemId={item.id} version={item.version} columnId={column.id} header={column.header} subject={subject}
          value={money} currency={column.currency} action={actions.money} card={card} />;
      }
      return <span className={cn(padded, "font-medium tabular-nums")}>{money === null ? empty : formatMoney(money, column.currency)}</span>;
    }
    case "number": {
      const number = value<"number">(item, column);
      return <span className={cn(padded, "font-medium tabular-nums")}>{number === null ? empty : formatNumber(number, column.format)}</span>;
    }
    case "progress": {
      const progress = value<"progress">(item, column);
      if (!progress) return card ? empty : <span className={padded}>{empty}</span>;
      const percent = progress.max > 0 ? Math.min(100, Math.round((progress.value / progress.max) * 100)) : 0;
      const done = progress.max > 0 && progress.value >= progress.max;
      return <span className={cn(padded, "gap-2", card && "w-full")}>
        <span role="meter" aria-valuemin={0} aria-valuemax={progress.max} aria-valuenow={progress.value} aria-label={`${column.header}: ${progress.label ?? copy.progress(progress.value, progress.max)}`}
          className="h-2 min-w-12 flex-1 overflow-hidden rounded-full bg-chart-1/15">
          <span className={cn("block h-full rounded-full", done ? "bg-success" : "bg-chart-1")} style={{ width: `${percent}%` }} />
        </span>
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{progress.label ?? copy.progress(progress.value, progress.max)}</span>
      </span>;
    }
    case "link": {
      const link = value<"link">(item, column);
      if (!link) return <span className={padded}>{empty}</span>;
      return <Link href={link.href} className={cn("group/link flex min-h-11 min-w-0 items-center gap-3 rounded-sm px-3 py-1.5 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring", card && "p-0")}>
        {link.imageUrl !== undefined && <span className={cn("flex shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted", card ? "size-14" : "h-9 w-12")}>
          {link.imageUrl
            // Board thumbnails come from configured photo URLs without a host allowlist.
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={link.imageUrl} alt="" loading="lazy" className="size-full object-cover" />
            : <ImageOff aria-hidden className="size-4 text-muted-foreground" />}
        </span>}
        <span className="min-w-0">
          <span className={cn("block truncate font-medium group-hover/link:underline", card && "whitespace-normal text-base")}>{link.text}</span>
          {link.description && <span className="block truncate text-xs text-muted-foreground">{link.description}</span>}
        </span>
      </Link>;
    }
  }
}
