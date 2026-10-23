import { ScreenSkeleton } from "@/components/shared/screen-skeleton";
import { appointmentsCopy } from "@/modules/appointments/copy";
export default function Loading() { return <ScreenSkeleton label={appointmentsCopy.loading} />; }
