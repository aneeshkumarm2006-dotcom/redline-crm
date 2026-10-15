import { ScreenSkeleton } from "@/components/shared/screen-skeleton";
import { alertsCopy } from "@/modules/notifications/copy";
export default function Loading() { return <ScreenSkeleton label={alertsCopy.loading} rows={6} />; }
