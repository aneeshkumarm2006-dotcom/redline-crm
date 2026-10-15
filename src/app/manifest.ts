import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { shellCopy } from "@/components/shared/app-shell/copy";
import { getSettings } from "@/modules/settings/service";
import { appIconSizes } from "./app-icon/[size]/sizes";

/** Installable staff app. Name and colours come from the settings brand, read per request. */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  await connection();
  const brand = await getSettings().then((settings) => settings.brand).catch(() => null);
  const name = brand ? `${brand.companyName} · ${shellCopy.workspace}` : shellCopy.workspace;
  return {
    name, short_name: brand?.companyName ?? shellCopy.workspace, description: shellCopy.workspace,
    id: "/crm", start_url: "/crm", scope: "/", display: "standalone", orientation: "portrait",
    background_color: "#ffffff", theme_color: brand?.primaryColor ?? "#ffffff",
    icons: appIconSizes.flatMap((size) => (["any", "maskable"] as const).map((purpose) => ({ src: `/app-icon/${size}`, sizes: `${size}x${size}`, type: "image/png", purpose }))),
  };
}
