"use client";
import { Button } from "@/components/ui/button";
import { dashboardCopy } from "@/modules/dashboard/copy";
export default function Error({ reset }: { reset: () => void }) { return <div role="alert" className="space-y-4"><p>{dashboardCopy.error}</p><Button onClick={reset} className="min-h-11">{dashboardCopy.retry}</Button></div>; }
