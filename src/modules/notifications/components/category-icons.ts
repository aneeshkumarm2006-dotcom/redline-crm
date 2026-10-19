import { AlarmClock, CarFront, UserPlus, Wrench, type LucideIcon } from "lucide-react";
import type { AlertCategory } from "../schema";

export const categoryIcons: Record<AlertCategory, LucideIcon> = { leads: UserPlus, inventory: CarFront, repairs: Wrench, reminders: AlarmClock };
