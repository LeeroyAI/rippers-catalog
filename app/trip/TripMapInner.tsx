"use client";

import { useEffect, useMemo } from "react";
import L from "leaflet";
import type { LatLngExpression } from "leaflet";
import {
  CircleMarker,
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";

import {
  appleMapsUrl,
  googleMapsDirectionsUrl,
  googleMapsSearchUrl,
  trailforksTrailsMapUrl,
} from "@/src/domain/map-links";

import "leaflet/dist/leaflet.css";

export type TripShopPin = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  kmFromCenter: number;
  sales: boolean;
  repair: boolean;
  rental: boolean;
  website?: string;
  phone?: string;
  openingHours?: string;
};

export type TripTrailLine = {
  id: string;
  name: string;
  points: [number, number][];
  centroidLat: number;
  centroidLon: number;
  kmFromCenter: number;
};

function MapFocus({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    // Avoid animated panning during rapid layer swaps; this prevents occasional
    // Leaflet pane-position runtime errors in dev/hot updates.
    map.setView(center, zoom, { animate: false });
  }, [center, zoom, map]);
  return null;
}

function FitItineraryRoute({ route }: { route: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (route.length < 2) return;
    const bounds = L.latLngBounds(route);
    if (!bounds.isValid()) return;
    // Keep itinerary re-focus stable when markers/stops update quickly.
    map.fitBounds(bounds, { padding: [48, 48], animate: false, maxZoom: 11 });
  }, [map, route]);
  return null;
}

export type TripItineraryPin = {
  seq: number;
  lat: number;
  lon: number;
  label: string;
  isActive: boolean;
};

function ItineraryNumberedPin({ pin }: { pin: TripItineraryPin }) {
  const icon = useMemo(
    () =>
      L.divIcon({
        className: "r-itin-marker",
        html: `<span class="r-itin-marker__badge${pin.isActive ? " r-itin-marker__badge--active" : ""}">${pin.seq}</span>`,
        iconSize: [30, 30],
        iconAnchor: [15, 28],
      }),
    [pin.seq, pin.isActive]
  );
  return (
    <Marker position={[pin.lat, pin.lon]} icon={icon}>
      <Popup>
        <span className="text-sm font-semibold">
          Stop {pin.seq}: {pin.label.split(",").slice(0, 2).join(",").trim() || pin.label}
        </span>
      </Popup>
    </Marker>
  );
}

function serviceLine(sales: boolean, repair: boolean, rental: boolean): string {
  const bits: string[] = [];
  if (sales) {
    bits.push("sales");
  }
  if (repair) {
    bits.push("service");
  }
  if (rental) {
    bits.push("rentals");
  }
  return bits.length ? bits.join(" · ") : "shop (mapper detail missing)";
}

type Props = {
  center: [number, number];
  zoom: number;
  shops: TripShopPin[];
  trails: TripTrailLine[];
  focusLabel: string;
  userLocation?: { lat: number; lon: number } | null;
  /** Multi-stop itinerary: numbered pins + optional dashed leg line. */
  itineraryPins?: TripItineraryPin[];
  itineraryRoute?: [number, number][];
};

export default function TripMapInner({
  center,
  zoom,
  shops,
  trails,
  focusLabel,
  userLocation,
  itineraryPins,
  itineraryRoute,
}: Props) {
  const fitRoute = Boolean(itineraryRoute && itineraryRoute.length >= 2);
  const showMultiItinerary = Boolean(itineraryPins && itineraryPins.length >= 2);

  return (
    <MapContainer
      center={center}
      zoom={zoom}
      className="trip-leaflet z-0 w-full border-0 shadow-none outline-none ring-0"
      scrollWheelZoom
    >
      {fitRoute && itineraryRoute ? <FitItineraryRoute route={itineraryRoute} /> : <MapFocus center={center} zoom={zoom} />}
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {itineraryRoute && itineraryRoute.length >= 2 ? (
        <Polyline
          positions={itineraryRoute as LatLngExpression[]}
          pathOptions={{
            color: "#E5470A",
            weight: 3,
            opacity: 0.42,
            dashArray: "10 14",
            lineCap: "round",
          }}
        />
      ) : null}

      {!showMultiItinerary ? (
        <CircleMarker
          center={center}
          radius={9}
          pathOptions={{
            color: "#E5470A",
            fillColor: "#E5470A",
            fillOpacity: 1,
            weight: 2,
          }}
        >
          <Popup>{focusLabel}</Popup>
        </CircleMarker>
      ) : (
        itineraryPins!.map((pin) => <ItineraryNumberedPin key={`${pin.seq}-${pin.lat}-${pin.lon}`} pin={pin} />)
      )}

      {shops.map((shop) => (
        <CircleMarker
          key={shop.id}
          center={[shop.lat, shop.lon]}
          radius={7}
          pathOptions={{
            color: "#2563EB",
            fillColor: "#2563EB",
            fillOpacity: 0.92,
            weight: 1,
          }}
        >
          <Popup>
            <div className="min-w-[11rem] text-sm leading-snug">
              <div className="flex flex-wrap items-center gap-1.5">
                <strong>{shop.name}</strong>
                {shop.rental && (
                  <span className="rounded bg-[#f3e8ff] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#5b21b6]">
                    Hire available
                  </span>
                )}
              </div>
              <div className="mt-1.5 text-[11px] text-neutral-600">
                {serviceLine(shop.sales, shop.repair, shop.rental)}
              </div>
              <div className="mt-1 text-[10px] text-neutral-500">{shop.openingHours ?? "Hours not listed"}</div>
              <div className="mt-1.5 text-[11px] text-neutral-700">
                Contact:{" "}
                {shop.phone ? (
                  <a href={`tel:${shop.phone}`} className="font-semibold underline underline-offset-2">
                    {shop.phone}
                  </a>
                ) : (
                  <span className="font-medium">Phone not listed</span>
                )}
              </div>
              <div className="mt-2 flex flex-col gap-1 text-[11px] font-semibold">
                <a
                  href={
                    shop.website
                      ? shop.website.startsWith("http")
                        ? shop.website
                        : `https://${shop.website}`
                      : googleMapsSearchUrl(shop.lat, shop.lon, shop.name)
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#E5470A] underline underline-offset-2"
                >
                  {shop.website ? "Visit website ↗" : "Website not listed — open listing ↗"}
                </a>
                <a
                  href={googleMapsDirectionsUrl(shop.lat, shop.lon, shop.name, userLocation ?? undefined)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#2563EB] underline underline-offset-2"
                >
                  Directions from my location (Google)
                </a>
                <a
                  href={appleMapsUrl(shop.lat, shop.lon, shop.name)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#2563EB] underline underline-offset-2"
                >
                  Apple Maps
                </a>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(shop.name + " bike shop reviews")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#2563EB] underline underline-offset-2"
                >
                  Google Reviews ↗
                </a>
              </div>
            </div>
          </Popup>
        </CircleMarker>
      ))}

      {trails.map((trail) => (
        <Polyline
          key={trail.id}
          positions={trail.points as LatLngExpression[]}
          pathOptions={{ color: "#2EA84C", weight: 4, opacity: 0.72 }}
        >
          <Popup>
            <div className="text-sm leading-snug">
              <strong>{trail.name}</strong>
              <p className="mt-2 text-[11px] text-neutral-700">
                Named or MTB-tagged path from OpenStreetMap (not a curated centre map — use Trailforks for official trail
                names and closures).
              </p>
              <a
                href={trailforksTrailsMapUrl(trail.centroidLat, trail.centroidLon, {
                  zoom: 15,
                  trailName: trail.name,
                })}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block font-semibold text-[#E5470A] underline underline-offset-2"
              >
                Jump to Trailforks map
              </a>
              <span className="mt-2 block text-[10px] text-neutral-700">
                Opens Trailforks’ trail map centred here (with the name in search when supported) so official MTB
                layers appear in context.
              </span>
            </div>
          </Popup>
        </Polyline>
      ))}
    </MapContainer>
  );
}
