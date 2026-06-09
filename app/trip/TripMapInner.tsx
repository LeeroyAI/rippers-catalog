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
import type { PublicPresence } from "@/src/domain/community/presence";
import { ridingStyleLabels } from "@/src/domain/riding-style";

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
  /** OSM technical difficulty 0-6 (mtb:scale), null if untagged. */
  difficulty?: number | null;
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

/** Compact "riding now" vs "planned for <when>" line for a presence popup. */
function presenceWhen(p: PublicPresence): string {
  if (p.type === "now") return "Riding now";
  if (!p.plannedAt) return "Planned";
  const d = new Date(p.plannedAt);
  return `Planned · ${d.toLocaleString([], { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}`;
}

function PresenceMarkers({
  presences,
  currentUserId,
  onRemovePresence,
}: {
  presences: PublicPresence[];
  currentUserId?: string | null;
  onRemovePresence?: (id: string) => void;
}) {
  return (
    <>
      {presences.map((p) => {
        const mine = currentUserId != null && p.userId === currentUserId;
        const icon = L.divIcon({
          className: "r-rider-marker",
          html: `<span class="r-rider-marker__badge${p.isLocalGuide ? " r-rider-marker__badge--guide" : ""}${mine ? " r-rider-marker__badge--mine" : ""}">${p.isLocalGuide ? "★" : "●"}</span>`,
          iconSize: [26, 26],
          iconAnchor: [13, 24],
        });
        return (
          <Marker key={p.id} position={[p.lat, p.lon]} icon={icon}>
            <Popup>
              <div className="min-w-[12rem] text-sm leading-snug">
                <div className="flex flex-wrap items-center gap-1.5">
                  <strong>{mine ? "You" : p.handle}</strong>
                  {p.isLocalGuide && (
                    <span className="rounded bg-accent-subtle/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent">
                      Local guide
                    </span>
                  )}
                </div>
                <div className="mt-1 text-[11px] font-semibold text-brand-text">{presenceWhen(p)}</div>
                {p.style && <div className="mt-0.5 text-[11px] text-text-2">{ridingStyleLabels(p.style)}</div>}
                {p.note && <div className="mt-1.5 text-[12px] text-text-2">{p.note}</div>}
                <div className="mt-1.5 text-[10px] text-text-2">Shown as a rough area (~1km), not an exact spot.</div>
                {mine && onRemovePresence && (
                  <button
                    type="button"
                    onClick={() => onRemovePresence(p.id)}
                    className="mt-2 rounded-full bg-danger/10 px-2.5 py-1 text-[11px] font-bold text-danger"
                  >
                    Remove my post
                  </button>
                )}
              </div>
            </Popup>
          </Marker>
        );
      })}
    </>
  );
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
  /** Community presence pins. */
  presences?: PublicPresence[];
  currentUserId?: string | null;
  onRemovePresence?: (id: string) => void;
  /** A trail the user tapped in the list: fly to it + highlight its line. */
  focusTrail?: { lat: number; lon: number; name: string } | null;
};

/** Fly to a tapped trail so the rider sees it without leaving the page. */
function FlyToTrail({ point }: { point: { lat: number; lon: number } }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([point.lat, point.lon], 15, { duration: 0.7 });
  }, [map, point.lat, point.lon]);
  return null;
}

export default function TripMapInner({
  center,
  zoom,
  shops,
  trails,
  focusLabel,
  userLocation,
  itineraryPins,
  itineraryRoute,
  presences,
  currentUserId,
  onRemovePresence,
  focusTrail,
}: Props) {
  const fitRoute = Boolean(itineraryRoute && itineraryRoute.length >= 2);
  const showMultiItinerary = Boolean(itineraryPins && itineraryPins.length >= 2);
  const focusedSegments = focusTrail
    ? trails.filter((t) => t.name === focusTrail.name)
    : [];

  return (
    <MapContainer
      center={center}
      zoom={zoom}
      className="trip-leaflet z-0 w-full border-0 shadow-none outline-none ring-0"
      scrollWheelZoom
    >
      {focusTrail ? (
        <FlyToTrail point={focusTrail} />
      ) : fitRoute && itineraryRoute ? (
        <FitItineraryRoute route={itineraryRoute} />
      ) : (
        <MapFocus center={center} zoom={zoom} />
      )}
      {/* CyclOSM: a cycling-focused base map that renders MTB trails, tracks,
          paths and bike routes far more prominently than standard OSM tiles. */}
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · <a href="https://www.cyclosm.org/">CyclOSM</a>'
        url="https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png"
        maxZoom={20}
      />
      {itineraryRoute && itineraryRoute.length >= 2 ? (
        <Polyline
          positions={itineraryRoute as LatLngExpression[]}
          pathOptions={{
            color: "#E5471A",
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
            color: "#E5471A",
            fillColor: "#E5471A",
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
                  <span className="rounded bg-accent-subtle/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent">
                    Hire available
                  </span>
                )}
              </div>
              <div className="mt-1.5 text-[11px] text-text-2">
                {serviceLine(shop.sales, shop.repair, shop.rental)}
              </div>
              <div className="mt-1 text-[10px] text-text-2">{shop.openingHours ?? "Hours not listed"}</div>
              <div className="mt-1.5 text-[11px] text-text-2">
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
                  className="text-brand-text underline underline-offset-2"
                >
                  {shop.website ? "Visit website ↗" : "Website not listed — open listing ↗"}
                </a>
                <a
                  href={googleMapsDirectionsUrl(shop.lat, shop.lon, shop.name, userLocation ?? undefined)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-info underline underline-offset-2"
                >
                  Directions from my location (Google)
                </a>
                <a
                  href={appleMapsUrl(shop.lat, shop.lon, shop.name)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-info underline underline-offset-2"
                >
                  Apple Maps
                </a>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(shop.name + " bike shop reviews")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-info underline underline-offset-2"
                >
                  Google Reviews ↗
                </a>
              </div>
            </div>
          </Popup>
        </CircleMarker>
      ))}

      {/* Dark casing under every trail so the bright line reads on any terrain. */}
      {trails.map((trail) => (
        <Polyline
          key={`${trail.id}-casing`}
          positions={trail.points as LatLngExpression[]}
          pathOptions={{ color: "#0A2E14", weight: 7, opacity: 0.45, lineCap: "round", lineJoin: "round" }}
          interactive={false}
        />
      ))}
      {trails.map((trail) => (
        <Polyline
          key={trail.id}
          positions={trail.points as LatLngExpression[]}
          pathOptions={{ color: "#16C75A", weight: 4, opacity: 0.95, lineCap: "round", lineJoin: "round" }}
        >
          <Popup>
            <div className="text-sm leading-snug">
              <strong>{trail.name}</strong>
              <p className="mt-2 text-[11px] text-text-2">
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
                className="mt-2 inline-block font-semibold text-brand-text underline underline-offset-2"
              >
                Jump to Trailforks map
              </a>
              <span className="mt-2 block text-[10px] text-text-2">
                Opens Trailforks’ trail map centred here (with the name in search when supported) so official MTB
                layers appear in context.
              </span>
            </div>
          </Popup>
        </Polyline>
      ))}

      {/* Highlight the tapped trail: bright casing + thick line so it stands out. */}
      {focusedSegments.map((trail) => (
        <Polyline
          key={`focus-${trail.id}`}
          positions={trail.points as LatLngExpression[]}
          pathOptions={{ color: "#E5471A", weight: 7, opacity: 1, lineCap: "round", lineJoin: "round" }}
          interactive={false}
        />
      ))}

      {presences && presences.length > 0 ? (
        <PresenceMarkers
          presences={presences}
          currentUserId={currentUserId}
          onRemovePresence={onRemovePresence}
        />
      ) : null}
    </MapContainer>
  );
}
