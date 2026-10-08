"use client";

import { useEffect, useRef } from "react";
import type { TrackingLocation } from "@/lib/api";

type MapsApi = {
  maps: {
    Map: new (
      el: HTMLElement,
      opts: Record<string, unknown>,
    ) => {
      setCenter: (c: { lat: number; lng: number }) => void;
      setZoom: (z: number) => void;
      fitBounds: (b: unknown, padding?: number) => void;
    };
    Marker: new (opts: Record<string, unknown>) => {
      setMap: (m: unknown) => void;
      addListener: (event: string, fn: () => void) => void;
    };
    InfoWindow: new (opts: { content: string }) => {
      open: (opts: { map: unknown; anchor: unknown }) => void;
    };
    LatLngBounds: new () => {
      extend: (p: { lat: number; lng: number }) => void;
    };
  };
};

declare global {
  interface Window {
    google?: MapsApi;
    __stlMapsPromise?: Promise<void>;
  }
}

function loadMapsScript(apiKey: string): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.google?.maps) return Promise.resolve();
  if (window.__stlMapsPromise) return window.__stlMapsPromise;

  window.__stlMapsPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-stl-maps="1"]',
    );
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () =>
        reject(new Error("Failed to load Google Maps")),
      );
      return;
    }
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}`;
    script.async = true;
    script.defer = true;
    script.dataset.stlMaps = "1";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(script);
  });
  return window.__stlMapsPromise;
}

type Props = {
  locations: TrackingLocation[];
  apiKey: string;
};

export function TrackingMap({ locations, apiKey }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<InstanceType<MapsApi["maps"]["Map"]> | null>(null);
  const markersRef = useRef<InstanceType<MapsApi["maps"]["Marker"]>[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      if (!apiKey || !mapRef.current) return;
      try {
        await loadMapsScript(apiKey);
        if (cancelled || !mapRef.current || !window.google?.maps) return;
        if (!mapInstance.current) {
          mapInstance.current = new window.google.maps.Map(mapRef.current, {
            center: { lat: 25.2048, lng: 55.2708 },
            zoom: 10,
            mapTypeControl: false,
            streetViewControl: false,
          });
        }
      } catch {
        // Map unavailable without key / network
      }
    }
    void init();
    return () => {
      cancelled = true;
    };
  }, [apiKey]);

  useEffect(() => {
    const map = mapInstance.current;
    const g = window.google;
    if (!map || !g?.maps) return;

    for (const marker of markersRef.current) {
      marker.setMap(null);
    }
    markersRef.current = [];

    const bounds = new g.maps.LatLngBounds();
    for (const loc of locations) {
      if (typeof loc.lat !== "number" || typeof loc.lng !== "number") continue;
      const position = { lat: loc.lat, lng: loc.lng };
      const marker = new g.maps.Marker({
        map,
        position,
        title: loc.name || "Salesman",
      });
      const info = new g.maps.InfoWindow({
        content: `<div style="font:13px/1.4 sans-serif"><strong>${loc.name || "Salesman"}</strong><br/>${loc.email || ""}</div>`,
      });
      marker.addListener("click", () => info.open({ map, anchor: marker }));
      markersRef.current.push(marker);
      bounds.extend(position);
    }
    if (locations.length === 1) {
      map.setCenter({ lat: locations[0].lat, lng: locations[0].lng });
      map.setZoom(13);
    } else if (locations.length > 1) {
      map.fitBounds(bounds, 48);
    }
  }, [locations]);

  if (!apiKey) {
    return (
      <div className="flex h-[420px] items-center justify-center rounded-2xl border border-line bg-white text-sm text-slate-500">
        Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to show the map.
      </div>
    );
  }

  return (
    <div
      ref={mapRef}
      className="h-[420px] w-full overflow-hidden rounded-2xl border border-line bg-slate-100"
    />
  );
}
