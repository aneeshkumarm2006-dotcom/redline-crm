import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { requirePageUser } from "../page-guards";
import { authCopy } from "../copy";

export async function AccessDeniedScreen() {
  await requirePageUser();
  return <Card><CardHeader><h1 className="text-2xl font-semibold">{authCopy.deniedTitle}</h1></CardHeader>
    <CardContent className="space-y-5"><p>{authCopy.deniedDescription}</p>
      <Button asChild className="min-h-11"><Link href="/crm">{authCopy.back}</Link></Button>
    </CardContent></Card>;
}
