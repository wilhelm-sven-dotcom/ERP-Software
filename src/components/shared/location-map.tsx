"use client";

import dynamic from "next/dynamic";

// react-leaflet greift auf `window` zu → nur clientseitig laden (kein SSR).
const LocationMapInner = dynamic(() => import("./location-map-inner"), {
  ssr: false,
  loading: () => (
    <div className="bg-muted h-64 w-full animate-pulse rounded-lg" />
  ),
});

export function LocationMap({
  lat,
  lon,
  label,
}: {
  lat: number;
  lon: number;
  label?: string;
}) {
  return <LocationMapInner lat={lat} lon={lon} label={label} />;
}
