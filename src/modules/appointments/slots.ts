import { weekdays, type Settings } from "@/modules/settings/schema";

export type Slot = { startsAt: string; endsAt: string };
export type SlotDay = { date: string; slots: Slot[] };
type Interval = { startsAt: string; endsAt: string };

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

/** Wall-clock parts of an instant in an IANA zone. */
function zonedParts(instant: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).formatToParts(new Date(instant));
  const value = (type: string) => Number(parts.find((part) => part.type === type)!.value);
  return { year: value("year"), month: value("month"), day: value("day"), hour: value("hour"), minute: value("minute") };
}

function offset(instant: number, timeZone: string) {
  const p = zonedParts(instant, timeZone);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - Math.floor(instant / MINUTE) * MINUTE;
}

/** Local `YYYY-MM-DD` + `HH:mm` in a zone → UTC epoch ms. The second pass corrects across DST changes. */
export function zonedTimeToUtc(date: string, time: string, timeZone: string) {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  return wall - offset(wall - offset(wall, timeZone), timeZone);
}

/** Calendar date (`YYYY-MM-DD`) of an instant in a zone. */
export function localDate(instant: number, timeZone: string) {
  const p = zonedParts(instant, timeZone);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

function addDays(date: string, days: number) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day) + days * DAY).toISOString().slice(0, 10);
}

function weekday(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  // getUTCDay: 0 = Sunday; settings weekdays start on Monday.
  return weekdays[(new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 6) % 7];
}

/**
 * Bookable slots from today (in the dealership zone) for `daysAhead` days: business hours cut
 * into `slotLengthMinutes`, excluding slots that have started or overlap a booked interval.
 * Days without a free slot are omitted.
 */
export function buildSlotDays(booking: Settings["booking"], now: Date, booked: Interval[]): SlotDay[] {
  const { timeZone, slotLengthMinutes, daysAhead, businessHours } = booking;
  const length = slotLengthMinutes * MINUTE;
  const busy = booked.map((entry) => [Date.parse(entry.startsAt), Date.parse(entry.endsAt)] as const);
  const today = localDate(now.getTime(), timeZone);
  const days: SlotDay[] = [];
  for (let index = 0; index < daysAhead; index++) {
    const date = addDays(today, index);
    const hours = businessHours[weekday(date)];
    if (!hours) continue;
    const close = zonedTimeToUtc(date, hours.closesAt, timeZone);
    const slots: Slot[] = [];
    for (let start = zonedTimeToUtc(date, hours.opensAt, timeZone); start + length <= close; start += length) {
      const end = start + length;
      if (start <= now.getTime() || busy.some(([from, to]) => from < end && to > start)) continue;
      slots.push({ startsAt: new Date(start).toISOString(), endsAt: new Date(end).toISOString() });
    }
    if (slots.length) days.push({ date, slots });
  }
  return days;
}

/** UTC instant of local midnight for the calendar day containing `instant` in a zone. */
export function startOfLocalDay(instant: number, timeZone: string) {
  return zonedTimeToUtc(localDate(instant, timeZone), "00:00", timeZone);
}
