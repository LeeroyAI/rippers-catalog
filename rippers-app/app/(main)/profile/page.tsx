"use client";

import Link from "next/link";
import { startTransition, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import BikeDetailSheet from "@/app/components/BikeDetailSheet";
import BikeProductImage from "@/app/components/BikeProductImage";
import CreateFamilyModal from "@/app/components/CreateFamilyModal";
import MyFamilySection from "@/app/components/MyFamilySection";
import { catalog } from "@/src/data/catalog";
import { getBestPrice } from "@/src/domain/bike-helpers";
import {
  approximateFrameReachCm,
  RIDER_PROFILE_STORAGE_KEY,
  suggestedBikeCategory,
} from "@/src/domain/rider-profile";
import { savedTripsStorageKey } from "@/src/domain/saved-trips";
import {
  LEGACY_PROFILE_PHOTO_KEY,
  readRiderPhoto,
  riderPhotoStorageKey,
  writeRiderPhoto,
} from "@/src/domain/rider-photo";
import { householdAddRiderHref } from "@/src/lib/welcome-add-mode";
import { notifyRiderPhotoUpdated, RIDER_PHOTO_UPDATED_EVENT } from "@/src/lib/rider-photo-events";
import { resizePhotoToDataUrl } from "@/src/lib/resize-photo-to-data-url";
import { RIDERS_STORAGE_KEY } from "@/src/domain/riders-storage";
import { RIDING_STYLE_OPTIONS, ridingStyleLabels, type RidingStyle } from "@/src/domain/riding-style";
import { useFavourites } from "@/src/state/favourites-store";
import { useCurrentBike } from "@/src/state/current-bike-store";
import { useRiderProfile } from "@/src/state/rider-profile-context";
import type { Bike } from "@/src/domain/types";

const PROFILE_PHOTO_CHANGED = "rippers:profile-photo-changed";

// Gear recommendations per riding style
type GearItem = { icon: string; name: string; desc: string; url: string };
type GearSet = { protection: GearItem[]; clothing: GearItem[]; tools: GearItem[] };

function GearIcon({ id }: { id: string }) {
  const icons: Record<string, React.ReactNode> = {
    helmet: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M5 12C5 7.58 8.13 4 12 4s7 3.58 7 8v1H5v-1Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" fill="currentColor" fillOpacity="0.12"/>
        <path d="M5 13h14v2a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-2Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/>
        <path d="M19 13c1 0 2 .5 2 2v1" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
      </svg>
    ),
    knee: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="8" y="2" width="8" height="20" rx="4" stroke="currentColor" strokeWidth="1.7"/>
        <rect x="7" y="8" width="10" height="8" rx="2" stroke="currentColor" strokeWidth="1.7" fill="currentColor" fillOpacity="0.15"/>
        <path d="M10 12h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.5"/>
      </svg>
    ),
    elbow: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="9" y="2" width="6" height="20" rx="3" stroke="currentColor" strokeWidth="1.7"/>
        <rect x="7" y="9" width="10" height="6" rx="2" stroke="currentColor" strokeWidth="1.7" fill="currentColor" fillOpacity="0.15"/>
      </svg>
    ),
    back: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M12 2C9 2 7 4.5 7 7v10c0 2.5 2 5 5 5s5-2.5 5-5V7c0-2.5-2-5-5-5Z" stroke="currentColor" strokeWidth="1.7"/>
        <path d="M12 6v12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
        <path d="M9.5 9h5M9.5 12h5M9.5 15h5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity="0.5"/>
      </svg>
    ),
    jersey: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M9.5 3H6L2 7.5l3.5 2V21h13V9.5l3.5-2L18 3h-3.5a3 3 0 0 1-5 0Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/>
        <path d="M9 12h6M9 15h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity="0.4"/>
      </svg>
    ),
    shorts: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M4 5h16v2l-3 13H13l-1-8-1 8H7L4 7V5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/>
        <path d="M4 5h16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
        <path d="M13 5l-1 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity="0.5"/>
      </svg>
    ),
    gloves: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M10 10V7a1 1 0 0 1 2 0v3m0-3V5.5a1 1 0 0 1 2 0V10m0-3a1 1 0 0 1 2 0v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M8 12V9.5a1 1 0 0 1 2 0V12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M8 12c0 0-1 .5-1 2v2c0 2 1.5 4 5 4s5-2 5-4v-2.5c0-.5-.3-1.5-1-1.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M9 16h6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity="0.5"/>
      </svg>
    ),
    shoes: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M3 16h18v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-3Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/>
        <path d="M3 16l2.5-8H11l1 3 5.5-.5L21 16H3Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" fill="currentColor" fillOpacity="0.1"/>
        <circle cx="17" cy="12" r="1.2" fill="currentColor" opacity="0.6"/>
      </svg>
    ),
    eyewear: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M2 10h20" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
        <rect x="2" y="10" width="8" height="5" rx="2.5" stroke="currentColor" strokeWidth="1.7" fill="currentColor" fillOpacity="0.1"/>
        <rect x="14" y="10" width="8" height="5" rx="2.5" stroke="currentColor" strokeWidth="1.7" fill="currentColor" fillOpacity="0.1"/>
        <path d="M10 12.5h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
      </svg>
    ),
    tool: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.77 3.77Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/>
      </svg>
    ),
    firstaid: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.7" fill="currentColor" fillOpacity="0.08"/>
        <path d="M12 8v8M8 12h8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
      </svg>
    ),
    pack: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M9 4a3 3 0 0 1 6 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
        <rect x="4" y="6" width="16" height="14" rx="3" stroke="currentColor" strokeWidth="1.7" fill="currentColor" fillOpacity="0.08"/>
        <path d="M9 6v3a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1V6" stroke="currentColor" strokeWidth="1.7"/>
        <path d="M8 16h8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity="0.5"/>
      </svg>
    ),
    hydration: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M12 3C12 3 6 9.5 6 14a6 6 0 0 0 12 0c0-4.5-6-11-6-11Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" fill="currentColor" fillOpacity="0.1"/>
        <path d="M9 15.5a3 3 0 0 0 3 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.6"/>
      </svg>
    ),
    tubeless: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7"/>
        <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.7" fill="currentColor" fillOpacity="0.1"/>
        <path d="M16 8l-2.5 2.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        <circle cx="16.5" cy="7.5" r="1.5" fill="currentColor"/>
      </svg>
    ),
    pump: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="10" y="2" width="4" height="14" rx="2" stroke="currentColor" strokeWidth="1.7" fill="currentColor" fillOpacity="0.1"/>
        <path d="M12 16v3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
        <path d="M8 2h8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
        <path d="M9 19h6v2a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1v-2Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/>
        <path d="M12 6v6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity="0.4"/>
      </svg>
    ),
    gps: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="3" y="5" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="1.7" fill="currentColor" fillOpacity="0.08"/>
        <path d="M7 9l2 4 2-5 2 4 2-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="18" cy="6" r="2.5" fill="var(--r-orange)" stroke="white" strokeWidth="1"/>
      </svg>
    ),
    bib: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M8 3h8v10H8V3Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" fill="currentColor" fillOpacity="0.1"/>
        <path d="M8 7l-2 14h12L16 7" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/>
        <path d="M9 3C9 3 9 5 12 5s3-2 3-2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
      </svg>
    ),
  };
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[rgba(229,71,26,0.1)] text-[var(--r-orange)]">
      {icons[id] ?? icons.tool}
    </span>
  );
}

const GEAR: Record<string, GearSet> = {
  gravity: {
    protection: [
      { icon: "helmet", name: "Full-face helmet", desc: "Fox Rampage Pro Carbon · Bell Full-9 GPS · Troy Lee D4", url: "https://www.99bikes.com.au/search?q=full+face+mtb+helmet" },
      { icon: "knee", name: "Knee & shin guards", desc: "Fox Launch Pro · G-Form Pro-X3 · POI Joint VPD", url: "https://www.99bikes.com.au/search?q=mtb+knee+shin+guards" },
      { icon: "elbow", name: "Elbow pads", desc: "Fox Launch · Leatt 3DF · POI Elbow VPD Air", url: "https://www.99bikes.com.au/search?q=mtb+elbow+pads" },
      { icon: "back", name: "Back protector", desc: "POI Spine VPD Air Vest · Fox Baseframe Pro", url: "https://www.99bikes.com.au/search?q=mtb+back+protector" },
    ],
    clothing: [
      { icon: "jersey", name: "DH jersey", desc: "Fox Ranger · Leatt MTB Enduro · Troy Lee Ruckus", url: "https://www.99bikes.com.au/search?q=dh+mtb+jersey" },
      { icon: "shorts", name: "MTB shorts", desc: "Fox Ranger · 100% Airmatic · Endura MT500", url: "https://www.99bikes.com.au/search?q=mtb+shorts" },
      { icon: "gloves", name: "Full-finger gloves", desc: "Fox Ranger · Troy Lee Ace · 100% Airmatic", url: "https://www.99bikes.com.au/search?q=mtb+full+finger+gloves" },
    ],
    tools: [
      { icon: "tool", name: "Multi-tool + chain breaker", desc: "Crankbrothers M19 · Topeak Alien III", url: "https://www.99bikes.com.au/search?q=mtb+multi+tool" },
      { icon: "firstaid", name: "First aid kit", desc: "Adventure Medical Kit · basic trail first aid", url: "https://www.99bikes.com.au/search?q=first+aid+kit+outdoor" },
      { icon: "pack", name: "Hip/waist pack", desc: "Fox 3L · Dakine Hot Laps · Evoc Hip Pack", url: "https://www.99bikes.com.au/search?q=mtb+hip+pack" },
    ],
  },
  trail: {
    protection: [
      { icon: "helmet", name: "Trail helmet", desc: "Fox Speedframe Pro · Bell Super DH MIPS · Giro Manifest", url: "https://www.99bikes.com.au/search?q=trail+mtb+helmet" },
      { icon: "knee", name: "Knee pads", desc: "Fox Launch D3O · POI Joint VPD Air · Leatt 3DF", url: "https://www.99bikes.com.au/search?q=mtb+knee+pads" },
      { icon: "gloves", name: "Trail gloves", desc: "Fox Ranger · Giro DND · 100% Ridecamp", url: "https://www.99bikes.com.au/search?q=trail+mtb+gloves" },
    ],
    clothing: [
      { icon: "jersey", name: "Trail jersey", desc: "Fox Ranger · Patagonia Dirt Roamer · Endura MT500", url: "https://www.99bikes.com.au/search?q=trail+mtb+jersey" },
      { icon: "shorts", name: "Baggy shorts", desc: "Fox Ranger · Race Face Indy · 100% Airmatic", url: "https://www.99bikes.com.au/search?q=trail+mtb+shorts" },
      { icon: "shoes", name: "Trail shoes", desc: "Five Ten Freerider · Shimano ME7 · Giro Jacket II", url: "https://www.99bikes.com.au/search?q=mtb+trail+shoes" },
    ],
    tools: [
      { icon: "tool", name: "Multi-tool", desc: "Topeak Hexus · Crankbrothers M17", url: "https://www.99bikes.com.au/search?q=mtb+multi+tool" },
      { icon: "hydration", name: "Hydration pack", desc: "Camelbak MULE · Osprey Raptor 14 · Fox Oust 2L", url: "https://www.99bikes.com.au/search?q=mtb+hydration+pack" },
      { icon: "tubeless", name: "Tubeless repair kit", desc: "Dynaplug Mega Pill · Lezyne Plug Kit", url: "https://www.99bikes.com.au/search?q=tubeless+repair+kit" },
    ],
  },
  jump: {
    protection: [
      { icon: "helmet", name: "Half-lid or full-face", desc: "Fox Proframe RS · Bell Super Air R · Troy Lee Stage", url: "https://www.99bikes.com.au/search?q=dirt+jump+helmet" },
      { icon: "knee", name: "Knee pads", desc: "Fox Launch D3O · Leatt 3DF · 661 Recon", url: "https://www.99bikes.com.au/search?q=mtb+knee+pads" },
      { icon: "elbow", name: "Elbow pads", desc: "Fox Launch · POI Elbow VPD · 661 Raid", url: "https://www.99bikes.com.au/search?q=mtb+elbow+pads" },
    ],
    clothing: [
      { icon: "jersey", name: "Jersey", desc: "Fox Ranger · Troy Lee Sprint · Fasthouse Alloy", url: "https://www.99bikes.com.au/search?q=mtb+jersey" },
      { icon: "shorts", name: "Baggy shorts", desc: "Fox Ranger · 100% Airmatic · Race Face Indy", url: "https://www.99bikes.com.au/search?q=mtb+baggy+shorts" },
      { icon: "gloves", name: "Full-finger gloves", desc: "Fox Ranger · 100% Airmatic · Giro DND", url: "https://www.99bikes.com.au/search?q=mtb+full+finger+gloves" },
    ],
    tools: [
      { icon: "tool", name: "Multi-tool", desc: "Topeak Hexus II · Crankbrothers M10", url: "https://www.99bikes.com.au/search?q=bicycle+multi+tool" },
      { icon: "pump", name: "Shock pump", desc: "Fox HP · Topeak Shockblock DXG · RockShox HXi", url: "https://www.99bikes.com.au/search?q=shock+pump+mtb" },
      { icon: "tubeless", name: "Tube + CO₂", desc: "Lezyne CO₂ kit · Genuine Innovations", url: "https://www.99bikes.com.au/search?q=co2+inflator+bike" },
    ],
  },
  crossCountry: {
    protection: [
      { icon: "helmet", name: "XC/enduro helmet", desc: "Fox Proframe · Giro Switchblade · Bell Super Air", url: "https://www.99bikes.com.au/search?q=xc+mtb+helmet" },
      { icon: "gloves", name: "Light gloves", desc: "Fox Ranger Gel · 100% Ridecamp · Giro DND", url: "https://www.99bikes.com.au/search?q=xc+mtb+gloves" },
      { icon: "eyewear", name: "Eyewear", desc: "Oakley Jawbreaker · 100% Speedcraft · Smith Squad", url: "https://www.99bikes.com.au/search?q=cycling+eyewear" },
    ],
    clothing: [
      { icon: "jersey", name: "XC jersey", desc: "Fox Flexair · Shimano Explorer · Endura MT500", url: "https://www.99bikes.com.au/search?q=xc+mtb+jersey" },
      { icon: "bib", name: "Bib shorts / liner", desc: "Fox Ranger Liner · Endura Humvee · Race Face Indy", url: "https://www.99bikes.com.au/search?q=mtb+bib+shorts" },
      { icon: "shoes", name: "XC shoes", desc: "Five Ten Impact · Shimano ME7 · Northwave Escape", url: "https://www.99bikes.com.au/search?q=xc+mtb+shoes" },
    ],
    tools: [
      { icon: "hydration", name: "Hydration pack", desc: "Camelbak Rogue 2.5L · Osprey Katari", url: "https://www.99bikes.com.au/search?q=cycling+hydration+pack" },
      { icon: "tool", name: "Mini pump + CO₂", desc: "Topeak Road Morph · Lezyne Micro Floor Drive", url: "https://www.99bikes.com.au/search?q=mtb+mini+pump" },
      { icon: "gps", name: "GPS computer", desc: "Garmin Edge 840 · Wahoo ELEMNT Bolt", url: "https://www.99bikes.com.au/search?q=gps+cycling+computer" },
    ],
  },
  other: {
    protection: [
      { icon: "helmet", name: "MTB helmet", desc: "Fox Speedframe · Bell Spark · Giro Manifest", url: "https://www.99bikes.com.au/search?q=mtb+helmet" },
      { icon: "gloves", name: "Gloves", desc: "Fox Ranger · 100% Ridecamp · Giro DND", url: "https://www.99bikes.com.au/search?q=mtb+gloves" },
    ],
    clothing: [
      { icon: "jersey", name: "MTB jersey", desc: "Fox Ranger · Endura MT500 · Shimano Explorer", url: "https://www.99bikes.com.au/search?q=mtb+jersey" },
      { icon: "shorts", name: "Trail shorts", desc: "Fox Ranger · Race Face Indy · 100% Airmatic", url: "https://www.99bikes.com.au/search?q=mtb+shorts" },
    ],
    tools: [
      { icon: "tool", name: "Multi-tool", desc: "Crankbrothers M19 · Topeak Alien", url: "https://www.99bikes.com.au/search?q=bicycle+multi+tool" },
      { icon: "hydration", name: "Hydration pack", desc: "Camelbak MULE · Osprey Raptor", url: "https://www.99bikes.com.au/search?q=hydration+pack+mtb" },
    ],
  },
};

export default function ProfilePage() {
  const router = useRouter();
  const {
    hydrated,
    profile,
    saveProfile,
    clearProfileAndOnboarding,
    riders,
    activeRiderId,
    switchRider,
    removeRider,
  } = useRiderProfile();
  const { ids: favIds, toggle: toggleFav } = useFavourites();

  // Profile photo
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [backupNotice, setBackupNotice] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Edit form
  const [nickname, setNickname] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [style, setStyle] = useState<RidingStyle>("trail");
  const [preferEbike, setPreferEbike] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Gear tab
  const [gearTab, setGearTab] = useState<"protection" | "clothing" | "tools">("protection");
  const [familyModalOpen, setFamilyModalOpen] = useState(false);

  // Bike detail sheet
  const [selectedBike, setSelectedBike] = useState<Bike | null>(null);

  // Current bike
  const { entry: currentBikeEntry, save: saveCurrentBike } = useCurrentBike();
  const [bikeSearch, setBikeSearch] = useState("");
  const [bikeSearchOpen, setBikeSearchOpen] = useState(false);
  const [customBikeName, setCustomBikeName] = useState("");
  const [customBikeBrand, setCustomBikeBrand] = useState("");
  const [customBikeYear, setCustomBikeYear] = useState("");
  const [customBikePhoto, setCustomBikePhoto] = useState<string | null>(null);
  const [bikeMode, setBikeMode] = useState<"catalog" | "custom">("catalog");
  const customBikePhotoRef = useRef<HTMLInputElement>(null);

  const catalogSearchHits = bikeSearch.trim().length >= 2
    ? catalog.filter((b) =>
        `${b.brand} ${b.model}`.toLowerCase().includes(bikeSearch.toLowerCase())
      ).slice(0, 8)
    : [];

  const currentCatalogBike = currentBikeEntry?.type === "catalog"
    ? (catalog.find((b) => b.id === currentBikeEntry.bikeId)
        ?? catalog.find((b) => b.brand === currentBikeEntry.brand && b.model === currentBikeEntry.model))
        ?? null
    : null;

  useEffect(() => {
    if (!activeRiderId) return;
    try {
      let p = readRiderPhoto(activeRiderId);
      if (!p) {
        const legacy = localStorage.getItem(LEGACY_PROFILE_PHOTO_KEY);
        if (legacy) {
          writeRiderPhoto(activeRiderId, legacy);
          p = legacy;
        }
      }
      startTransition(() => setPhoto(p ?? null));
    } catch {
      startTransition(() => setPhoto(null));
    }
  }, [activeRiderId]);

  useEffect(() => {
    if (typeof window === "undefined" || !activeRiderId) return;
    const onRiderPhoto = (e: Event) => {
      const ce = e as CustomEvent<{ riderId?: string }>;
      if (ce.detail?.riderId != null && ce.detail.riderId !== activeRiderId) return;
      try {
        const p = readRiderPhoto(activeRiderId);
        startTransition(() => setPhoto(p ?? null));
      } catch {
        startTransition(() => setPhoto(null));
      }
    };
    window.addEventListener(RIDER_PHOTO_UPDATED_EVENT, onRiderPhoto);
    return () => window.removeEventListener(RIDER_PHOTO_UPDATED_EVENT, onRiderPhoto);
  }, [activeRiderId]);

  useEffect(() => {
    if (!profile) return;
    startTransition(() => {
      setNickname(profile.nickname);
      setHeightCm(String(profile.heightCm));
      setWeightKg(String(profile.weightKg));
      setStyle(profile.style);
      setPreferEbike(profile.preferEbike);
    });
  }, [profile]);

  // Fix loading bug: redirect when hydrated but no profile
  useEffect(() => {
    if (hydrated && !profile) {
      router.replace("/welcome");
    }
  }, [hydrated, profile, router]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const syncHash = () => {
      if (window.location.hash === "#profile-edit") setFormOpen(true);
    };
    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, []);

  if (!hydrated) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <span className="h-9 w-9 animate-spin rounded-full border-[3px] border-[var(--r-orange)] border-t-transparent" />
      </div>
    );
  }

  if (!profile) return null;

  const h = Number(heightCm);
  const w = Number(weightKg);
  const validH = h >= 100 && h <= 250;
  const validW = w >= 25 && w <= 250;
  const reach = validH ? approximateFrameReachCm(h) : null;
  const draftCat = validH && validW
    ? suggestedBikeCategory({ version: 1, nickname, heightCm: h, weightKg: w, style, preferEbike })
    : null;

  const displayName = profile.nickname.trim() || "Rider";
  const gear = GEAR[profile.style] ?? GEAR.trail;
  const gearItems = gear[gearTab];
  const preferEbikeAriaChecked: "true" | "false" = preferEbike ? "true" : "false";

  const favBikes = favIds
    .map((id) => catalog.find((b) => b.id === id))
    .filter((b): b is Bike => b !== undefined);

  async function handlePhotoClick() {
    photoInputRef.current?.click();
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoError(null);
    try {
      const dataUrl = await resizePhotoToDataUrl(file);
      if (!activeRiderId) return;
      writeRiderPhoto(activeRiderId, dataUrl);
      try {
        localStorage.setItem(LEGACY_PROFILE_PHOTO_KEY, dataUrl);
      } catch {
        /* ignore */
      }
      setPhoto(dataUrl);
      notifyRiderPhotoUpdated(activeRiderId);
      window.dispatchEvent(new Event(PROFILE_PHOTO_CHANGED));
    } catch {
      setPhotoError("Couldn’t use that image — try a smaller JPG or PNG.");
    }
    e.target.value = "";
  }

  function exportRippersBackup() {
    try {
      const payload = {
        exportedAt: new Date().toISOString(),
        version: 2,
        ridersState: localStorage.getItem(RIDERS_STORAGE_KEY),
        riderProfileLegacy: localStorage.getItem(RIDER_PROFILE_STORAGE_KEY),
        favouritesLegacy: localStorage.getItem("rippers:favourites:v1"),
        profilePhoto: localStorage.getItem(LEGACY_PROFILE_PHOTO_KEY),
        riderPhotos: Object.fromEntries(
          riders.map((r) => [r.id, localStorage.getItem(riderPhotoStorageKey(r.id))])
        ),
        currentBikeLegacy: localStorage.getItem("rippers:current-bike:v2"),
        savedTripsByRider: Object.fromEntries(
          riders.map((r) => [r.id, localStorage.getItem(savedTripsStorageKey(r.id))])
        ),
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `rippers-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      setBackupNotice("Export failed — check download permissions.");
      setTimeout(() => setBackupNotice(null), 6000);
    }
  }

  function scrollToProfileSection(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function handleCustomBikePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await resizePhotoToDataUrl(file);
      setCustomBikePhoto(dataUrl);
    } catch {}
    e.target.value = "";
  }

  function saveCustomBike() {
    if (!customBikeName.trim()) return;
    saveCurrentBike({
      type: "custom",
      name: customBikeName.trim(),
      brand: customBikeBrand.trim(),
      year: customBikeYear.trim(),
      photo: customBikePhoto,
    });
    setBikeSearch("");
  }

  function resetFormFromProfile() {
    if (!profile) return;
    setNickname(profile.nickname);
    setHeightCm(String(profile.heightCm));
    setWeightKg(String(profile.weightKg));
    setStyle(profile.style);
    setPreferEbike(profile.preferEbike);
    setError(null);
  }

  function cancelProfileEdit() {
    resetFormFromProfile();
    setFormOpen(false);
    if (typeof window !== "undefined" && window.location.hash === "#profile-edit") {
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    }
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!validH) { setError("Height should be between 100 and 250 cm."); return; }
    if (!validW) { setError("Weight should be between 25 and 250 kg."); return; }
    setError(null);
    saveProfile({ nickname: nickname.trim(), heightCm: h, weightKg: w, style, preferEbike });
    setSaved(true);
    setFormOpen(false);
    if (typeof window !== "undefined" && window.location.hash === "#profile-edit") {
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    }
    setTimeout(() => setSaved(false), 4000);
  }

  const numberNoSpin =
    "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

  return (
    <div className="r-home-bg w-full">
      <CreateFamilyModal open={familyModalOpen} onClose={() => setFamilyModalOpen(false)} />
      <div className="mx-auto w-full max-w-3xl px-4 pb-20 pt-5 md:px-6">
        <nav
          className="sticky top-0 z-30 -mx-4 mb-4 flex flex-wrap gap-1 border-b border-[var(--r-border)] bg-[var(--r-bg-canvas)]/95 px-2 py-2 backdrop-blur-md md:-mx-6 md:px-4"
          aria-label="Profile sections"
        >
          {(
            [
              ["profile-hero", "Profile"],
              ["profile-riders", "Family"],
              ["profile-tools", "Tools"],
              ["profile-ride", "Ride"],
              ["profile-favs", "Saved"],
              ["profile-gear", "Gear"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => scrollToProfileSection(id)}
              className="rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-[var(--r-muted)] transition hover:bg-white hover:text-[var(--foreground)]"
            >
              {label}
            </button>
          ))}
        </nav>

        {/* ── Hero card ── */}
        <div id="profile-hero" className="r-home-hero scroll-mt-24 px-5 py-6">
          <div className="flex items-center gap-4">
            {/* Photo */}
            <button
              type="button"
              onClick={handlePhotoClick}
              className="group relative shrink-0"
              aria-label="Change profile photo"
            >
              <div className="h-20 w-20 overflow-hidden rounded-2xl shadow-lg ring-4 ring-white">
                {photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photo} alt="Profile" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-orange-400 via-[var(--r-orange)] to-orange-700">
                    <span className="text-3xl font-bold text-white">
                      {displayName[0]?.toUpperCase() ?? "R"}
                    </span>
                  </div>
                )}
              </div>
              <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-white shadow-md ring-2 ring-white">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" stroke="#e5471a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </button>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              aria-label="Upload profile photo"
              className="sr-only"
              onChange={handlePhotoChange}
            />

            {/* Name + badges */}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold tracking-tight text-[var(--foreground)]">
                  {displayName}
                </h1>
                <span className="rounded-full bg-[var(--r-orange-soft)] px-2.5 py-0.5 text-[11px] font-bold text-[var(--r-orange)]">
                  {ridingStyleLabels(profile.style)}
                </span>
                {profile.preferEbike && (
                  <span className="rounded-full border border-[var(--r-orange)]/20 bg-orange-50 px-2.5 py-0.5 text-[11px] font-semibold text-[var(--r-orange)]">
                    eBike
                  </span>
                )}
              </div>
              <p className="mt-1 text-[12px] text-[var(--r-muted)]">Tap photo to change</p>
              {photoError && <p className="mt-1 text-[12px] font-medium text-red-600">{photoError}</p>}
            </div>
          </div>

          {/* Rider summary + inline edit (active rider) */}
          <div
            id="profile-edit"
            className="mt-5 scroll-mt-24 overflow-hidden rounded-2xl border border-[var(--r-border)] bg-white/90 shadow-sm"
          >
            <div className="flex items-center justify-between gap-2 border-b border-[var(--r-border)] bg-neutral-50/90 px-4 py-2.5 sm:px-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--r-muted)]">
                {formOpen ? "Update rider profile" : "Rider summary"}
              </p>
              {!formOpen ? (
                <button
                  type="button"
                  onClick={() => setFormOpen(true)}
                  className="shrink-0 rounded-lg px-2.5 py-1 text-[12px] font-semibold text-[var(--r-orange)] transition hover:bg-orange-50"
                >
                  Edit
                </button>
              ) : (
                <button
                  type="button"
                  onClick={cancelProfileEdit}
                  className="shrink-0 rounded-lg px-2.5 py-1 text-[12px] font-semibold text-[var(--r-muted)] transition hover:bg-neutral-100 hover:text-[var(--foreground)]"
                >
                  Cancel
                </button>
              )}
            </div>

            {!formOpen ? (
              <>
                {[
                  { label: "Height", value: `${profile.heightCm} cm` },
                  { label: "Weight", value: `${profile.weightKg} kg` },
                  { label: "Est. reach", value: `~${approximateFrameReachCm(profile.heightCm)} mm` },
                  { label: "Riding style", value: ridingStyleLabels(profile.style) },
                  { label: "Bike category", value: suggestedBikeCategory(profile) ?? "Trail" },
                  { label: "eBike interest", value: profile.preferEbike ? "Yes" : "No" },
                ].map(({ label, value }, i, arr) => (
                  <div
                    key={label}
                    className={`flex items-center justify-between px-4 py-2.5 sm:px-5 ${i < arr.length - 1 ? "border-b border-[var(--r-border)]" : ""}`}
                  >
                    <p className="text-[13px] text-[var(--r-muted)]">{label}</p>
                    <p className="text-[13px] font-bold text-[var(--foreground)]">{value}</p>
                  </div>
                ))}
                <div className="border-t border-[var(--r-border)] bg-neutral-50/40 px-4 py-3 sm:px-5">
                  <button
                    type="button"
                    onClick={() => setFormOpen(true)}
                    className="w-full rounded-xl border border-[var(--r-orange)]/35 bg-white py-2.5 text-[13px] font-semibold text-[var(--r-orange)] shadow-sm transition hover:bg-orange-50/80"
                  >
                    Update height, weight &amp; riding style
                  </button>
                </div>
              </>
            ) : (
              <form onSubmit={handleSave} className="space-y-4 px-4 py-4 sm:space-y-5 sm:px-5 sm:py-5">
                {riders.length > 1 ? (
                  <p className="rounded-lg border border-[var(--r-border)] bg-neutral-50/80 px-3 py-2 text-[11px] leading-snug text-[var(--r-muted)]">
                    Updates apply to the <strong className="text-[var(--foreground)]">active</strong> rider only. Switch
                    them in <strong className="text-[var(--foreground)]">My Family</strong> (section below)
                    first if you meant to edit someone else.
                  </p>
                ) : null}
                <div className="min-w-0">
                  <label className="text-xs font-semibold text-[var(--r-muted)]" htmlFor="profile-nickname">
                    Nickname <span className="font-normal opacity-60">(optional)</span>
                  </label>
                  <input
                    id="profile-nickname"
                    type="text"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder="What should we call you?"
                    className="r-field mt-2 w-full min-w-0 px-4 py-3 text-sm"
                    maxLength={80}
                    autoComplete="nickname"
                  />
                </div>

                <div className="grid min-w-0 grid-cols-2 gap-3 sm:gap-4">
                  <div className="min-w-0">
                    <label className="text-xs font-semibold text-[var(--r-muted)]" htmlFor="profile-height">
                      Height
                    </label>
                    <div className="relative mt-2">
                      <input
                        id="profile-height"
                        type="number"
                        inputMode="numeric"
                        required
                        min={100}
                        max={250}
                        value={heightCm}
                        onChange={(e) => setHeightCm(e.target.value)}
                        className={`r-field w-full min-w-0 max-w-full px-4 py-3 pr-10 text-sm box-border ${numberNoSpin}`}
                      />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-[var(--r-muted)]">
                        cm
                      </span>
                    </div>
                  </div>
                  <div className="min-w-0">
                    <label className="text-xs font-semibold text-[var(--r-muted)]" htmlFor="profile-weight">
                      Weight
                    </label>
                    <div className="relative mt-2">
                      <input
                        id="profile-weight"
                        type="number"
                        inputMode="decimal"
                        required
                        min={25}
                        max={250}
                        value={weightKg}
                        onChange={(e) => setWeightKg(e.target.value)}
                        className={`r-field w-full min-w-0 max-w-full px-4 py-3 pr-10 text-sm box-border ${numberNoSpin}`}
                      />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-[var(--r-muted)]">
                        kg
                      </span>
                    </div>
                  </div>
                </div>

                {reach != null && (
                  <p className="rounded-xl bg-[rgba(229,71,26,0.06)] px-4 py-3 text-[12px] leading-relaxed text-[var(--r-muted)]">
                    Estimated reach: <strong className="text-[var(--foreground)]">~{reach}mm</strong>
                    {draftCat && (
                      <>
                        {" "}
                        · Category: <strong className="text-[var(--foreground)]">{draftCat}</strong>
                      </>
                    )}
                    <span className="ml-1 opacity-70">— confirm fit with retailer before buying.</span>
                  </p>
                )}

                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[var(--r-muted)]">Riding style</p>
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {RIDING_STYLE_OPTIONS.map((opt) => {
                      const active = style === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setStyle(opt.value)}
                          className={`flex min-w-0 flex-col items-start rounded-xl border px-3 py-3 text-left transition-all ${
                            active
                              ? "border-[var(--r-orange)] bg-[var(--r-orange-soft)] shadow-sm"
                              : "border-[var(--r-border)] bg-white hover:border-[var(--r-orange)]/40"
                          }`}
                        >
                          <span className={`h-2 w-2 shrink-0 rounded-full ${active ? "bg-[var(--r-orange)]" : "bg-neutral-300"}`} />
                          <span
                            className={`mt-2 text-[12px] font-semibold leading-tight sm:text-[13px] ${active ? "text-[var(--r-orange)]" : "text-[var(--foreground)]"}`}
                          >
                            {opt.label}
                          </span>
                          <span className="mt-0.5 line-clamp-2 text-[9px] leading-tight text-[var(--r-muted)] sm:text-[10px]">
                            {opt.hint}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-[var(--r-border)] bg-neutral-50/80 px-4 py-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--foreground)]">Interested in e-bikes</p>
                    <p className="mt-0.5 text-[11px] leading-snug text-[var(--r-muted)]">Prioritises eMTB · boosts rental shops on the trip map</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={preferEbikeAriaChecked}
                    aria-label="Interested in e-bikes"
                    onClick={() => setPreferEbike((v) => !v)}
                    className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${preferEbike ? "bg-[var(--r-orange)]" : "bg-neutral-200"}`}
                  >
                    <span
                      className={`absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow-sm transition-transform ${preferEbike ? "translate-x-5" : "translate-x-0"}`}
                    />
                  </button>
                </div>

                {error ? (
                  <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">{error}</p>
                ) : null}

                <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={cancelProfileEdit}
                    className="rounded-xl border border-[var(--r-border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--foreground)] transition hover:bg-neutral-50 sm:min-w-[7rem]"
                  >
                    Discard
                  </button>
                  <button type="submit" className="r-btn-ios-primary rounded-xl py-3 text-sm font-semibold sm:min-w-[10rem]">
                    Save changes
                  </button>
                </div>
              </form>
            )}
          </div>

          {saved && (
            <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[12px] text-emerald-900">
              ✓ Profile saved — catalogue and ride map updated.
            </div>
          )}
        </div>

        <MyFamilySection
          riders={riders}
          activeRiderId={activeRiderId}
          switchRider={switchRider}
          removeRider={removeRider}
          onOpenCreateFamily={() => setFamilyModalOpen(true)}
          fullPageAddHref={householdAddRiderHref("/profile")}
          onViewCatalogBike={(bike) => setSelectedBike(bike)}
        />

        {/* ── Tools ── */}
        <div id="profile-tools" className="mt-5 scroll-mt-24">
          <h2 className="mb-2 px-1 text-[15px] font-semibold text-[var(--foreground)]">Tools</h2>
          <div className="overflow-hidden rounded-2xl border border-[var(--r-border)] bg-white">
            {[
              { label: "Sizing Guide", href: "/sizing", icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden><rect x="2" y="8" width="20" height="8" rx="2" stroke="currentColor" strokeWidth="1.7"/><path d="M6 8V6M10 8V5M14 8V6M18 8V5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              )},
              { label: "Browse bikes", href: "/", icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden><circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.7"/><path d="m21 21-4.35-4.35" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>
              )},
              { label: "Saved bikes", href: "/watch", icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" stroke="currentColor" strokeWidth="1.7"/></svg>
              )},
              { label: "Plan a ride", href: "/trip", icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden><rect x="3" y="3" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.7"/><rect x="13" y="3" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.7"/><rect x="3" y="13" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.7"/><rect x="13" y="13" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.7"/></svg>
              )},
            ].map(({ label, href, icon }, i, arr) => (
              <Link
                key={label}
                href={href}
                className={`flex items-center gap-3.5 px-4 py-3.5 no-underline transition-colors hover:bg-neutral-50 ${i < arr.length - 1 ? "border-b border-[var(--r-border)]" : ""}`}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-[var(--r-muted)]">
                  {icon}
                </span>
                <p className="flex-1 text-[14px] font-medium text-[var(--foreground)]">{label}</p>
                <span className="text-[14px] text-[var(--r-muted)]">›</span>
              </Link>
            ))}
          </div>
          <button
            type="button"
            onClick={exportRippersBackup}
            className="mt-3 w-full rounded-2xl border border-dashed border-[var(--r-border)] bg-white px-4 py-3 text-left text-[13px] font-semibold text-[var(--foreground)] transition hover:border-[var(--r-orange)]/40 hover:bg-[rgba(229,71,26,0.04)]"
          >
            Export my data (JSON backup)
            <span className="mt-0.5 block text-[11px] font-normal text-[var(--r-muted)]">
              Profile, saved bikes, photo, and current ride — for moving devices or your records.
            </span>
          </button>
          {backupNotice && <p className="mt-2 text-[12px] font-medium text-red-600">{backupNotice}</p>}
        </div>

        {/* ── Current Ride ── */}
        <div id="profile-ride" className="mt-5 scroll-mt-24">
          <div className="mb-3 flex items-center justify-between px-1">
            <h2 className="text-[15px] font-semibold text-[var(--foreground)]">My current ride</h2>
            {currentBikeEntry && (
              <button
                type="button"
                onClick={() => saveCurrentBike(null)}
                className="text-[12px] font-semibold text-[var(--r-muted)] no-underline"
              >
                Remove
              </button>
            )}
          </div>

          {/* Current bike display */}
          {currentBikeEntry ? (
            <div className="r-glass-well flex items-center gap-4 px-4 py-4">
              <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-[#f5f3ef]">
                {currentBikeEntry.type === "catalog" && currentCatalogBike ? (
                  <BikeProductImage
                    bikeId={currentCatalogBike.id}
                    alt={`${currentCatalogBike.brand} ${currentCatalogBike.model}`}
                    className="h-full w-full object-contain p-1"
                  />
                ) : currentBikeEntry.type === "custom" && currentBikeEntry.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={currentBikeEntry.photo} alt="My bike" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-2xl">🚵</div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                {currentBikeEntry.type === "catalog" && currentCatalogBike ? (
                  <>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--r-muted)]">{currentCatalogBike.brand}</p>
                    <p className="text-[15px] font-bold text-[var(--foreground)]">{currentCatalogBike.model}</p>
                    <p className="mt-0.5 text-[12px] text-[var(--r-muted)]">{currentCatalogBike.category} · {currentCatalogBike.travel} · {currentCatalogBike.wheel}</p>
                    <button
                      type="button"
                      onClick={() => setSelectedBike(currentCatalogBike)}
                      className="mt-1.5 text-[11px] font-semibold text-[var(--r-orange)]"
                    >
                      View full specs →
                    </button>
                  </>
                ) : currentBikeEntry.type === "custom" ? (
                  <>
                    {currentBikeEntry.brand && (
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--r-muted)]">{currentBikeEntry.brand}</p>
                    )}
                    <p className="text-[15px] font-bold text-[var(--foreground)]">{currentBikeEntry.name}</p>
                    {currentBikeEntry.year && (
                      <p className="mt-0.5 text-[12px] text-[var(--r-muted)]">{currentBikeEntry.year}</p>
                    )}
                  </>
                ) : null}
              </div>
            </div>
          ) : (
            /* Bike picker */
            <div className="r-glass-well space-y-3 px-4 py-4">
              {/* Mode toggle */}
              <div className="flex gap-1 rounded-xl bg-neutral-100 p-1">
                {(["catalog", "custom"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setBikeMode(m)}
                    className={`flex-1 rounded-lg py-1.5 text-[12px] font-semibold transition-all ${
                      bikeMode === m ? "bg-white text-[var(--foreground)] shadow-sm" : "text-[var(--r-muted)]"
                    }`}
                  >
                    {m === "catalog" ? "Search catalogue" : "Add custom bike"}
                  </button>
                ))}
              </div>

              {bikeMode === "catalog" ? (
                <div className="relative">
                  <input
                    type="search"
                    placeholder="Search brand or model…"
                    value={bikeSearch}
                    onChange={(e) => { setBikeSearch(e.target.value); setBikeSearchOpen(true); }}
                    onFocus={() => catalogSearchHits.length && setBikeSearchOpen(true)}
                    className="r-field-ios w-full px-3 py-2.5 text-[14px]"
                    autoComplete="off"
                  />
                  {bikeSearchOpen && catalogSearchHits.length > 0 && (
                    <ul className="absolute left-0 right-0 top-full z-40 mt-1 max-h-52 overflow-auto rounded-xl border border-[var(--r-border)] bg-white shadow-xl">
                      {catalogSearchHits.map((b) => (
                        <li key={b.id}>
                          <button
                            type="button"
                            className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-orange-50"
                            onClick={() => {
                              saveCurrentBike({ type: "catalog", bikeId: b.id, brand: b.brand, model: b.model, year: b.year });
                              setBikeSearch("");
                              setBikeSearchOpen(false);
                            }}
                          >
                            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-[#f5f3ef]">
                              <BikeProductImage bikeId={b.id} alt={b.model} className="h-full w-full object-contain p-0.5" />
                            </div>
                            <div>
                              <p className="text-[12px] font-semibold text-[var(--foreground)]">{b.brand} {b.model}</p>
                              <p className="text-[11px] text-[var(--r-muted)]">{b.category} · {b.year}</p>
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {bikeSearch.trim().length >= 2 && catalogSearchHits.length === 0 && (
                    <p className="mt-2 text-[12px] text-[var(--r-muted)]">No matches — try the custom bike tab.</p>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Brand (e.g. Trek)"
                      value={customBikeBrand}
                      onChange={(e) => setCustomBikeBrand(e.target.value)}
                      className="r-field-ios px-3 py-2.5 text-[14px]"
                    />
                    <input
                      type="text"
                      placeholder="Year (e.g. 2023)"
                      value={customBikeYear}
                      onChange={(e) => setCustomBikeYear(e.target.value)}
                      className="r-field-ios px-3 py-2.5 text-[14px]"
                    />
                  </div>
                  <input
                    type="text"
                    placeholder="Model name (e.g. Fuel EX 9.9)"
                    value={customBikeName}
                    onChange={(e) => setCustomBikeName(e.target.value)}
                    className="r-field-ios w-full px-3 py-2.5 text-[14px]"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => customBikePhotoRef.current?.click()}
                      className="flex items-center gap-1.5 rounded-xl border border-[var(--r-border)] bg-white px-3 py-2 text-[12px] font-semibold text-[var(--foreground)]"
                    >
                      {customBikePhoto ? "✓ Photo added" : "+ Add photo"}
                    </button>
                    {customBikeName.trim() && (
                      <button
                        type="button"
                        onClick={saveCustomBike}
                        className="flex-1 rounded-xl bg-[var(--r-orange)] py-2 text-[13px] font-semibold text-white"
                      >
                        Save my bike
                      </button>
                    )}
                  </div>
                  <input
                    ref={customBikePhotoRef}
                    type="file"
                    accept="image/*"
                    aria-label="Upload photo of your custom bike"
                    className="sr-only"
                    onChange={handleCustomBikePhoto}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Favourites ── */}
        <div id="profile-favs" className="mt-5 scroll-mt-24">
          <div className="mb-3 flex items-center justify-between px-1">
            <h2 className="text-[15px] font-semibold text-[var(--foreground)]">
              My favourites
              {favBikes.length > 0 && (
                <span className="ml-2 rounded-full bg-[var(--r-orange-soft)] px-2 py-0.5 text-[11px] font-bold text-[var(--r-orange)]">
                  {favBikes.length}
                </span>
              )}
            </h2>
            <Link href="/#results" className="text-[12px] font-semibold text-[var(--r-orange)] no-underline">
              Browse bikes →
            </Link>
          </div>

          {favBikes.length === 0 ? (
            <div className="r-glass-well flex flex-col items-center px-6 py-8 text-center">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" className="mb-3 opacity-30" aria-hidden>
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" stroke="currentColor" strokeWidth="1.6" />
              </svg>
              <p className="text-[13px] text-[var(--r-muted)]">No saved bikes yet.</p>
              <p className="mt-1 text-[12px] text-[var(--r-muted)]">
                Tap the ♡ on any bike tile to save it here.
              </p>
            </div>
          ) : (
            <div
              id="profile-favs-carousel"
              className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 pt-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
            >
              {favBikes.map((bike) => {
                const best = getBestPrice(bike);
                return (
                  <article
                    key={bike.id}
                    className="group relative flex w-36 shrink-0 snap-start flex-col overflow-hidden rounded-2xl border border-[var(--r-border)] bg-white shadow-sm ring-1 ring-black/[0.02] transition active:scale-95"
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedBike(bike)}
                      aria-label={`View ${bike.brand} ${bike.model} specs`}
                      className="absolute inset-0 z-[1] rounded-2xl border-0 bg-transparent p-0 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--r-orange)] focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                    />
                    <div className="relative z-[2] flex flex-col pointer-events-none">
                      <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#f5f3ef]">
                        <BikeProductImage
                          bikeId={bike.id}
                          alt={bike.model}
                          className="h-full w-full object-contain p-2"
                        />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            toggleFav(bike.id);
                          }}
                          className="pointer-events-auto absolute right-1.5 top-1.5 z-[3] flex h-6 w-6 items-center justify-center rounded-full bg-white/90 shadow"
                          aria-label="Remove from favourites"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="#e5471a" aria-hidden>
                            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" stroke="#e5471a" strokeWidth="1.6" />
                          </svg>
                        </button>
                      </div>
                      <div className="px-2.5 pb-2.5 pt-2 text-left">
                        <p className="text-[9px] font-semibold uppercase tracking-wider text-[var(--r-muted)]">{bike.brand}</p>
                        <p className="mt-0.5 line-clamp-2 text-[12px] font-semibold leading-snug text-[var(--foreground)]">{bike.model}</p>
                        <p className="mt-1.5 text-[13px] font-bold text-[var(--r-price-green)]">
                          {best != null
                            ? new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(best)
                            : "—"}
                        </p>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Gear recommendations ── */}
        <div id="profile-gear" className="mt-6 scroll-mt-24">
          <h2 className="mb-3 px-1 text-[15px] font-semibold text-[var(--foreground)]">
            Gear for your ride
            <span className="ml-2 text-[12px] font-normal text-[var(--r-muted)]">
              {ridingStyleLabels(profile.style)} picks
            </span>
          </h2>

          {/* Gear tabs */}
          <div className="mb-3 flex gap-1 rounded-2xl border border-[var(--r-border)] bg-white/60 p-1">
            {(["protection", "clothing", "tools"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setGearTab(tab)}
                className={`flex-1 rounded-xl py-2 text-[12px] font-semibold capitalize transition-all ${
                  gearTab === tab
                    ? "bg-[var(--r-orange)] text-white shadow-sm"
                    : "text-[var(--r-muted)] hover:text-[var(--foreground)]"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            {gearItems.map((item) => (
              <a
                key={item.name}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="r-ios-card flex items-start gap-3.5 px-4 py-4 no-underline transition active:scale-[0.99]"
              >
                <GearIcon id={item.icon} />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-[var(--foreground)]">{item.name}</p>
                  <p className="mt-0.5 text-[11px] leading-snug text-[var(--r-muted)]">{item.desc}</p>
                </div>
                <span className="mt-0.5 shrink-0 text-[12px] font-semibold text-[var(--r-orange)]">Shop →</span>
              </a>
            ))}
          </div>
        </div>

        {/* ── Account ── */}
        <p className="mx-4 mt-6 text-center text-[11px] leading-relaxed text-[var(--r-muted)]">
          Rippers uses one light theme so bike photography and cards stay consistent with the catalogue. A dedicated dark
          mode may arrive later.
        </p>

        <div className="mt-4 rounded-2xl border border-[var(--r-border)] px-5 py-4">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--r-muted)]">Account</p>
          <p className="text-[12px] leading-relaxed text-[var(--r-muted)]">
            Resetting clears your profile and restarts onboarding. Favourites stored in this browser will also be cleared.
          </p>
          <button
            type="button"
            onClick={() => {
              clearProfileAndOnboarding();
              router.replace("/welcome");
            }}
            className="mt-3 rounded-lg border border-neutral-200 px-4 py-2 text-[12px] font-semibold text-neutral-600 transition-colors hover:bg-neutral-50"
          >
            Reset rider account
          </button>
        </div>
      </div>

      {/* Bike detail sheet */}
      <BikeDetailSheet bike={selectedBike} onClose={() => setSelectedBike(null)} />
    </div>
  );
}
