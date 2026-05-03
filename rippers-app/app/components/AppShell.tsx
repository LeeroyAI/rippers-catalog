"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useRiderProfile } from "@/src/state/rider-profile-context";

function stroke(active: boolean) {
  return active ? "#e5471a" : "#8a8783";
}

function IconHome({ active }: { active: boolean }) {
  const s = stroke(active);
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 11.5 12 5l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-8.5Z"
        stroke={s}
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  );
}


function IconMapPin({ active }: { active: boolean }) {
  const s = stroke(active);
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 21s7-5.5 7-11A7 7 0 1 0 5 10c0 5.5 7 11 7 11Z"
        stroke={s}
        strokeWidth="1.65"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="10" r="2.4" fill={s} stroke="none" opacity={active ? 0.85 : 0.75} />
    </svg>
  );
}

function IconHeart({ active }: { active: boolean }) {
  const s = stroke(active);
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 20s-7-5.09-9.3-9.06C1.43 11.93 4.13 9.5 8 11.5c4-4 14 7 14 11.23 0 .95-.93 3.73-10 14.73Z"
        stroke={s}
        strokeWidth="1.65"
        strokeLinejoin="round"
        fill={active ? "rgba(229,71,26,0.12)" : "none"}
      />
    </svg>
  );
}

function IconCompare({ active }: { active: boolean }) {
  const s = stroke(active);
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M9 18V6m0 12 3-4m6 10V4m0 16-3-4" stroke={s} strokeWidth="1.65" strokeLinecap="round" />
    </svg>
  );
}

function IconPerson({ active }: { active: boolean }) {
  const s = stroke(active);
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="8.5" r="3.5" stroke={s} strokeWidth="1.65" />
      <path
        d="M7 21v-.8a5 5 0 0 1 10 0V21"
        stroke={s}
        strokeWidth="1.65"
        strokeLinecap="round"
      />
    </svg>
  );
}

const TABS = [
  { href: "/", label: "Home", Icon: IconHome },
  { href: "/trip", label: "Ride", Icon: IconMapPin },
  { href: "/watch", label: "Watch", Icon: IconHeart },
  { href: "/compare", label: "Compare", Icon: IconCompare },
  { href: "/profile", label: "Profile", Icon: IconPerson },
] as const;

const PROFILE_PHOTO_KEY = "rippers:profile-photo:v1";
/** Dispatched from Profile (same tab) after `localStorage` is updated — `storage` only fires across tabs. */
const PROFILE_PHOTO_CHANGED = "rippers:profile-photo-changed";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [desktopScrolled, setDesktopScrolled] = useState(false);
  const { profile } = useRiderProfile();
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);

  useEffect(() => {
    function readProfilePhoto() {
      try {
        setProfilePhoto(localStorage.getItem(PROFILE_PHOTO_KEY));
      } catch {
        setProfilePhoto(null);
      }
    }
    readProfilePhoto();
    window.addEventListener(PROFILE_PHOTO_CHANGED, readProfilePhoto);
    function onStorage(e: StorageEvent) {
      if (e.key === PROFILE_PHOTO_KEY) readProfilePhoto();
    }
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(PROFILE_PHOTO_CHANGED, readProfilePhoto);
      window.removeEventListener("storage", onStorage);
    };
  }, [pathname]);

  useEffect(() => {
    const onScroll = () => {
      setDesktopScrolled(window.scrollY > 16);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function isActive(tab: (typeof TABS)[number]): boolean {
    const p = pathname;
    if (tab.href === "/") return p === "/";
    return p.startsWith(tab.href);
  }

  return (
    <div className="flex min-h-full flex-col">
      <header
        className={`r-desktop-header ${desktopScrolled ? "r-desktop-header-scrolled" : ""}`}
        aria-label="Desktop main navigation"
      >
        <div className="r-desktop-header-inner">
          <Link href="/" className="r-desktop-brand no-underline" prefetch>
            <span className="flex h-10 w-10 shrink-0 overflow-hidden rounded-[0.65rem] shadow-sm">
              <Image
                src="/icons/icon-512.png"
                alt="Rippers"
                width={40}
                height={40}
                className="h-full w-full object-contain"
                sizes="40px"
              />
            </span>
            <span className="text-sm font-semibold tracking-tight text-[var(--foreground)]">Rippers</span>
          </Link>

          <Link
            href="/#home-query"
            scroll={false}
            title="Jump to search and filters on Home"
            className="r-desktop-search-chip max-[1099px]:min-w-0 max-[1099px]:max-w-[10.5rem] max-[1099px]:gap-1.5 max-[1099px]:px-2.5 no-underline"
          >
            <span className="text-[var(--foreground)]/75 max-[1099px]:hidden">Jump to search &amp; filters on Home</span>
            <span className="hidden max-[1099px]:inline text-[12px] font-semibold text-[var(--foreground)]/80" aria-hidden>
              Search
            </span>
            <span className="r-desktop-search-chip-cta">Go</span>
          </Link>

          <nav className="r-desktop-links" aria-label="Primary">
            {TABS.map((tab) => {
              const active = isActive(tab);
              return (
                <Link
                  key={`desktop-${tab.label}-${tab.href}`}
                  href={tab.href}
                  prefetch={tab.href === "/"}
                  className={`r-desktop-link ${active ? "r-desktop-link-active" : ""}`}
                >
                  {tab.label}
                </Link>
              );
            })}
            <Link
              href="/sizing"
              className={`r-desktop-link ${pathname === "/sizing" ? "r-desktop-link-active" : ""}`}
            >
              Sizing
            </Link>
          </nav>

          {/* Profile avatar */}
          <Link
            href="/profile"
            className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-neutral-100 ring-2 ring-[var(--r-border)] transition-transform hover:scale-105"
            aria-label="Your profile"
          >
            {profilePhoto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profilePhoto} alt="Profile" className="h-full w-full object-cover" />
            ) : profile?.nickname ? (
              <span className="text-[13px] font-bold text-[var(--r-orange)]">
                {profile.nickname.charAt(0).toUpperCase()}
              </span>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
                <circle cx="12" cy="8.5" r="3.5" stroke="var(--r-muted)" strokeWidth="1.6" />
                <path d="M7 21v-.8a5 5 0 0 1 10 0V21" stroke="var(--r-muted)" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            )}
          </Link>

        </div>
      </header>

      <div className="r-shell-main flex-1">{children}</div>
      <nav className="r-ios-tabbar-shell r-mobile-tabbar" aria-label="Main">
        <ul className="flex flex-1 justify-between gap-0.5 px-2 py-1.5 md:gap-1 md:px-3">
          {TABS.map((tab) => {
            const active = isActive(tab);
            const Icon = tab.Icon;
            return (
              <li key={`${tab.label}-${tab.href}`} className="flex flex-1">
                <Link
                  href={tab.href}
                  prefetch={tab.href === "/"}
                  data-active={active}
                  className={`r-tab-item flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-full py-2 text-[11px] font-semibold leading-tight tracking-tight no-underline transition-colors sm:text-[12px] ${
                    active ? "text-[var(--r-orange)]" : "text-[var(--r-muted)]"
                  }`}
                >
                  <Icon active={active} />
                  {tab.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
