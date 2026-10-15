"use client";
import { Button } from "@/components/ui/button";
import { inventoryCopy } from "@/modules/inventory/copy";
export default function Error({ reset }: { reset: () => void }) { return <div role="alert" className="space-y-4"><p>{inventoryCopy.error}</p><Button onClick={reset} className="min-h-11">{inventoryCopy.retry}</Button></div>; }
