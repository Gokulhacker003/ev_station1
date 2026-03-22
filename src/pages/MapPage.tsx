import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MapView } from "@/components/MapView";
import { Loader } from "@/components/Loader";
import { motion } from "framer-motion";
import { useSearchParams } from "react-router-dom";
import { useGeolocation } from "@/hooks/useGeolocation";
import type { Tables } from "@/integrations/supabase/types";
import { useEffect, useMemo, useRef, useState } from "react";
import { calculateDistance, estimateDriveTime, formatDistance } from "@/lib/distance";
import { Search, X, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function MapPage() {
  const [searchParams] = useSearchParams();
  const geo = useGeolocation();
  const [selectedStation, setSelectedStation] = useState<Tables<"stations"> | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [mapUserLocation, setMapUserLocation] = useState<[number, number] | null>(null);
  const [showRoute, setShowRoute] = useState(false);
  const [routeCoordinates, setRouteCoordinates] = useState<[number, number][] | null>(null);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  const hasLockedInitialLocationRef = useRef(false);

  const stationId = searchParams.get("station");

  const { data: stations, isLoading } = useQuery({
    queryKey: ["stations-map"],
    queryFn: async () => {
      const { data, error } = await supabase.from("stations").select("*");
      if (error) throw error;
      return data;
    },
  });

  // When station ID is in URL, find and select that station
  useEffect(() => {
    if (stationId && stations) {
      const station = stations.find(s => s.id === stationId);
      if (station) {
        setSelectedStation(station);
      }
    }
  }, [stationId, stations]);

  const handleStationClick = (station: Tables<"stations">) => {
    setSelectedStation(station);
  };



  useEffect(() => {
    if (hasLockedInitialLocationRef.current) return;
    if (geo.latitude === null || geo.longitude === null) return;

    hasLockedInitialLocationRef.current = true;
    setMapUserLocation([geo.latitude, geo.longitude]);
  }, [geo.latitude, geo.longitude]);

  const userLoc = mapUserLocation;

  const filteredStations = useMemo(() => {
    if (!stations) return [];
    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (!normalizedQuery) return stations;

    return stations.filter((station) => {
      return (
        station.name.toLowerCase().includes(normalizedQuery)
        || station.charger_type.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [stations, searchQuery]);

  useEffect(() => {
    if (!selectedStation) return;
    const isStillVisible = filteredStations.some((station) => station.id === selectedStation.id);
    if (!isStillVisible) {
      setSelectedStation(null);
    }
  }, [filteredStations, selectedStation]);

  const nearestAvailableStations = useMemo(() => {
    if (!filteredStations || !userLoc) return [];

    return filteredStations
      .filter((station) => station.available_slots > 0)
      .map((station) => {
        const distanceKm = calculateDistance(
          userLoc[0],
          userLoc[1],
          station.latitude,
          station.longitude
        );

        return {
          ...station,
          distanceKm,
          etaMins: estimateDriveTime(distanceKm),
        };
      })
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, 5);
  }, [filteredStations, userLoc]);

  const activeStation = selectedStation || nearestAvailableStations[0] || null;
  const activeStationDistance = activeStation && userLoc
    ? calculateDistance(userLoc[0], userLoc[1], activeStation.latitude, activeStation.longitude)
    : null;

  // Fetch real-time route
  useEffect(() => {
    if (!showRoute || !activeStation || !userLoc) {
      setRouteCoordinates(null);
      return;
    }

    const fetchRoute = async () => {
      setIsLoadingRoute(true);
      try {
        // Using OSRM (Open Source Routing Machine) API
        const response = await fetch(
          `https://router.project-osrm.org/route/v1/driving/${userLoc[1]},${userLoc[0]};${activeStation.longitude},${activeStation.latitude}?overview=full&geometries=geojson`
        );
        const data = await response.json();
        
        if (data.routes && data.routes.length > 0) {
          const coordinates = data.routes[0].geometry.coordinates as [number, number][];
          // OSRM returns [lng, lat] but Leaflet expects [lat, lng]
          setRouteCoordinates(coordinates.map(([lng, lat]) => [lat, lng]));
        }
      } catch (error) {
        console.error("Error fetching route:", error);
        setRouteCoordinates(null);
      } finally {
        setIsLoadingRoute(false);
      }
    };

    fetchRoute();
  }, [showRoute, activeStation, userLoc]);

  return (
    <div className="relative h-[calc(100vh-4rem)] w-full overflow-hidden bg-slate-100 pb-16 md:pb-0">
      {isLoading ? (
        <div className="flex h-full items-center justify-center">
          <Loader text="Loading map..." />
        </div>
      ) : (
        <>
          <MapView
            stations={filteredStations}
            onStationClick={handleStationClick}
            userLocation={userLoc}
            selectedStationId={selectedStation?.id ?? null}
            className="h-full w-full"
            routeCoordinates={routeCoordinates}
          />

          <div className="pointer-events-none absolute inset-0 z-[500]">
            <div className="absolute left-0 right-0 top-[10px] px-4">
              <div className="pointer-events-auto flex items-center gap-2 rounded-[20px] border border-slate-200 bg-white px-4 py-3 shadow-[0_10px_30px_rgba(15,23,42,0.18)]">
                <Search className="h-4 w-4 text-slate-400" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search EV stations..."
                  className="w-full bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {geo.error && (
              <div className="absolute left-4 right-4 top-24 pointer-events-auto rounded-2xl border border-amber-200 bg-white/95 p-3 text-xs text-amber-900 shadow-[0_12px_24px_rgba(15,23,42,0.18)]">
                <p className="font-semibold">Location unavailable</p>
                <p className="mt-1">{geo.error}</p>
                <button
                  onClick={geo.requestLocation}
                  className="mt-2 rounded-full bg-amber-500 px-3 py-1.5 font-semibold text-white hover:bg-amber-600"
                >
                  Retry
                </button>
              </div>
            )}



            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.35 }}
              className="pointer-events-none absolute bottom-[70px] left-0 right-0 px-4"
            >
              <div className="pointer-events-auto rounded-t-3xl rounded-b-2xl border border-slate-200 bg-white p-4 shadow-[0_-6px_24px_rgba(15,23,42,0.14)]">
                {activeStation ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-base font-semibold text-slate-900">{activeStation.name}</p>
                        <p className="mt-1 text-sm text-slate-500">
                          {activeStationDistance != null
                            ? `${formatDistance(activeStationDistance)} away`
                            : "Enable location to see distance"}
                        </p>
                      </div>
                    </div>
                    <Button
                      onClick={() => setShowRoute(!showRoute)}
                      variant={showRoute ? "default" : "outline"}
                      className="w-full gap-2"
                      disabled={!userLoc || isLoadingRoute}
                    >
                      <Navigation className="h-4 w-4" />
                      {isLoadingRoute ? "Loading Route..." : showRoute ? "Hide Route" : "Show Route"}
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">
                    Tap a station marker to see route details.
                  </p>
                )}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </div>
  );
}
