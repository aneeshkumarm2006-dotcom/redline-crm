"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginAction } from "../actions";
import { authCopy } from "../copy";

export function LoginForm({ returnTo }: { returnTo: string }) {
  const [state, action, pending] = useActionState(loginAction, {});
  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="returnTo" value={returnTo} />
      <div className="space-y-2">
        <Label htmlFor="email">{authCopy.email}</Label>
        <Input id="email" name="email" type="email" autoComplete="username" autoCapitalize="none"
          spellCheck={false} maxLength={254} required className="h-12 rounded-xl px-4 text-base md:text-base"
          aria-describedby={state.error ? "login-error" : undefined} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">{authCopy.password}</Label>
        <Input id="password" name="password" type="password" autoComplete="current-password"
          maxLength={72} required className="h-12 rounded-xl px-4 text-base md:text-base"
          aria-describedby={state.error ? "login-error" : undefined} />
      </div>
      {state.error && <p id="login-error" role="alert" className="text-sm font-medium text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending} className="h-12 w-full rounded-xl text-[0.9375rem] shadow-[0_6px_16px_-6px_color-mix(in_oklab,var(--primary)_70%,transparent)]">
        {pending ? authCopy.signingIn : authCopy.signIn}
      </Button>
    </form>
  );
}
