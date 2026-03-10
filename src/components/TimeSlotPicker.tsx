import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Clock, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface TimeSlotPickerProps {
  stationId: string;
  selectedDate: Date | undefined;
  selectedSlot: string;
  onSelectSlot: (slot: string) => void;
  userId?: string;
}

const TIME_SLOTS = [
  "06:00 - 07:00", "07:00 - 08:00", "08:00 - 09:00", "09:00 - 10:00",
  "10:00 - 11:00", "11:00 - 12:00", "12:00 - 13:00", "13:00 - 14:00",
  "14:00 - 15:00", "15:00 - 16:00", "16:00 - 17:00", "17:00 - 18:00",
  "18:00 - 19:00", "19:00 - 20:00", "20:00 - 21:00", "21:00 - 22:00",
];

export function TimeSlotPicker({
  stationId,
  selectedDate,
  selectedSlot,
  onSelectSlot,
  userId,
}: TimeSlotPickerProps) {
  // Fetch booked slots for this station and date
  const { data: bookedSlots, isLoading } = useQuery({
    queryKey: ["booked-slots", stationId, selectedDate],
    queryFn: async () => {
      if (!stationId || !selectedDate) return [];
      
      const dateStr = format(selectedDate, "yyyy-MM-dd");
      const { data, error } = await supabase
        .from("bookings")
        .select("time_slot, user_id, status")
        .eq("station_id", stationId)
        .eq("booking_date", dateStr)
        .neq("status", "cancelled");
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!stationId && !!selectedDate,
  });

  // Check if current user already has a booking at this slot
  const isUserBooked = (slot: string) => {
    if (!userId || !bookedSlots) return false;
    return bookedSlots.some(
      (booking) => booking.time_slot === slot && booking.user_id === userId
    );
  };

  // Check if slot is fully booked by others
  const isSlotBooked = (slot: string) => {
    if (!bookedSlots) return false;
    return bookedSlots.some((booking) => booking.time_slot === slot);
  };

  if (!stationId || !selectedDate) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Clock className="h-12 w-12 mx-auto mb-2 opacity-50" />
        <p className="text-sm">Please select a station and date first</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        <p className="text-sm text-muted-foreground mt-2">Loading available slots...</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-primary"></div>
          <span>Available</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-destructive/20"></div>
          <span>Booked</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-green-500"></div>
          <span>Your Booking</span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
        {TIME_SLOTS.map((slot, index) => {
          const isBooked = isSlotBooked(slot);
          const isUserSlot = isUserBooked(slot);
          const isSelected = selectedSlot === slot;
          const isDisabled = isBooked && !isUserSlot;

          return (
            <motion.button
              key={slot}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.02 }}
              onClick={() => !isDisabled && onSelectSlot(slot)}
              disabled={isDisabled}
              className={cn(
                "relative p-3 rounded-lg border-2 transition-all duration-200 font-medium text-sm",
                "hover:scale-105 active:scale-95",
                isSelected && !isUserSlot && "border-primary bg-primary text-primary-foreground shadow-lg",
                isUserSlot && "border-green-500 bg-green-500/10 text-green-700 dark:text-green-400",
                isDisabled && "border-destructive/20 bg-destructive/5 text-destructive/40 cursor-not-allowed hover:scale-100",
                !isSelected && !isBooked && !isUserSlot && "border-border hover:border-primary/50 hover:bg-accent",
                isBooked && !isUserSlot && !isDisabled && "opacity-50"
              )}
            >
              <div className="flex flex-col items-center gap-1">
                <Clock className="h-4 w-4" />
                <span className="text-xs leading-tight">{slot}</span>
              </div>

              {isSelected && !isUserSlot && (
                <CheckCircle2 className="absolute top-1 right-1 h-4 w-4" />
              )}
              
              {isDisabled && (
                <XCircle className="absolute top-1 right-1 h-4 w-4" />
              )}

              {isUserSlot && (
                <div className="absolute top-1 right-1">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
              )}
            </motion.button>
          );
        })}
      </div>

      {selectedSlot && !isUserBooked(selectedSlot) && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3 rounded-lg bg-primary/10 border border-primary/20 text-sm text-primary"
        >
          <strong>Selected:</strong> {selectedSlot}
        </motion.div>
      )}

      {selectedSlot && isUserBooked(selectedSlot) && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm text-amber-700 dark:text-amber-400"
        >
          <strong>Note:</strong> You already have a booking for this time slot.
        </motion.div>
      )}
    </div>
  );
}
