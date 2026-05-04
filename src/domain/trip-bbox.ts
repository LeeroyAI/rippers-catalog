export type GeoBBox = {
  south: number;
  west: number;
  north: number;
  east: number;
};

/** Approx bounding box (~equal km radius) around a lat/lng centre. */
export function bboxFromCenter(lat: number, lon: number, radiusKm: number): GeoBBox {
  const latDelta = radiusKm / 111.32;
  const cos = Math.cos((lat * Math.PI) / 180);
  const safeCos = cos < 0.08 ? 0.08 : cos;
  const lonDelta = radiusKm / (111.32 * safeCos);

  return {
    south: lat - latDelta,
    north: lat + latDelta,
    west: lon - lonDelta,
    east: lon + lonDelta,
  };
}
