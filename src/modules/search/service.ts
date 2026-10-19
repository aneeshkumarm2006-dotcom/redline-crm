import "server-only";
import { requireRole } from "@/modules/auth/service";
import { authCopy } from "@/modules/auth/copy";
import { searchVehicles } from "@/modules/inventory/service";
import { vehicleTitle } from "@/modules/inventory/copy";
import { searchLeads } from "@/modules/leads/service";
import { getSettings } from "@/modules/settings/service";
import { searchStaff } from "@/modules/users/service";
import { searchQuerySchema, emptyResults, type SearchResults } from "./schema";
import { searchCopy } from "./copy";

const NEUTRAL = "#94A3B8";

/**
 * Workspace quick-find. Each source service applies its own role scope: every staff member
 * reads inventory, salespeople see only their assigned leads, and only owners search staff.
 */
export async function searchWorkspace(input: unknown): Promise<SearchResults> {
  const user = await requireRole();
  const query = searchQuerySchema.parse(input);
  if (query.length < 2) return emptyResults;
  const [settings, vehicles, leads, staff] = await Promise.all([
    getSettings(), searchVehicles(query), searchLeads(query), user.role === "owner" ? searchStaff(query) : Promise.resolve([]),
  ]);
  const status = (list: { key: string; label: string; color: string }[], key: string) => {
    const match = list.find((item) => item.key === key);
    return { label: match?.label ?? key, color: match?.color ?? NEUTRAL };
  };
  return {
    vehicles: vehicles.map((vehicle) => ({
      id: vehicle.id, kind: "vehicle", title: `${vehicleTitle(vehicle)}${vehicle.trim ? ` ${vehicle.trim}` : ""}`,
      detail: `${vehicle.stockNo} · ${vehicle.vin}`, href: `/crm/inventory/${vehicle.id}`, status: status(settings.vehicleStatuses, vehicle.status),
    })),
    leads: leads.map((lead) => ({
      id: lead.id, kind: "lead", title: lead.name, detail: [lead.email, lead.phone].filter(Boolean).join(" · "),
      href: `/crm/leads/${lead.id}`, status: status(settings.leadStages, lead.stage),
    })),
    staff: staff.map((member) => ({
      id: member.id, kind: "staff", title: member.name,
      detail: `${authCopy.roles[member.role]} · ${member.active ? member.email : searchCopy.inactive}`, href: "/crm/team",
    })),
  };
}
