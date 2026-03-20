import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Tables } from "@/integrations/supabase/types";
import { calculateDistance, formatDistance, estimateDriveTime } from "@/lib/distance";

// Fix default marker icons for Leaflet + bundlers
Reflect.deleteProperty(L.Icon.Default.prototype, '_getIconUrl');
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const evIcon = L.divIcon({
  html: `<div style="background:hsl(142,71%,45%);width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3)"><svg width="16" height="16" fill="white" viewBox="0 0 24 24"><path d="M13 2L3 14h9l-1 10 10-12h-9l1-10z"/></svg></div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  className: "",
});

const userIcon = L.divIcon({
  html: `<div style="background:hsl(213,90%,55%);width:20px;height:20px;border-radius:50%;border:3px solid white;box-shadow:0 0 12px rgba(59,130,246,0.6)"></div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
  className: "",
});

interface MapViewProps {
  stations: Tables<"stations">[];
  center?: [number, number];
  zoom?: number;
  userLocation?: [number, number] | null;
  routeTarget?: [number, number] | null;
  onStationClick?: (station: Tables<"stations">) => void;
  onMapClick?: (lat: number, lng: number) => void;
  selectedPosition?: [number, number] | null;
  className?: string;
}

export function MapView({
  stations,
  center = [20.5937, 78.9629],
  zoom = 5,
  userLocation,
  routeTarget,
  onStationClick,
  onMapClick,
  selectedPosition,
  className = "h-[70vh]",
}: MapViewProps) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isMountedRef = useRef(false);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const selectedMarkerRef = useRef<L.Marker | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const routeLineRef = useRef<L.Polyline | null>(null);

  const getSafeMap = () => {
    const map = mapRef.current;
    const container = containerRef.current;
    if (!isMountedRef.current || !map || !container || !document.body.contains(container)) {
      return null;
    }
    return map;
  };

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    isMountedRef.current = true;

    mapRef.current = L.map(containerRef.current);
    mapRef.current.setView(center, zoom, { animate: false });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(mapRef.current);

    markersRef.current = L.layerGroup().addTo(mapRef.current);

    if (onMapClick) {
      mapRef.current.on("click", (e: L.LeafletMouseEvent) => {
        onMapClick(e.latlng.lat, e.latlng.lng);
      });
    }

    // Leaflet sometimes measures incorrectly on first paint; force a relayout.
    const resizeTimer = window.setTimeout(() => {
      const map = getSafeMap();
      map?.invalidateSize({ pan: false, animate: false });
    }, 200);

    const handleResize = () => {
      const map = getSafeMap();
      map?.invalidateSize({ pan: false, animate: false });
    };
    window.addEventListener("resize", handleResize);

    return () => {
      isMountedRef.current = false;
      window.clearTimeout(resizeTimer);
      window.removeEventListener("resize", handleResize);
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = getSafeMap();
    if (!map || !onMapClick) return;

    const clickHandler = (e: L.LeafletMouseEvent) => {
      onMapClick(e.latlng.lat, e.latlng.lng);
    };

    map.on("click", clickHandler);
    return () => {
      map.off("click", clickHandler);
    };
  }, [onMapClick]);

  useEffect(() => {
    const map = getSafeMap();
    if (!map) return;
    map.setView(center, zoom, { animate: false });
  }, [center, zoom]);

  useEffect(() => {
    const map = getSafeMap();
    if (!map) return;
    map.invalidateSize({ pan: false, animate: false });
  }, [stations.length, userLocation, routeTarget, selectedPosition]);

  // Re-center when user location becomes available
  useEffect(() => {
    const map = getSafeMap();
    if (!map || !userLocation) return;
    map.setView(userLocation, 13, { animate: false });
  }, [userLocation]);

  // User location marker
  useEffect(() => {
    const map = getSafeMap();
    if (!map) return;
    if (userMarkerRef.current) {
      userMarkerRef.current.remove();
      userMarkerRef.current = null;
    }
    if (userLocation) {
      userMarkerRef.current = L.marker(userLocation, { icon: userIcon })
        .bindPopup('<strong>📍 Your Location</strong>')
        .addTo(map);
    }
  }, [userLocation]);

  // Update station markers
  useEffect(() => {
    const map = getSafeMap();
    if (!map || !markersRef.current) return;
    markersRef.current.clearLayers();

    stations.forEach((station) => {
      const marker = L.marker([station.latitude, station.longitude], { icon: evIcon });

      let distanceHtml = "";
      if (userLocation) {
        const dist = calculateDistance(userLocation[0], userLocation[1], station.latitude, station.longitude);
        const time = estimateDriveTime(dist);
        distanceHtml = `<span style="color:#3b82f6;font-size:12px">📍 ${formatDistance(dist)} · ~${time} min drive</span><br/>`;
      }

      marker.bindPopup(
        `<div style="font-family:system-ui;min-width:180px">
          <strong style="font-size:14px">${station.name}</strong><br/>
          ${distanceHtml}
          <span style="color:#666;font-size:12px">⚡ ${station.charger_type}</span><br/>
          <span style="color:#666;font-size:12px">🔌 ${station.available_slots} slots available</span><br/>
          <div style="margin-top:8px;display:flex;gap:6px">
            <a href="/map?station=${station.id}" style="background:#22c55e;color:white;padding:4px 10px;border-radius:6px;font-size:12px;text-decoration:none">Navigate</a>
          </div>
        </div>`
      );
      if (onStationClick) {
        marker.on("click", () => onStationClick(station));
      }
      markersRef.current!.addLayer(marker);
    });
  }, [stations, onStationClick, userLocation]);

  // Handle selected position marker (for admin map picker)
  useEffect(() => {
    const map = getSafeMap();
    if (!map) return;
    if (selectedMarkerRef.current) {
      selectedMarkerRef.current.remove();
      selectedMarkerRef.current = null;
    }
    if (selectedPosition) {
      selectedMarkerRef.current = L.marker(selectedPosition).addTo(map);
      map.setView(selectedPosition, Math.max(map.getZoom(), 12), { animate: false });
    }
  }, [selectedPosition]);

  // Draw real road route from user location to station using OSRM
  useEffect(() => {
    const map = getSafeMap();
    if (!map) return;

    let isCancelled = false;

    if (routeLineRef.current) {
      routeLineRef.current.remove();
      routeLineRef.current = null;
    }

    if (!userLocation || !routeTarget) return;

    const [userLat, userLng] = userLocation;
    const [targetLat, targetLng] = routeTarget;

    fetch(
      `https://router.project-osrm.org/route/v1/driving/${userLng},${userLat};${targetLng},${targetLat}?overview=full&geometries=geojson`
    )
      .then((res) => res.json())
      .then((data) => {
        const safeMap = getSafeMap();
        if (isCancelled || !safeMap) return;
        const coords: [number, number][] = data.routes?.[0]?.geometry?.coordinates;
        if (!coords?.length) return;

        // OSRM returns [lng, lat] — Leaflet needs [lat, lng]
        const latLngs: L.LatLngTuple[] = coords.map(([lng, lat]) => [lat, lng]);

        routeLineRef.current = L.polyline(latLngs, {
          color: "#22c55e",
          weight: 5,
          opacity: 0.95,
        }).addTo(safeMap);

        safeMap.fitBounds(routeLineRef.current.getBounds(), { padding: [50, 50], animate: false });
      })
      .catch(() => {
        // Fallback: straight line if routing fails
        const safeMap = getSafeMap();
        if (isCancelled || !safeMap) return;
        routeLineRef.current = L.polyline([userLocation, routeTarget], {
          color: "#22c55e",
          weight: 4,
          opacity: 0.9,
          dashArray: "8 8",
        }).addTo(safeMap);
        safeMap.fitBounds(L.latLngBounds([userLocation, routeTarget]), {
          padding: [40, 40],
          animate: false,
        });
      });

    return () => {
      isCancelled = true;
    };
  }, [userLocation, routeTarget]);

  return (
    <div className={`map-wrapper relative z-0 ${className}`}>
      <div id="map" ref={containerRef} className="h-full w-full rounded-xl overflow-hidden" />
    </div>
  );
}
