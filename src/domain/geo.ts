import type { GeoPoint } from './types';

const EARTH_RADIUS_M = 6_371_000;

/** Straight-line (great-circle) distance in meters. Not a route distance. */
export function haversineM(a: GeoPoint, b: GeoPoint): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

export function metersToMiles(m: number): number {
  return m / 1609.344;
}
