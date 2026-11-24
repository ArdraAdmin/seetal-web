"use client";

import { useEffect, useRef, useState } from "react";
import type { TrackingLocation } from "@/lib/api";
import {
  SALES_MAP_FOCUS_ZOOM,
  locationKey,
  nextCameraAction,
} from "@/lib/sales-map";

type MapPoint = TrackingLocation & { pin: number };

type GoogleMap = {
  setCenter: (c: { lat: number; lng: number }) => void;
  setZoom: (z: number) => void;
  panTo: (c: { lat: number; lng: number }) => void;
  fitBounds: (b: unknown, padding?: number) => void;
  addListener: (event: string, fn: () => void) => void;
};

type MapsApi = {
  maps: {
    Map: new (el: HTMLElement, opts: Record<string, unknown>) => GoogleMap;
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
    Size: new (w: number, h: number) => unknown;
    Point: new (x: number, y: number) => unknown;
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

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function pinIconUrl(pin: number, selected: boolean) {
  const fill = selected ? "#1d4ed8" : "#dc2626";
  const label = String(pin);
  const fontSize = label.length > 1 ? 11 : 13;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="52" viewBox="0 0 40 52"><path fill="${fill}" d="M20 51s16-15.4 16-29A16 16 0 1 0 4 22c0 13.6 16 29 16 29z"/><circle cx="20" cy="20" r="11" fill="#fff"/><text x="20" y="24.5" text-anchor="middle" font-family="Arial,sans-serif" font-size="${fontSize}" font-weight="700" fill="${fill}">${label}</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export type MapFocus = {
  token: number;
  lat: number;
  lng: number;
};

type Props = {
  locations: MapPoint[];
  apiKey: string;
  selectedKey: string | null;
  focus: MapFocus | null;
};

export function TrackingMap({
  locations,
  apiKey,
  selectedKey,
  focus,
}: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<GoogleMap | null>(null);
  const markersRef = useRef<InstanceType<MapsApi["maps"]["Marker"]>[]>([]);
  const [mapReady, setMapReady] = useState(false);
  const didFitRef = useRef(false);
  const appliedFocusRef = useRef(0);

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
        if (!cancelled) setMapReady(true);
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
    if (!mapReady || !map || !g?.maps) return;

    for (const marker of markersRef.current) {
      marker.setMap(null);
    }
    markersRef.current = [];

    const bounds = new g.maps.LatLngBounds();
    let placed = 0;
    let only: { lat: number; lng: number } | null = null;
    for (const loc of locations) {
      if (typeof loc.lat !== "number" || typeof loc.lng !== "number") continue;
      const position = { lat: loc.lat, lng: loc.lng };
      const key = locationKey(loc);
      const selected = key === selectedKey;
      const marker = new g.maps.Marker({
        map,
        position,
        title: `${loc.pin}. ${loc.name || "Salesman"}`,
        icon: {
          url: pinIconUrl(loc.pin, selected),
          scaledSize: new g.maps.Size(40, 52),
          anchor: new g.maps.Point(20, 50),
        },
        zIndex: selected ? 10 : 1,
        optimized: false,
      });
      const info = new g.maps.InfoWindow({
        content: `<div style="font:13px/1.4 sans-serif"><strong>${escapeHtml(String(loc.pin))}. ${escapeHtml(loc.name || "Salesman")}</strong><br/>${escapeHtml(loc.email || "")}</div>`,
      });
      marker.addListener("click", () => info.open({ map, anchor: marker }));
      markersRef.current.push(marker);
      bounds.extend(position);
      placed += 1;
      only = position;
    }

    const action = nextCameraAction({
      hasFitted: didFitRef.current,
      focusToken: focus?.token ?? 0,
      appliedFocusToken: appliedFocusRef.current,
    });
    if (action === "focus") return;
    if (action !== "fit" || placed === 0) return;

    didFitRef.current = true;
    if (placed === 1 && only) {
      map.setCenter(only);
      map.setZoom(13);
    } else {
      map.fitBounds(bounds, 48);
    }
  }, [locations, mapReady, selectedKey, focus]);

  useEffect(() => {
    const map = mapInstance.current;
    if (!mapReady || !map || !focus) return;
    const action = nextCameraAction({
      hasFitted: didFitRef.current,
      focusToken: focus.token,
      appliedFocusToken: appliedFocusRef.current,
    });
    if (action !== "focus") return;
    didFitRef.current = true;
    appliedFocusRef.current = focus.token;
    map.panTo({ lat: focus.lat, lng: focus.lng });
    map.setZoom(SALES_MAP_FOCUS_ZOOM);
  }, [focus, mapReady]);

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
