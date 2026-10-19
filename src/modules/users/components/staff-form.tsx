"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetClose, SheetTrigger } from "@/components/ui/sheet";
import { brandTheme } from "@/components/shared/app-shell/theme";
import { staffFormSchema, type User } from "../schema";
import { createSalespersonAction, updateSalespersonAction } from "../actions";
import { staffCopy as copy } from "../copy";

const controls = "min-h-11 w-full min-w-0 rounded-md border bg-background px-3 py-2 text-base";
const fieldNames = ["name", "email", "phone", "monthlyTarget", "hiredAt"] as const;

/** Owner add (no `user`) or edit sheet for a salesperson. A new account's temporary password is shown once. */
export function StaffFormSheet({ user, dealerships, primaryColor }: { user?: User; dealerships: { id: string; name: string; active: boolean }[]; primaryColor: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [created, setCreated] = useState<{ id: string; password: string } | null>(null);
  const router = useRouter();
  // The current location stays selectable even if it has since been deactivated.
  const locations = dealerships.filter((entry) => entry.active || entry.id === user?.dealershipId);
  function change(next: boolean) {
    if (pending) return;
    setOpen(next); setError(""); setFields({});
    if (!next && created) { router.push(`/crm/team/${created.id}`); setCreated(null); }
  }
  function submit(form: FormData) {
    const text = (name: string) => String(form.get(name) ?? "").trim();
    const data = {
      name: text("name"), email: text("email"), phone: text("phone") || null, dealershipId: text("dealershipId"),
      monthlyTarget: text("monthlyTarget") === "" ? null : Number(text("monthlyTarget")),
      hiredAt: text("hiredAt") ? `${text("hiredAt")}T00:00:00.000Z` : null,
    };
    const parsed = staffFormSchema.safeParse(data);
    setFields({}); setError("");
    if (!parsed.success) { setFields(Object.fromEntries(parsed.error.issues.map((issue) => [issue.path[0], issue.message]))); setError(copy.invalidForm); return; }
    startTransition(async () => {
      try {
        const result = user ? await updateSalespersonAction({ ...parsed.data, id: user.id, active: form.get("active") === "on" }) : await createSalespersonAction(parsed.data);
        if (!result.ok) { setError(result.message); return; }
        if (result.temporaryPassword) { setCreated({ id: result.id, password: result.temporaryPassword }); toast.success(copy.created); return; }
        toast.success(copy.saved);
        setOpen(false);
        router.refresh();
      } catch { setError(copy.networkError); }
    });
  }
  async function copyPassword() {
    try { await navigator.clipboard.writeText(created?.password ?? ""); toast.success(copy.copied); }
    catch { toast.error(copy.copyFailed); }
  }
  const title = user ? copy.edit : copy.add;
  return <Sheet open={open} onOpenChange={change}>
    <SheetTrigger asChild><Button variant={user ? "outline" : "default"} className="min-h-11">{title}</Button></SheetTrigger>
    <SheetContent side="bottom" showCloseButton={false} style={brandTheme(primaryColor)} className="max-h-[90dvh] overflow-y-auto rounded-t-2xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:mx-auto sm:max-w-lg">
      <SheetHeader className="p-0 pr-16"><SheetTitle>{created ? copy.passwordTitle : title}</SheetTitle><SheetDescription>{created ? copy.passwordHint : user ? copy.editHint : copy.addHint}</SheetDescription></SheetHeader>
      <SheetClose asChild><Button variant="ghost" disabled={pending} className="absolute right-2 top-2 min-h-11 min-w-11">{copy.close}</Button></SheetClose>
      {created ? <div className="space-y-4">
        <output className="block select-all break-all rounded-lg border bg-muted px-4 py-3 font-mono text-lg tracking-wide">{created.password}</output>
        <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" className="min-h-11" onClick={copyPassword}>{copy.copy}</Button><Button type="button" className="min-h-11 flex-1" onClick={() => change(false)}>{copy.done}</Button></div>
      </div> : <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); submit(new FormData(event.currentTarget)); }}>
        <fieldset disabled={pending} className="grid gap-4 sm:grid-cols-2">
          {fieldNames.map((name) => <label key={name} className={`min-w-0 space-y-2 ${name === "name" || name === "email" ? "sm:col-span-2" : ""}`}>
            <span className="text-sm font-medium">{copy.fields[name]}</span>
            <Input name={name} type={name === "email" ? "email" : name === "phone" ? "tel" : name === "monthlyTarget" ? "number" : name === "hiredAt" ? "date" : "text"}
              required={name === "name" || name === "email"} min={name === "monthlyTarget" ? 0 : undefined} max={name === "monthlyTarget" ? 1000 : undefined} step={name === "monthlyTarget" ? 1 : undefined}
              defaultValue={name === "hiredAt" ? user?.hiredAt?.slice(0, 10) ?? "" : user?.[name] ?? ""} autoComplete="off"
              className="min-h-11 text-base" aria-invalid={!!fields[name]} aria-describedby={fields[name] ? `staff-error-${name}` : undefined} />
            {fields[name] && <span id={`staff-error-${name}`} className="block text-sm text-destructive">{fields[name]}</span>}
          </label>)}
          <label className="min-w-0 space-y-2 sm:col-span-2"><span className="text-sm font-medium">{copy.fields.dealership}</span>
            <select name="dealershipId" required defaultValue={user?.dealershipId ?? ""} className={controls}>
              <option value="" disabled>{copy.chooseLocation}</option>{locations.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}{entry.active ? "" : ` (${copy.inactiveLocation})`}</option>)}
            </select>{fields.dealershipId && <span className="block text-sm text-destructive">{fields.dealershipId}</span>}</label>
          {user && <label className="flex min-h-11 cursor-pointer items-start gap-3 sm:col-span-2">
            <input type="checkbox" name="active" defaultChecked={user.active} className="mt-1 size-5 accent-primary" />
            <span><span className="block text-sm font-medium">{copy.fields.active}</span><span className="block text-xs text-muted-foreground">{copy.fields.activeHint}</span></span>
          </label>}
        </fieldset>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="min-h-11 w-full" disabled={pending}>{pending ? copy.saving : user ? copy.save : copy.create}</Button>
      </form>}
    </SheetContent>
  </Sheet>;
}
