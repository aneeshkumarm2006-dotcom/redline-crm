import { ScreenSkeleton } from "@/components/shared/screen-skeleton";
import { inventoryCopy } from "@/modules/inventory/copy";
export default function Loading() { return <ScreenSkeleton label={inventoryCopy.loading} tiles={3} rows={4} />; }
