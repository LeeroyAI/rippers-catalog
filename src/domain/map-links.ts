export function googleMapsSearchUrl(lat: number, lng: number, name: string): string {
  const q = encodeURIComponent(`${name.trim()} (${lat.toFixed(5)}, ${lng.toFixed(5)})`);
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

export function appleMapsUrl(lat: number, lng: number, name: string): string {
  return `http://maps.apple.com/?ll=${lat},${lng}&q=${encodeURIComponent(name.trim())}`;
}
