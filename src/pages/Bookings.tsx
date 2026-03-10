import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Loader } from "@/components/Loader";
import { TimeSlotPicker } from "@/components/TimeSlotPicker";
import { CalendarIcon, Zap, X, Clock } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

export default function Bookings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const preselectedStation = searchParams.get("station");

  const [selectedStation, setSelectedStation] = useState(preselectedStation || "");
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedSlot, setSelectedSlot] = useState("");

  const stationFieldId = "booking-station";
  const dateFieldId = "booking-date";
  const timeSlotFieldId = "booking-time-slot";

  const { data: stations } = useQuery({
    queryKey: ["stations-booking"],
    queryFn: async () => {
      const { data, error } = await supabase.from("stations").select("*").gt("available_slots", 0);
      if (error) throw error;
      return data;
    },
  });

  const { data: bookings, isLoading: bookingsLoading } = useQuery({
    queryKey: ["my-bookings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("*, stations(name, charger_type)")
        .eq("user_id", user!.id)
        .order("booking_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const createBooking = useMutation({
    mutationFn: async () => {
      if (!selectedStation || !selectedDate || !selectedSlot || !user) {
        throw new Error("Please fill all fields");
      }

      const dateStr = format(selectedDate, "yyyy-MM-dd");

      // Check if user already has a booking for this slot
      const { data: existingBooking } = await supabase
        .from("bookings")
        .select("id")
        .eq("user_id", user.id)
        .eq("station_id", selectedStation)
        .eq("booking_date", dateStr)
        .eq("time_slot", selectedSlot)
        .neq("status", "cancelled")
        .maybeSingle();

      if (existingBooking) {
        throw new Error("You already have a booking for this time slot");
      }

      // Check if slot is available (not booked by others)
      const { data: otherBookings } = await supabase
        .from("bookings")
        .select("id")
        .eq("station_id", selectedStation)
        .eq("booking_date", dateStr)
        .eq("time_slot", selectedSlot)
        .neq("status", "cancelled");

      if (otherBookings && otherBookings.length > 0) {
        throw new Error("This time slot is already booked");
      }

      // Create the booking
      const { error } = await supabase.from("bookings").insert({
        user_id: user.id,
        station_id: selectedStation,
        booking_date: dateStr,
        time_slot: selectedSlot,
      });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["booked-slots"] });
      toast({ title: "Booking confirmed!", description: "Your charging slot has been reserved." });
      setSelectedStation("");
      setSelectedDate(undefined);
      setSelectedSlot("");
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Failed to create booking";
      toast({ title: "Booking failed", description: message, variant: "destructive" });
    },
  });

  const cancelBooking = useMutation({
    mutationFn: async (bookingId: string) => {
      const { error } = await supabase
        .from("bookings")
        .update({ status: "cancelled" as const })
        .eq("id", bookingId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-bookings"] });
      toast({ title: "Booking cancelled" });
    },
  });

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-[calc(100vh-4rem)]">
      <div className="container mx-auto px-4 py-6">
        <h1 className="font-display text-2xl font-bold text-foreground mb-6">Bookings</h1>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* New Booking */}
          <div className="glass rounded-xl p-6">
            <h2 className="font-display text-lg font-semibold mb-4">Book a Charging Slot</h2>
            <div className="space-y-4">
              <div>
                <label htmlFor={stationFieldId} className="text-sm font-medium text-foreground mb-1.5 block">Station</label>
                <Select value={selectedStation} onValueChange={setSelectedStation}>
                  <SelectTrigger id={stationFieldId}>
                    <SelectValue placeholder="Select a station" />
                  </SelectTrigger>
                  <SelectContent>
                    {stations?.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} ({s.charger_type}) — {s.available_slots} slots
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label htmlFor={dateFieldId} className="text-sm font-medium text-foreground mb-1.5 block">Date</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      id={dateFieldId}
                      variant="outline"
                      className={cn("w-full justify-start text-left font-normal", !selectedDate && "text-muted-foreground")}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {selectedDate ? format(selectedDate, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={setSelectedDate}
                      disabled={(date) => date < new Date()}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div>
                <label htmlFor={timeSlotFieldId} className="text-sm font-medium text-foreground mb-1.5 block">Time Slot</label>
                <div id={timeSlotFieldId}>
                  <TimeSlotPicker
                    stationId={selectedStation}
                    selectedDate={selectedDate}
                    selectedSlot={selectedSlot}
                    onSelectSlot={setSelectedSlot}
                    userId={user?.id}
                  />
                </div>
              </div>

              <Button
                className="w-full"
                disabled={!selectedStation || !selectedDate || !selectedSlot || createBooking.isPending}
                onClick={() => createBooking.mutate()}
              >
                {createBooking.isPending ? "Booking..." : "Confirm Booking"}
              </Button>
            </div>
          </div>

          {/* My Bookings */}
          <div>
            <h2 className="font-display text-lg font-semibold mb-4">My Bookings</h2>
            {bookingsLoading ? (
              <Loader text="Loading bookings..." />
            ) : bookings && bookings.length > 0 ? (
              <div className="space-y-3">
                {bookings.map((booking, i) => (
                  <motion.div
                    key={booking.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="glass rounded-xl p-4 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                        <Zap className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-sm text-foreground">
                          {booking.stations?.name || "Station"}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <CalendarIcon className="h-3 w-3" />
                          {format(new Date(booking.booking_date), "PP")}
                          <Clock className="h-3 w-3 ml-1" />
                          {booking.time_slot}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          booking.status === "confirmed" ? "default" :
                          booking.status === "cancelled" ? "destructive" : "secondary"
                        }
                      >
                        {booking.status}
                      </Badge>
                      {booking.status === "confirmed" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => cancelBooking.mutate(booking.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <CalendarIcon className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-muted-foreground">No bookings yet.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
