"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DropdownField } from "@/components/ui/dropdown-field";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetClose, SheetTrigger } from "@/components/ui/sheet";
import { brandTheme } from "@/components/shared/app-shell/theme";
import { staffFormSchema, type User } from "../schema";
import { createSalespersonAction, updateSalespersonAction } from "../actions";
import { staffCopy as copy } from "../copy";

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
    <SheetTrigger asChild><Button variant={user ? "outline" : "default"} className="min-h-11 gap-2">{!user && <UserPlus aria-hidden className="size-4" />}{title}</Button></SheetTrigger>
    <SheetContent side="bottom" showCloseButton={false} style={brandTheme(primaryColor)} className="max-h-[90dvh] gap-5 overflow-y-auto rounded-t-[1.25rem] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-xl sm:mx-auto sm:max-w-xl sm:p-6">
      <SheetHeader className="p-0 pr-16"><SheetTitle className="text-xl font-semibold tracking-tight">{created ? copy.passwordTitle : title}</SheetTitle><SheetDescription>{created ? copy.passwordHint : user ? copy.editHint : copy.addHint}</SheetDescription></SheetHeader>
      <SheetClose asChild><Button variant="ghost" disabled={pending} className="absolute right-3 top-3 min-h-11 min-w-11 rounded-xl">{copy.close}</Button></SheetClose>
      {created ? <div className="space-y-4">
        <output className="block select-all break-all rounded-xl border border-dashed bg-muted/60 px-4 py-4 text-center font-mono text-xl font-semibold tracking-wider">{created.password}</output>
        <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" className="min-h-11" onClick={copyPassword}>{copy.copy}</Button><Button type="button" className="min-h-11 flex-1" onClick={() => change(false)}>{copy.done}</Button></div>
      </div> : <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); submit(new FormData(event.currentTarget)); }}>
        <fieldset disabled={pending} className="grid gap-4 rounded-2xl border bg-card p-4 shadow-xs sm:grid-cols-2 sm:p-5">
          {fieldNames.map((name) => <label key={name} className={cn("min-w-0 space-y-2", (name === "name" || name === "email") && "sm:col-span-2")}>
            <span className="block text-sm font-medium">{copy.fields[name]}</span>
            <Input name={name} type={name === "email" ? "email" : name === "phone" ? "tel" : name === "monthlyTarget" ? "number" : name === "hiredAt" ? "date" : "text"}
              required={name === "name" || name === "email"} min={name === "monthlyTarget" ? 0 : undefined} max={name === "monthlyTarget" ? 1000 : undefined} step={name === "monthlyTarget" ? 1 : undefined}
              defaultValue={name === "hiredAt" ? user?.hiredAt?.slice(0, 10) ?? "" : user?.[name] ?? ""} autoComplete="off"
              className="min-h-11 text-base md:text-sm" aria-invalid={!!fields[name]} aria-describedby={fields[name] ? `staff-error-${name}` : undefined} />
            {fields[name] && <span id={`staff-error-${name}`} className="block text-sm text-destructive">{fields[name]}</span>}
          </label>)}
          <label className="min-w-0 space-y-2 sm:col-span-2"><span className="block text-sm font-medium">{copy.fields.dealership}</span>
            <DropdownField name="dealershipId" required defaultValue={user?.dealershipId ?? ""} placeholder={copy.chooseLocation}
              options={locations.map((entry) => ({ value: entry.id, label: `${entry.name}${entry.active ? "" : ` (${copy.inactiveLocation})`}` }))} />{fields.dealershipId && <span className="block text-sm text-destructive">{fields.dealershipId}</span>}</label>
          {user && <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border bg-muted/40 p-3.5 transition-colors hover:bg-muted/70 has-focus-visible:outline-2 has-focus-visible:outline-ring sm:col-span-2">
            <input type="checkbox" name="active" defaultChecked={user.active} className="mt-0.5 size-5 shrink-0 accent-primary" />
            <span><span className="block text-sm font-medium">{copy.fields.active}</span><span className="block text-xs text-muted-foreground">{copy.fields.activeHint}</span></span>
          </label>}
        </fieldset>
        {error && <p role="alert" className="rounded-lg bg-destructive/10 px-3.5 py-2.5 text-sm font-medium text-destructive">{error}</p>}
        <Button type="submit" className="min-h-11 w-full" disabled={pending}>{pending ? copy.saving : user ? copy.save : copy.create}</Button>
      </form>}
    </SheetContent>
  </Sheet>;
}
