import { redirect } from "next/navigation";
// The calendar moved to its own sidebar section; older alert and email links still land here.
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const search = new URLSearchParams(Object.entries(await searchParams).flatMap(([key, value]) => (Array.isArray(value) ? value : value ? [value] : []).map((entry) => [key, entry])));
  redirect(search.size ? `/crm/calendar?${search}` : "/crm/calendar");
}
