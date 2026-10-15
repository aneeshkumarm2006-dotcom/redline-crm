"use client";

import { useState } from "react";
import { CarFront } from "lucide-react";
import type { Settings } from "@/modules/settings/schema";

export function Brand({ brand }: { brand: Settings["brand"] }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showLogo = brand.logoUrl && brand.logoUrl !== failedUrl;
  return <span className="flex min-w-0 items-center gap-3">
    <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary text-primary-foreground">
      {showLogo ? (
        // Admin-configured URLs do not need a deployment-time image-host allowlist.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={brand.logoUrl!} alt="" width={44} height={44}
          ref={(element) => {
            // A failed SSR image can finish before React attaches onError.
            if (element?.complete && element.naturalWidth === 0) setFailedUrl(brand.logoUrl);
          }}
          className="size-11 bg-background object-contain" onError={() => setFailedUrl(brand.logoUrl)} />
      ) : <CarFront aria-hidden="true" className="size-6" />}
    </span>
    <span className="min-w-0 truncate text-base font-semibold tracking-tight" title={brand.companyName}>
      {brand.companyName}
    </span>
  </span>;
}
