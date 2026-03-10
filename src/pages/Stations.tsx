import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { StationCard } from "@/components/StationCard";
import { Loader } from "@/components/Loader";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import { useState, useMemo } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Constants } from "@/integrations/supabase/types";
import { Input } from "@/components/ui/input";
import { Search, Zap } from "lucide-react";
import { useGeolocation } from "@/hooks/useGeolocation";
import { calculateDistance } from "@/lib/distance";

export default function Stations() {
  const [chargerFilter, setChargerFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const geo = useGeolocation();

  const { data: stations, isLoading } = useQuery({
    queryKey: ["stations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stations")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const stationsWithDistance = useMemo(() => {
    if (!stations) return [];
    return stations.map((s) => ({
      ...s,
      distance: geo.latitude && geo.longitude
        ? calculateDistance(geo.latitude, geo.longitude, s.latitude, s.longitude)
        : undefined,
    }));
  }, [stations, geo.latitude, geo.longitude]);

  const filtered = stationsWithDistance
    .filter((s) => {
      const matchesCharger = chargerFilter === "all" || s.charger_type === chargerFilter;
      const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase());
      return matchesCharger && matchesSearch;
    })
    .sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-[calc(100vh-4rem)] pb-20 md:pb-0">
      <div className="container mx-auto px-4 py-6">
        <h1 className="font-display text-2xl font-bold text-foreground mb-6">All Stations</h1>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search stations..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
          </div>
          <Select value={chargerFilter} onValueChange={setChargerFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Charger Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {Constants.public.Enums.charger_type.map((type) => (
                <SelectItem key={type} value={type}>{type}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-xl" />
            ))}
          </div>
        ) : filtered.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((station, i) => (
              <StationCard key={station.id} station={station} index={i} distanceKm={station.distance} />
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <Zap className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground">No stations found.</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
