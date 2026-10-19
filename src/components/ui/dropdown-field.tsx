"use client";

import { useRef, useState } from "react";
import { CalendarDays, CarFront, Check, ChevronDown, Clock, MapPin, SlidersHorizontal, Tag, User, type LucideIcon } from "lucide-react";
import { Select as SelectPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

export type DropdownOption = { value: string; label: string; hint?: string; count?: number; disabled?: boolean };

/** Icon names, not components, so server components can pass them. */
const icons = { car: CarFront, location: MapPin, price: Tag, sort: SlidersHorizontal, calendar: CalendarDays, time: Clock, person: User } satisfies Record<string, LucideIcon>;
export type DropdownIcon = keyof typeof icons;

// Radix items cannot use "" as a value; this stands in for an option whose value is "" (e.g. "All locations").
const NONE = "__none__";
const toRadix = (value: string) => value || NONE;
const fromRadix = (value: string) => value === NONE ? "" : value;

type Props = {
  options: DropdownOption[];
  /** Form field name. The value is submitted through a real (visually hidden) input, so FormData and GET forms work. */
  name?: string;
  /** Visible label inside the trigger (`field`) or the accessible name; omit when an enclosing <label> names it. */
  label?: string;
  value?: string; defaultValue?: string; onValueChange?: (value: string) => void;
  /** Shown while no option is chosen (e.g. "Choose…"). */
  placeholder?: string;
  required?: boolean; disabled?: boolean;
  icon?: DropdownIcon;
  /** `input`: a form control under its own label. `field`: label + value tile (search bars). `pill`: compact toolbar control. */
  variant?: "input" | "field" | "pill";
  /** Submits the surrounding form after a change (filters and sort controls). */
  submitOnChange?: boolean;
  className?: string; id?: string;
  "aria-describedby"?: string; "aria-invalid"?: boolean | "true" | "false";
};

/**
 * Branded dropdown: Radix Select (keyboard, typeahead, screen-reader listbox) with a custom panel. It works
 * uncontrolled (`defaultValue`) or controlled (`value` + `onValueChange`), and submits like a native select.
 * `required` is enforced by the browser through the hidden input, which also anchors the validation message.
 */
export function DropdownField({ options, name, label, value, defaultValue = "", onValueChange, placeholder, required, disabled, icon, variant = "input",
  submitOnChange = false, className, id, ...aria }: Props) {
  const Icon = icon ? icons[icon] : null;
  const [inner, setInner] = useState(defaultValue);
  const current = value ?? inner;
  const input = useRef<HTMLInputElement>(null);
  const known = options.some((option) => option.value === current);
  const selected = options.find((option) => option.value === current);
  const change = (next: string) => {
    const plain = fromRadix(next);
    if (value === undefined) setInner(plain);
    onValueChange?.(plain);
    if (submitOnChange) requestAnimationFrame(() => input.current?.form?.requestSubmit());
  };
  return <span className={cn("relative block min-w-0", variant !== "input" && "w-full", variant === "pill" && "w-auto")}>
    <SelectPrimitive.Root value={known ? toRadix(current) : ""} onValueChange={change} disabled={disabled}>
      <SelectPrimitive.Trigger id={id} aria-label={label} aria-required={required || undefined} {...aria}
        className={cn("group flex w-full min-w-0 cursor-pointer items-center gap-3 text-left outline-none transition-[background-color,border-color,box-shadow] duration-150 focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive",
          variant === "field" && "min-h-16 rounded-[1.125rem] px-4 py-2.5 hover:bg-muted/70 data-[state=open]:bg-muted/70",
          variant === "pill" && "min-h-11 rounded-xl border border-input bg-card px-3.5 text-sm font-semibold shadow-xs hover:border-foreground/25 data-[state=open]:border-foreground/25",
          variant === "input" && "min-h-11 rounded-lg border border-input bg-card px-3 text-base shadow-xs hover:border-foreground/25 data-[state=open]:border-ring data-[state=open]:ring-[3px] data-[state=open]:ring-ring/30 md:text-sm",
          className)}>
        {Icon && <span aria-hidden className={cn("flex shrink-0 items-center justify-center text-muted-foreground", variant === "field" && "size-10 rounded-xl bg-muted group-hover:bg-card")}><Icon className="size-[1.125rem]" /></span>}
        <span className="min-w-0 flex-1">
          {variant === "field" && label && <span className="eyebrow block">{label}</span>}
          <span className={cn("block truncate", variant === "field" && "mt-0.5 text-[0.9375rem] font-semibold", !selected && "text-muted-foreground")}>
            {selected?.label ?? placeholder ?? "—"}
          </span>
        </span>
        <ChevronDown aria-hidden className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content position="popper" sideOffset={6} align="start" collisionPadding={12}
          className="z-50 max-h-[min(24rem,var(--radix-select-content-available-height))] min-w-[max(var(--radix-select-trigger-width),12rem)] overflow-hidden rounded-2xl border bg-popover p-1.5 text-popover-foreground shadow-xl data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2">
          <SelectPrimitive.Viewport className="scrollbar-thin max-h-[22rem] overflow-y-auto">
            {options.map((option) => <SelectPrimitive.Item key={toRadix(option.value)} value={toRadix(option.value)} disabled={option.disabled}
              className="relative flex min-h-11 cursor-pointer select-none items-center gap-3 rounded-xl py-2 pr-3 pl-9 text-sm outline-none transition-colors data-[disabled]:cursor-not-allowed data-[disabled]:opacity-45 data-[highlighted]:bg-muted data-[state=checked]:font-semibold">
              <SelectPrimitive.ItemIndicator className="absolute left-3 flex items-center text-primary"><Check aria-hidden className="size-4" /></SelectPrimitive.ItemIndicator>
              <span className="min-w-0 flex-1">
                <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                {option.hint && <span className="block truncate text-xs font-normal text-muted-foreground">{option.hint}</span>}
              </span>
              {option.count !== undefined && <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground">{option.count}</span>}
            </SelectPrimitive.Item>)}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
    {/* The submitted value. Not type="hidden", so `required` triggers the browser's own validation message here. */}
    {name && <input ref={input} name={name} value={current} required={required} disabled={disabled} onChange={() => {}} tabIndex={-1} aria-hidden
      className="pointer-events-none absolute inset-x-0 bottom-0 h-px w-full opacity-0" />}
  </span>;
}
