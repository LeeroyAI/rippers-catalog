"use client";

import { useEffect } from "react";
import type { LatLngExpression } from "leaflet";
import {
  CircleMarker,
  MapContainer,
  Polyline,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";

import { appleMapsUrl, googleMapsSearchUrl } from "@/src/domain/map-links";
import { trailforksPlannerUrl } from "@/src/domain/rider-profile";

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
    map.setView(center, zoom, { animate: true });
  }, [center, zoom, map]);
  return null;
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
};

export default function TripMapInner({
  center,
  zoom,
  shops,
  trails,
  focusLabel,
}: Props) {
  return (
    <MapContainer
      center={center}
      zoom={zoom}
      className="trip-leaflet z-0 w-full border-0 shadow-none outline-none ring-0"
      scrollWheelZoom
    >
      <MapFocus center={center} zoom={zoom} />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
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
              {shop.openingHours && (
                <div className="mt-1 text-[10px] text-neutral-500">{shop.openingHours}</div>
              )}
              {shop.phone && (
                <a href={`tel:${shop.phone}`} className="mt-1.5 block text-[11px] font-semibold text-neutral-700">
                  {shop.phone}
                </a>
              )}
              <div className="mt-2 flex flex-col gap-1 text-[11px] font-semibold">
                {shop.website && (
                  <a
                    href={shop.website.startsWith("http") ? shop.website : `https://${shop.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#E5470A] underline underline-offset-2"
                  >
                    Visit website ↗
                  </a>
                )}
                <a
                  href={googleMapsSearchUrl(shop.lat, shop.lon, shop.name)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#2563EB] underline underline-offset-2"
                >
                  Directions (Google)
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
                href={trailforksPlannerUrl(trail.centroidLat, trail.centroidLon)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block font-semibold text-[#E5470A] underline underline-offset-2"
              >
                Jump to Trailforks map
              </a>
              <span className="mt-2 block text-[10px] text-neutral-700">
                Trailforks opens ride planner centred on this polyline midpoint so you see official MTB
                trails layered there.
              </span>
            </div>
          </Popup>
        </Polyline>
      ))}
    </MapContainer>
  );
}
