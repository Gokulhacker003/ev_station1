import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MapView } from "@/components/MapView";
import { Loader } from "@/components/Loader";
import { motion } from "framer-motion";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useGeolocation } from "@/hooks/useGeolocation";
import type { Tables } from "@/integrations/supabase/types";
import { useEffect, useState } from "react";

export default function MapPage() {
  const navigate = useNavigate();
    const [searchParams] = useSearchParams();
  const geo = useGeolocation();
  const [selectedStation, setSelectedStation] = useState<Tables<"stations"> | null>(null);

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

  const userLoc: [number, number] | null =
    geo.latitude && geo.longitude ? [geo.latitude, geo.longitude] : null;

  return (
    <div className="relative w-full h-screen overflow-hidden">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-[calc(100vh-4rem)] pb-16 md:pb-0">
        <div className="container mx-auto px-4 py-4">
          <h1 className="font-display text-2xl font-bold text-foreground mb-3">Charging Map</h1>
          {isLoading || geo.loading ? (
            <div className="flex justify-center py-20">
              <Loader text="Loading map..." />
            </div>
          ) : (
            <>
              <MapView
                stations={stations || []}
                onStationClick={handleStationClick}
                userLocation={userLoc}
                routeTarget={
                  selectedStation
                    ? [selectedStation.latitude, selectedStation.longitude]
                    : null
                }
                className="h-[70vh] w-full rounded-xl shadow-lg"
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
                          📍 {Math.round(
                            Math.sqrt(
                              Math.pow(selectedStation.latitude - userLoc[0], 2) + 
                              Math.pow(selectedStation.longitude - userLoc[1], 2)
                            ) * 111
                          )} km away
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
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
