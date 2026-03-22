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

const selectedEvIcon = L.divIcon({
  html: `<div style="background:hsl(45,93%,47%);width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid white;box-shadow:0 0 0 4px rgba(250,204,21,0.3),0 4px 14px rgba(0,0,0,0.35)"><svg width="18" height="18" fill="white" viewBox="0 0 24 24"><path d="M13 2L3 14h9l-1 10 10-12h-9l1-10z"/></svg></div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
  className: "",
});

interface MapViewProps {
  stations: Tables<"stations">[];
  center?: [number, number];
  zoom?: number;
  userLocation?: [number, number] | null;
  selectedStationId?: string | null;
  onStationClick?: (station: Tables<"stations">) => void;
  onMapClick?: (lat: number, lng: number) => void;
  selectedPosition?: [number, number] | null;
  className?: string;
  routeCoordinates?: [number, number][] | null;
}

export function MapView({
  stations,
  zoom = 5,
  userLocation,
  selectedStationId,
  onStationClick,
  onMapClick,
  selectedPosition,
  className = "h-[70vh]",
  routeCoordinates = null,
}: MapViewProps) {
  const initialZoomRef = useRef(zoom);
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isMountedRef = useRef(false);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const selectedMarkerRef = useRef<L.Marker | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const hasInitializedViewRef = useRef(false);
  const hasUserInteractedRef = useRef(false);
  const hasCenteredOnUserRef = useRef(false);
  const polylineRef = useRef<L.Polyline | null>(null);

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
    // Load from user location if available, otherwise use Coimbatore as default
    const initialLocation = userLocation || [11.0081, 76.9366];
    const initialZoom = userLocation ? 13 : 11;
    mapRef.current.setView(initialLocation, initialZoom, { animate: false });
    hasInitializedViewRef.current = true;
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(mapRef.current);

    markersRef.current = L.layerGroup().addTo(mapRef.current);

    // Leaflet sometimes measures incorrectly on first paint; force a relayout.
    const resizeTimer = window.setTimeout(() => {
      const map = getSafeMap();
      map?.invalidateSize({ pan: false, animate: false });
    }, 200);

    const handleResize = () => {
      const map = getSafeMap();
      map?.invalidateSize({ pan: false, animate: false });
    };

    const handleUserInteract = () => {
      hasUserInteractedRef.current = true;
    };

    mapRef.current.on("zoomstart", handleUserInteract);
    mapRef.current.on("dragstart", handleUserInteract);
    window.addEventListener("resize", handleResize);

    return () => {
      isMountedRef.current = false;
      window.clearTimeout(resizeTimer);
      window.removeEventListener("resize", handleResize);
      mapRef.current?.off("zoomstart", handleUserInteract);
      mapRef.current?.off("dragstart", handleUserInteract);
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [userLocation]);

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
    map.invalidateSize({ pan: false, animate: false });
  }, [stations.length, userLocation, selectedPosition]);

  // Re-center when user location becomes available
  useEffect(() => {
    const map = getSafeMap();
    if (!map || !userLocation) return;
    if (!hasInitializedViewRef.current || hasCenteredOnUserRef.current || hasUserInteractedRef.current) return;
    hasCenteredOnUserRef.current = true;
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
      const marker = L.marker([station.latitude, station.longitude], {
        icon: selectedStationId === station.id ? selectedEvIcon : evIcon,
      });

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
          <span style="color:#666;font-size:12px">🔌 ${station.available_slots} slots available</span>
        </div>`
      );
      if (onStationClick) {
        marker.on("click", () => onStationClick(station));
      }
      markersRef.current!.addLayer(marker);
    });
  }, [stations, onStationClick, userLocation, selectedStationId]);

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

  // Handle route line drawing
  useEffect(() => {
    const map = getSafeMap();
    if (!map) return;
    
    if (polylineRef.current) {
      polylineRef.current.remove();
      polylineRef.current = null;
    }
    
    if (routeCoordinates && routeCoordinates.length > 0) {
      polylineRef.current = L.polyline(routeCoordinates, {
        color: '#3b82f6',
        weight: 4,
        opacity: 0.8,
        lineJoin: 'round',
        lineCap: 'round'
      }).addTo(map);
      
      // Fit map bounds to show entire route
      const bounds = L.latLngBounds(routeCoordinates);
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [routeCoordinates]);



  return (
    <div className={`map-wrapper relative z-0 ${className}`}>
      <div id="map" ref={containerRef} className="h-full w-full rounded-xl overflow-hidden" />
    </div>
  );
}
