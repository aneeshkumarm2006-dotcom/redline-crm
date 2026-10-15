"use client";
import { Button } from "@/components/ui/button";
import { leadsCopy } from "@/modules/leads/copy";
export default function Error({ reset }: { reset: () => void }) { return <div role="alert" className="space-y-4"><p>{leadsCopy.error}</p><Button onClick={reset} className="min-h-11">{leadsCopy.retry}</Button></div>; }
