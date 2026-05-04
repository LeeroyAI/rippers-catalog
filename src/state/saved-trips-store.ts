"use client";

import { useCallback, useMemo, useState } from "react";

import {
  appendTripToFile,
  itineraryRecordFromStops,
  parseSavedTripsFile,
  savedTripsStorageKey,
  type SavedTripPlaceV1,
  type SavedTripRecordV1,
  type SavedTripsFileV1,
} from "@/src/domain/saved-trips";
import { useRiderProfile } from "@/src/state/rider-profile-context";

function readFile(key: string): SavedTripsFileV1 {
  if (typeof localStorage === "undefined") return { version: 1, trips: [] };
  try {
    return parseSavedTripsFile(localStorage.getItem(key));
  } catch {
    return { version: 1, trips: [] };
  }
}

export function useSavedTrips() {
  const { activeRiderId, hydrated } = useRiderProfile();
  const storageKey = activeRiderId ? savedTripsStorageKey(activeRiderId) : "";
  const [tick, setTick] = useState(0);

  const file = useMemo(() => {
    void tick;
    if (!hydrated || !storageKey) return { version: 1, trips: [] } satisfies SavedTripsFileV1;
    return readFile(storageKey);
  }, [hydrated, storageKey, tick]);

  const appendTrip = useCallback(
    (input: {
      place: SavedTripPlaceV1;
      radiusKm: number;
      trailCount?: number;
      shopCount?: number;
      stops?: SavedTripPlaceV1[];
    }): SavedTripRecordV1 | null => {
      if (!storageKey) return null;
      const prev = readFile(storageKey);
      const next = appendTripToFile(prev, {
        place: input.place,
        radiusKm: input.radiusKm,
        trailCount: input.trailCount,
        shopCount: input.shopCount,
        stops: input.stops,
      });
      const added = next.trips[next.trips.length - 1];
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      setTick((t) => t + 1);
      return added ?? null;
    },
    [storageKey]
  );

  const appendItineraryTrip = useCallback(
    (input: {
      stops: SavedTripPlaceV1[];
      radiusKm: number;
      trailCount?: number;
      shopCount?: number;
    }): SavedTripRecordV1 | null => {
      if (!storageKey || input.stops.length < 2) return null;
      const prev = readFile(storageKey);
      const payload = itineraryRecordFromStops(input.stops, input.radiusKm, input.trailCount, input.shopCount);
      const next = appendTripToFile(prev, payload);
      const added = next.trips[next.trips.length - 1];
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      setTick((t) => t + 1);
      return added ?? null;
    },
    [storageKey]
  );

  return { trips: file.trips, appendTrip, appendItineraryTrip };
}
