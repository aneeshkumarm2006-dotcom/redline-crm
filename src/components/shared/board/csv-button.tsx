"use client";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { boardCopy as copy } from "./copy";
import { boardCsv } from "./csv";
import type { BoardColumn, BoardGroup } from "./types";

/** Downloads exactly what the board shows (its current filters and groups) as a CSV file. */
export function BoardCsvButton({ columns, groups, filename }: { columns: BoardColumn[]; groups: BoardGroup[]; filename: string }) {
  function download() {
    const url = URL.createObjectURL(new Blob([boardCsv(columns, groups)], { type: "text/csv;charset=utf-8" }));
    const link = Object.assign(document.createElement("a"), { href: url, download: `${filename}.csv` });
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <Button type="button" variant="outline" className="min-h-11 gap-2" onClick={download}><Download aria-hidden className="size-4" />{copy.exportCsv}</Button>;
}
