"use client";

import { useEffect, useState } from "react";

const FALLBACK = "/bike-placeholder.svg";

type Props = {
  bikeId: number;
  alt: string;
  className?: string;
};

/** Same-origin proxy fixes retailer hotlink blocks; Unsplash fallback on double-fault. */
export default function BikeProductImage({ bikeId, alt, className }: Props) {
  const proxySrc = `/api/bike-img/${bikeId}`;
  const [src, setSrc] = useState(proxySrc);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setSrc(proxySrc);
    setFailed(false);
  }, [proxySrc]);

  if (failed) {
    return (
      <div
        className={className}
        role="img"
        aria-label={alt}
        style={{
          background:
            "radial-gradient(120% 90% at 20% 10%, rgb(var(--c-surface) / 0.9) 0%, rgb(var(--c-surface) / 0.6) 42%, rgb(var(--c-bg) / 0.94) 100%)",
        }}
      >
        <div className="flex h-full w-full items-center justify-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-stroke bg-surface-raised px-3 py-1 text-[11px] font-semibold text-text-2 shadow-sm">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand" aria-hidden />
            Image unavailable
          </div>
        </div>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- CDN fallbacks still external; proxies are same-origin
    <img
      src={src}
      alt={alt}
      className={`r-bike-img ${className ?? ""}`}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => {
        setSrc((cur) => {
          if (cur === proxySrc) {
            return FALLBACK;
          }
          setFailed(true);
          return cur;
        });
      }}
    />
  );
}
