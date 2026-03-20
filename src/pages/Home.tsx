import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Zap, Map, CalendarCheck, Search, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StationCard } from "@/components/StationCard";
import { Loader } from "@/components/Loader";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { useGeolocation } from "@/hooks/useGeolocation";
import { calculateDistance } from "@/lib/distance";

export default function Home() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const geo = useGeolocation();

  const { data: stations, isLoading } = useQuery({
    queryKey: ["stations-home"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stations")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(6);
      if (error) throw error;
      return data;
    },
  });

  const stationsWithDistance = useMemo(() => {
    if (!stations) return [];
    return stations
      .map((s) => ({
        ...s,
        distance: geo.latitude !== null && geo.longitude !== null
          ? calculateDistance(geo.latitude, geo.longitude, s.latitude, s.longitude)
          : undefined,
      }))
      .sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
  }, [stations, geo.latitude, geo.longitude]);

  const filtered = stationsWithDistance.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.charger_type.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen pb-20 md:pb-0">
      {/* Hero */}
      <section className="relative overflow-hidden py-16 md:py-28">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5" />
        <div className="container mx-auto px-4 relative">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-2xl mx-auto text-center"
          >
            <div className="flex justify-center mb-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-primary/30">
                <Zap className="h-8 w-8 text-primary-foreground" />
              </div>
            </div>
            <h1 className="font-display text-3xl md:text-6xl font-bold text-foreground mb-4">
              Find EV Charging<br />
              <span className="text-primary">Stations Near You</span>
            </h1>
            <p className="text-base md:text-lg text-muted-foreground mb-8">
              Discover, book, and charge your electric vehicle at thousands of stations across the country.
            </p>

            {/* Search */}
            <div className="flex gap-2 max-w-lg mx-auto">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search stations or charger type..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button asChild>
                <Link to="/stations">
                  <Search className="h-4 w-4 mr-1" />
                  Search
                </Link>
              </Button>
            </div>
          </motion.div>

          {/* Quick actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="flex flex-wrap justify-center gap-3 mt-10"
          >
            <Button variant="outline" size="lg" asChild className="gap-2">
              <Link to="/map">
                <Map className="h-5 w-5" />
                Open Map
              </Link>
            </Button>
            {user && (
              <Button variant="outline" size="lg" asChild className="gap-2">
                <Link to="/bookings">
                  <CalendarCheck className="h-5 w-5" />
                  My Bookings
                </Link>
              </Button>
            )}
          </motion.div>
        </div>
      </section>

      {/* Nearby Stations */}
      <section className="py-12">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display text-xl md:text-2xl font-bold text-foreground">
              {geo.latitude ? "Nearby Stations" : "Recent Stations"}
            </h2>
            <Button variant="ghost" asChild className="gap-1">
              <Link to="/stations">
                View All <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader text="Finding stations..." />
            </div>
          ) : filtered.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((station, i) => (
                <StationCard key={station.id} station={station} index={i} distanceKm={station.distance} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Zap className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-muted-foreground">No stations found. Check back soon!</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
