import Link from "next/link";
import { listTeam } from "@/modules/users/service";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { requirePageUser } from "../page-guards";
import { authCopy } from "../copy";

export async function TeamScreen() {
  await requirePageUser("owner");
  // The service enforces owner access independently of the page/layout.
  const team = await listTeam();
  return (
    <>
      <div><h1 className="text-2xl font-semibold">{authCopy.team}</h1>
        <p className="mt-2 text-muted-foreground">{authCopy.teamDescription}</p></div>
      <ul className="space-y-3">
        {team.map((user) => <li key={user.id}>
          <Card><CardHeader><h2 className="break-words font-semibold">{user.name}</h2></CardHeader>
            <CardContent className="space-y-2">
              <p className="break-all text-sm">{user.email}</p>
              <p className="text-sm text-muted-foreground">{authCopy.roles[user.role]} · {user.active ? authCopy.active : authCopy.inactive}</p>
            </CardContent>
          </Card>
        </li>)}
      </ul>
      <Button asChild variant="outline" className="min-h-11"><Link href="/crm">{authCopy.back}</Link></Button>
    </>
  );
}

export async function AccessDeniedScreen() {
  await requirePageUser();
  return <Card><CardHeader><h1 className="text-2xl font-semibold">{authCopy.deniedTitle}</h1></CardHeader>
    <CardContent className="space-y-5"><p>{authCopy.deniedDescription}</p>
      <Button asChild className="min-h-11"><Link href="/crm">{authCopy.back}</Link></Button>
    </CardContent></Card>;
}
