import { ScreenSkeleton } from "@/components/shared/screen-skeleton";
import { shellCopy } from "@/components/shared/app-shell/copy";
export default function Loading() { return <ScreenSkeleton label={shellCopy.loading} tiles={6} rows={4} />; }
