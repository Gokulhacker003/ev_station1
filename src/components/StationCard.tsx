import { motion } from "framer-motion";
import { Zap, MapPin, Battery, Navigation, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Tables } from "@/integrations/supabase/types";
import { useNavigate } from "react-router-dom";
import { formatDistance, estimateDriveTime } from "@/lib/distance";

interface StationCardProps {
  station: Tables<"stations">;
  index?: number;
  distanceKm?: number;
}

export function StationCard({ station, index = 0, distanceKm }: StationCardProps) {
  const navigate = useNavigate();

  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${station.latitude},${station.longitude}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.4 }}
      className="glass rounded-xl p-4 sm:p-5 hover:shadow-lg hover:shadow-primary/10 transition-shadow"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Zap className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <h3 className="font-display font-semibold text-foreground text-sm sm:text-base truncate">{station.name}</h3>
            {distanceKm != null ? (
              <p className="flex items-center gap-1 text-xs text-primary font-medium">
                <MapPin className="h-3 w-3" />
                {formatDistance(distanceKm)}
                <span className="text-muted-foreground font-normal flex items-center gap-0.5 ml-1">
                  <Clock className="h-3 w-3" />
                  ~{estimateDriveTime(distanceKm)} min
                </span>
              </p>
            ) : (
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3" />
                {station.latitude.toFixed(4)}, {station.longitude.toFixed(4)}
              </p>
            )}
          </div>
        </div>
        <Badge variant={station.available_slots > 0 ? "default" : "destructive"} className="text-xs shrink-0">
          {station.available_slots > 0 ? `${station.available_slots} slots` : "Full"}
        </Badge>
      </div>

      <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-3">
        <Battery className="h-4 w-4" />
        {station.charger_type}
        {(station.charger_type === "CCS" || station.charger_type === "CHAdeMO" || station.charger_type === "Tesla Supercharger") && (
          <Badge variant="secondary" className="text-[10px] ml-1 px-1.5 py-0">⚡ Fast</Badge>
        )}
      </div>

      <div className="flex gap-2">
        <Button
          size="sm"
          className="flex-1"
          disabled={station.available_slots <= 0}
          onClick={() => navigate(`/bookings?station=${station.id}`)}
        >
          Book Now
        </Button>
        <Button size="sm" variant="outline" className="gap-1" asChild>
          <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer">
            <Navigation className="h-3.5 w-3.5" />
            Navigate
          </a>
        </Button>
      </div>
    </motion.div>
  );
}
