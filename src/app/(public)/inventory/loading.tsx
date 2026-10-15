import { publicInventoryCopy as copy } from "@/modules/inventory/public-copy";
export default function Loading() { return <p role="status" className="py-8">{copy.loading}</p>; }
