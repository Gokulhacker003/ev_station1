import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MapView } from "@/components/MapView";
import { Loader } from "@/components/Loader";
import { motion } from "framer-motion";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useGeolocation } from "@/hooks/useGeolocation";
import type { Tables } from "@/integrations/supabase/types";
import { useEffect, useMemo, useRef, useState } from "react";
import { calculateDistance, estimateDriveTime, formatDistance } from "@/lib/distance";

export default function MapPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const geo = useGeolocation();
  const [selectedStation, setSelectedStation] = useState<Tables<"stations"> | null>(null);
  const [centerOnUserToken, setCenterOnUserToken] = useState(0);
  const [mapUserLocation, setMapUserLocation] = useState<[number, number] | null>(null);
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

  const handleGetDirections = () => {
    if (selectedStation) {
      navigate(`/bookings?station=${selectedStation.id}`);
    }
  };

  const handleGetMyLocation = () => {
    hasLockedInitialLocationRef.current = false;
    setMapUserLocation(null);
    geo.requestLocation();
    setCenterOnUserToken((t) => t + 1);
  };

  useEffect(() => {
    if (hasLockedInitialLocationRef.current) return;
    if (geo.latitude === null || geo.longitude === null) return;

    hasLockedInitialLocationRef.current = true;
    setMapUserLocation([geo.latitude, geo.longitude]);
  }, [geo.latitude, geo.longitude]);

  const userLoc = mapUserLocation;

  const nearestAvailableStations = useMemo(() => {
    if (!stations || !userLoc) return [];

    return stations
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
  }, [stations, userLoc]);

  return (
    <div className="relative w-full h-screen overflow-hidden">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-[calc(100vh-4rem)] pb-16 md:pb-0">
        <div className="w-full px-4 py-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h1 className="font-display text-2xl font-bold text-foreground">Charging Map</h1>
            <button
              onClick={handleGetMyLocation}
              disabled={geo.loading}
              className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
            >
              {geo.loading ? "Getting Location..." : "Get My Location"}
            </button>
          </div>
          {isLoading ? (
            <div className="flex justify-center py-20">
              <Loader text="Loading map..." />
            </div>
          ) : (
            <>
              {geo.error && (
                <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                  <p className="font-semibold">Location unavailable</p>
                  <p className="mt-1">{geo.error}</p>
                  {!geo.isSecureContext && (
                    <p className="mt-1">
                      Tip: mobile browsers block geolocation on HTTP. Use an HTTPS URL for this site.
                    </p>
                  )}
                  <button
                    onClick={geo.requestLocation}
                    className="mt-2 rounded-md bg-amber-600 px-3 py-1.5 font-medium text-white hover:bg-amber-700"
                  >
                    Retry Location
                  </button>
                </div>
              )}

              <MapView
                stations={stations || []}
                onStationClick={handleStationClick}
                userLocation={userLoc}
                forceCenterOnUserToken={centerOnUserToken}
                routeTarget={
                  selectedStation
                    ? [selectedStation.latitude, selectedStation.longitude]
                    : null
                }
                className="h-[calc(100vh-12rem)] w-full rounded-xl shadow-lg"
              />
              
              {selectedStation && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4 p-4 bg-white rounded-lg shadow-md border border-gray-200"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h2 className="font-bold text-lg">{selectedStation.name}</h2>
                      <p className="text-sm text-gray-600 mt-1">⚡ {selectedStation.charger_type}</p>
                      <p className="text-sm text-gray-600">🔌 {selectedStation.available_slots} slots available</p>
                      {userLoc && (
                        <p className="text-sm text-blue-600 mt-1">
                          📍 {formatDistance(
                            calculateDistance(
                              userLoc[0],
                              userLoc[1],
                              selectedStation.latitude,
                              selectedStation.longitude
                            )
                          )} away
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleGetDirections}
                        className="px-4 py-2 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600"
                      >
                        Book Slot
                      </button>
                      <button
                        onClick={() => setSelectedStation(null)}
                        className="px-4 py-2 bg-gray-300 text-gray-800 rounded-lg font-semibold hover:bg-gray-400"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}

              <div className="mt-4 rounded-lg border border-gray-200 bg-white p-4 shadow-md">
                <h3 className="text-lg font-bold text-foreground">Nearest Available EV Stations</h3>

                {!userLoc ? (
                  <p className="mt-2 text-sm text-muted-foreground">
                    Enable current location to view nearest available stations.
                  </p>
                ) : nearestAvailableStations.length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">
                    No nearby stations with available slots right now.
                  </p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {nearestAvailableStations.map((station) => (
                      <button
                        key={station.id}
                        onClick={() => setSelectedStation(station)}
                        className="w-full rounded-md border border-gray-200 p-3 text-left transition hover:border-green-400 hover:bg-green-50"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-foreground">{station.name}</p>
                            <p className="text-sm text-gray-600">⚡ {station.charger_type}</p>
                            <p className="text-sm text-gray-600">🔌 {station.available_slots} slots available</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium text-blue-700">{formatDistance(station.distanceKm)}</p>
                            <p className="text-xs text-gray-500">~{station.etaMins} min drive</p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
