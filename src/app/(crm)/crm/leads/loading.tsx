import { ScreenSkeleton } from "@/components/shared/screen-skeleton";
import { leadsCopy } from "@/modules/leads/copy";
export default function Loading() { return <ScreenSkeleton label={leadsCopy.loading} />; }
