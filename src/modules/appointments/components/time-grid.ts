// Vertical scale of the day and week time grids: a 30-minute visit is 48px tall, enough for time, customer and vehicle.
export const PX = 1.6;
export const minutesOf = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));

/** "9 a.m." (hour) or "9:30 a.m." (full) for minutes since midnight. */
export const clock = (minutes: number, style: "hour" | "full") => new Intl.DateTimeFormat("en-CA", style === "hour" ? { hour: "numeric", timeZone: "UTC" } : { timeStyle: "short", timeZone: "UTC" })
  .format(new Date(Date.UTC(2000, 0, 1, Math.floor(minutes / 60), minutes % 60)));

/** Side-by-side lanes for visits that overlap in one column. */
export function placeInLanes<T extends { from: number; to: number }>(entries: T[]): (T & { lane: number; lanes: number })[] {
  const sorted = [...entries].sort((a, b) => a.from - b.from);
  const placed: (T & { lane: number; lanes: number })[] = [];
  let cluster: (T & { lane: number; lanes: number })[] = [];
  let clusterEnd = -1;
  for (const entry of sorted) {
    if (entry.from >= clusterEnd) cluster = [];
    const used = new Set(cluster.filter((item) => item.to > entry.from).map((item) => item.lane));
    let lane = 0;
    while (used.has(lane)) lane++;
    const item = { ...entry, lane, lanes: 1 };
    cluster.push(item);
    placed.push(item);
    clusterEnd = Math.max(clusterEnd, entry.to);
    const lanes = Math.max(...cluster.map((member) => member.lane)) + 1;
    for (const member of cluster) member.lanes = lanes;
  }
  return placed;
}
