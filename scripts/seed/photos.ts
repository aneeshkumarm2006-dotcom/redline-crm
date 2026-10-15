// Placeholder images (placehold.co) until actual vehicle photos are supplied.
const views = ["Front", "Side", "Interior"];

export function placeholderPhotos(vehicle: { year: number; make: string; model: string }): string[] {
  const label = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
  return views.map((view) => `https://placehold.co/1280x720/png?text=${encodeURIComponent(`${label} - ${view}`)}`);
}
