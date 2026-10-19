# Redline CRM — Design System (MASTER)

Source of truth for the premium redesign. Page files in `pages/` override this file.
Derived from UI UX Pro Max (palette "premium dark + action red", style "Data-Dense Dashboard",
typography "Premium Sans (DM Sans)") and adapted for a dealership operations console and showroom.

## Principles

1. **Full-width pages.** No centred `max-w-7xl` column with empty sides. Pages span the workspace;
   structure comes from a 12-column grid and full-bleed bands, not narrow containers. Prose may cap
   at `max-w-prose`; layouts never do.
2. **No side-strip accents.** Never colour one edge of a card or row (`border-l-*`, inset bars,
   `before:` strips). Express status with a full pill, a dot + label, a tinted icon tile, or a
   tinted header band across the full width.
3. **Quiet surfaces, loud data.** Neutral ink/graphite UI; colour is reserved for status, data and
   the single primary action. Brand red appears sparingly (primary button, active nav, key alerts).
4. **Hierarchy by type and space, not boxes.** Fewer borders, hairline dividers, generous section
   spacing, tight in-card density.
5. **Every number is tabular.** `tabular-nums` on all figures; money right-aligned in tables.

## Tokens — "Midnight & Crimson" (implemented in `src/app/globals.css`)

| Token | Light | Use |
|---|---|---|
| `--ink` (Midnight) | `#0A0F1C` | Sidebar, hero, dark bands, secondary button |
| `--ink-2` | `#141C2E` | Raised surfaces on ink |
| `--foreground` | `#0B1220` | Primary text |
| `--muted-foreground` | `#5A6478` | Secondary text (5.9:1 on white) |
| `--surface` (Canvas) | `#F4F6FA` | App canvas |
| `--card` | `#FFFFFF` | Panels, boards |
| `--border` (Line) | `#E3E7EF` | Hairlines |
| `--muted` | `#EEF1F6` | Wells, segmented controls, hover |
| `--primary` (Crimson) | `#D21F3C` (from `Settings.brand.primaryColor`) | Primary action, active nav, urgent counts |
| `--info` (Cobalt) | `#2F5BEA` | Data series, links, informational tiles |
| Status | Available `#0B875E` · HOLD `#F2A516` (ink text) · In Repair `#6D4AE8` · Sold `#4B5568` | Vehicle status pills and bars |
| Charts | `#2F5BEA #F07B3F #14A38B #E8B21C #7C5CFC #D9487E` | Categorical order |

Radius: panels `20px`, controls `12px`, pills full. Elevation: hairline border + `0 1px 2px` for panels;
`0 6px 16px -6px` tinted shadow on primary buttons only.

## Typography

- UI/body: **Plus Jakarta Sans** 400–800 (`--font-sans`). 15px CRM base, 16px public.
- Display (titles, KPIs, prices, hero): **Sora** 600–800 (`--font-display`), tracking `-0.03em`.
- Mono (VIN, stock numbers): **JetBrains Mono** (`--font-mono`).
- Page title 32px/600; section 16px/600; eyebrow 11px/700 uppercase `0.1em`.

Design file: https://claude.ai/artifact/Nb4S3S5xNEf8UZuSVD4PNV

## Layout

- Shell: dark ink sidebar (264px) + sticky translucent top bar. Content area is full width.
- Page = `PageHeader` band (eyebrow, title, description, actions, optional tabs/filters) spanning
  the full width on the canvas, then content with `px-4 sm:px-6 lg:px-8 2xl:px-10`.
- Grids: 12 columns at `xl`; KPI rows 2 → 3 → 6 across; charts 12/8/4 splits, not equal halves
  everywhere. Boards and tables run edge to edge of the content area.
- Spacing scale: 4 / 8 / 12 / 16 / 24 / 32 / 48. Section gap 32px desktop, 24px mobile.
- Mobile (375px): single column, bottom nav, 44px touch targets, no horizontal page scroll
  (boards may scroll inside their own container).

## Components

- **Panel** (`Card`): white, `rounded-2xl`, hairline border, `shadow-xs`; header row with title +
  description + action; content padding 20–24px.
- **StatCard**: eyebrow label, large display number (Archivo), hint; icon in a soft tinted tile.
  Status variants show a coloured dot + label, never a coloured edge.
- **Board**: full-width table, sticky header, zebra-free, row hover tint; group header is a tinted
  band with a coloured status pill + count (no left strip); Monday-style status cells stay filled.
- **Buttons**: primary (brand fill), secondary (ink outline/soft), ghost. Height 40px (44px on touch).
- **Pills/Badges**: full fill for statuses; soft tint (`color-mix` 12%) + dot for secondary tags.
- **Empty states**: icon tile, one line, one action.

## Motion

150–200ms `ease-out` for hover/press, 220–280ms for sheets and panels, transform/opacity only.
Respect `prefers-reduced-motion`. No decorative looping animation.

## Anti-patterns (reject in review)

- Coloured left/right border strips on cards, rows, groups or list items.
- `max-w-*` page containers that leave empty side gutters on desktop.
- Default shadcn look: grey `rounded-xl border shadow-sm` boxes everywhere, equal-width 2-col grids
  for everything, `text-3xl font-semibold` headers on a bare background.
- Emoji icons, raw hex in components (use tokens), text under 12px, contrast under 4.5:1.

## Public site (showroom)

Full-bleed dark hero with vehicle photography and display type; inventory grid of large photo
cards (16:10 image, price in display face, specs row, status chip); vehicle page is gallery-led
with a sticky inquiry/booking panel on desktop and a sticky CTA bar on mobile. Light canvas below
the hero; ink footer.
