import React from "react";
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
  const { data: bookedSlots, isLoading, refetch } = useQuery({
    queryKey: ["booked-slots", stationId, selectedDate],
    queryFn: async () => {
      if (!stationId || !selectedDate) return [];
      
      const dateStr = format(selectedDate, "yyyy-MM-dd");
      const { data, error } = await supabase
        .from("bookings")
        .select("time_slot, user_id, status, id")
        .eq("station_id", stationId)
        .eq("booking_date", dateStr)
        .neq("status", "cancelled");
      
      if (error) {
        console.error("Error fetching booked slots:", error);
        throw error;
      }
      
      console.log("Booked slots for", dateStr, ":", data);
      return data || [];
    },
    enabled: !!stationId && !!selectedDate,
    refetchOnWindowFocus: true,
    staleTime: 30000, // 30 seconds
  });

  // Real-time subscription to booking changes
  React.useEffect(() => {
    if (!stationId || !selectedDate) return;

    const channel = supabase
      .channel('booking_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookings',
          filter: `station_id=eq.${stationId}`,
        },
        () => {
          console.log('Booking changed, refetching slots...');
          refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [stationId, selectedDate, refetch]);

  // Enhanced slot checking functions
  const isUserBooked = (slot: string) => {
    if (!userId || !bookedSlots) return false;
    return bookedSlots.some(
      (booking) => booking.time_slot === slot && booking.user_id === userId
    );
  };

  // Check if slot is fully booked by others (enhanced)
  const isSlotBooked = (slot: string) => {
    if (!bookedSlots) return false;
    const bookingsForSlot = bookedSlots.filter((booking) => booking.time_slot === slot);
    console.log(`Slot ${slot}: ${bookingsForSlot.length} bookings`, bookingsForSlot);
    return bookingsForSlot.length > 0;
  };

  // Get slot status for better UI feedback
  const getSlotStatus = (slot: string) => {
    if (!bookedSlots) return 'available';
    
    const userHasBooking = isUserBooked(slot);
    const othersHaveBooking = bookedSlots.some(
      (booking) => booking.time_slot === slot && booking.user_id !== userId
    );
    
    if (userHasBooking) return 'user-booked';
    if (othersHaveBooking) return 'occupied';
    return 'available';
  };

  // Count how many bookings exist for a slot
  const getSlotBookingCount = (slot: string) => {
    if (!bookedSlots) return 0;
    return bookedSlots.filter((booking) => booking.time_slot === slot).length;
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
          <span>Available ({TIME_SLOTS.filter(slot => getSlotStatus(slot) === 'available').length})</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-destructive/60"></div>
          <span>Occupied ({TIME_SLOTS.filter(slot => getSlotStatus(slot) === 'occupied').length})</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-green-500"></div>
          <span>Your Bookings ({TIME_SLOTS.filter(slot => getSlotStatus(slot) === 'user-booked').length})</span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
        {TIME_SLOTS.map((slot, index) => {
          const status = getSlotStatus(slot);
          const bookingCount = getSlotBookingCount(slot);
          const isSelected = selectedSlot === slot;
          const isDisabled = status === 'occupied';

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
                
                // Available slot
                status === 'available' && !isSelected && "border-border hover:border-primary/50 hover:bg-accent",
                status === 'available' && isSelected && "border-primary bg-primary text-primary-foreground shadow-lg",
                
                // User's booking
                status === 'user-booked' && "border-green-500 bg-green-500/10 text-green-700 dark:text-green-400",
                
                // Occupied slot (disabled)
                status === 'occupied' && "border-destructive/30 bg-destructive/10 text-destructive/60 cursor-not-allowed hover:scale-100 opacity-60",
              )}
            >
              <div className="flex flex-col items-center gap-1">
                <Clock className={cn(
                  "h-4 w-4",
                  status === 'occupied' && "opacity-50"
                )} />
                <span className="text-xs leading-tight">{slot}</span>
                
                {/* Show booking count for debugging */}
                {bookingCount > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-background/80 text-muted-foreground">
                    {bookingCount}
                  </span>
                )}
              </div>

              {/* Status icons */}
              {isSelected && status === 'available' && (
                <CheckCircle2 className="absolute top-1 right-1 h-4 w-4" />
              )}
              
              {status === 'occupied' && (
                <XCircle className="absolute top-1 right-1 h-4 w-4 text-destructive" />
              )}

              {status === 'user-booked' && (
                <div className="absolute top-1 right-1">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
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
