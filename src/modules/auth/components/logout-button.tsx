"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { logoutAction } from "../actions";
import { authCopy } from "../copy";

export function LogoutButton() {
  const [state, action, pending] = useActionState(logoutAction, {});
  return (
    <form action={action}>
      <Button variant="outline" className="min-h-11 w-full" disabled={pending}>
        {pending ? authCopy.signingOut : authCopy.signOut}
      </Button>
      {state.error && <p role="alert" className="mt-2 text-sm text-destructive">{state.error}</p>}
    </form>
  );
}
