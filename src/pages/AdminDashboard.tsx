import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader } from "@/components/Loader";
import { MapView } from "@/components/MapView";
import { toast } from "@/hooks/use-toast";
import { Constants } from "@/integrations/supabase/types";
import type { Database } from "@/integrations/supabase/types";
import type { Tables } from "@/integrations/supabase/types";
import { Plus, Pencil, Trash2, X, CalendarCheck, Clock, Zap } from "lucide-react";
import { format } from "date-fns";

type ChargerType = Database["public"]["Enums"]["charger_type"];

interface StationForm {
  name: string;
  latitude: string;
  longitude: string;
  charger_type: ChargerType;
  available_slots: string;
}

type BookingWithStation = Tables<"bookings"> & { stations: { name: string } | null };

const emptyForm: StationForm = {
  name: "",
  latitude: "",
  longitude: "",
  charger_type: "Type 2",
  available_slots: "1",
};

export default function AdminDashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<StationForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [mapPosition, setMapPosition] = useState<[number, number] | null>(null);
  const [selectedUserEmail, setSelectedUserEmail] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("recent");

  const { data: stations, isLoading } = useQuery({
    queryKey: ["admin-stations"],
    queryFn: async () => {
      const { data, error } = await supabase.from("stations").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const upsertStation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name.trim(),
        latitude: parseFloat(form.latitude),
        longitude: parseFloat(form.longitude),
        charger_type: form.charger_type,
        available_slots: parseInt(form.available_slots),
        created_by: user!.id,
      };

      if (!payload.name || isNaN(payload.latitude) || isNaN(payload.longitude) || isNaN(payload.available_slots)) {
        throw new Error("Please fill all fields correctly");
      }

      if (editingId) {
        const { error } = await supabase.from("stations").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("stations").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-stations"] });
      toast({ title: editingId ? "Station updated!" : "Station added!" });
      resetForm();
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Failed to save station";
      toast({ title: "Error", description: message, variant: "destructive" });
    },
  });

  const deleteStation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("stations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-stations"] });
      toast({ title: "Station deleted" });
    },
  });

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
    setMapPosition(null);
  };

  const startEdit = (station: Tables<"stations">) => {
    setForm({
      name: station.name,
      latitude: String(station.latitude),
      longitude: String(station.longitude),
      charger_type: station.charger_type,
      available_slots: String(station.available_slots),
    });
    setEditingId(station.id);
    setMapPosition([station.latitude, station.longitude]);
    setShowForm(true);
  };

  const handleMapClick = (lat: number, lng: number) => {
    setForm((f) => ({ ...f, latitude: lat.toFixed(6), longitude: lng.toFixed(6) }));
    setMapPosition([lat, lng]);
  };

  // All bookings (for Bookings tab)
  const { data: allBookings, isLoading: bookingsLoading } = useQuery<BookingWithStation[]>({
    queryKey: ["admin-all-bookings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("*, stations(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as BookingWithStation[];
    },
  });

  // Profiles map for resolving user names
  const { data: profiles } = useQuery({
    queryKey: ["admin-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("user_id, full_name, email");
      if (error) throw error;
      return data;
    },
  });

  // Get all users with their booking counts
  const { data: usersWithBookings } = useQuery({
    queryKey: ["admin-users-with-bookings"],
    queryFn: async () => {
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .order("full_name");
      if (profilesError) throw profilesError;

      // Get booking counts per user
      const { data: bookingsData, error: bookingsError } = await supabase
        .from("bookings")
        .select("user_id");
      if (bookingsError) throw bookingsError;

      const bookingCounts: Record<string, number> = {};
      bookingsData?.forEach((b) => {
        bookingCounts[b.user_id] = (bookingCounts[b.user_id] ?? 0) + 1;
      });

      return profilesData?.map((p) => ({
        ...p,
        booking_count: bookingCounts[p.user_id] ?? 0,
      })) ?? [];
    },
  });

  const profileMap: Record<string, string> = profiles
    ? Object.fromEntries(profiles.map((p) => [p.user_id, p.full_name ?? "Unknown"]))
    : {};

  // Recent = last 10 bookings
  const recentBookings = allBookings?.slice(0, 10) ?? [];

  // Filter bookings by selected user email
  const filteredBookings = selectedUserEmail
    ? allBookings?.filter((b) => {
        const userProfile = profiles?.find((p) => p.user_id === b.user_id);
        return userProfile?.email === selectedUserEmail;
      }) ?? []
    : allBookings ?? [];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-[calc(100vh-4rem)]">
      <div className="container mx-auto px-4 py-6">
        <h1 className="font-display text-2xl font-bold text-foreground mb-6">Admin Dashboard</h1>

        <Tabs value={activeTab} onValueChange={setActiveTab} defaultValue="recent">
          <TabsList className="mb-6">
            <TabsTrigger value="recent">Recent</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="stations">Stations</TabsTrigger>
            <TabsTrigger value="bookings">All Bookings</TabsTrigger>
          </TabsList>

          {/* ── RECENT TAB ── */}
          <TabsContent value="recent">
            <div className="space-y-3">
              <h2 className="font-display text-lg font-semibold">Recent Bookings</h2>
              {bookingsLoading ? (
                <div className="flex justify-center py-12"><Loader /></div>
              ) : recentBookings.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">No bookings yet.</div>
              ) : (
                recentBookings.map((booking, i) => (
                  <motion.div
                    key={booking.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="glass rounded-xl p-4 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                        <Zap className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{booking.stations?.name ?? "Station"}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{profileMap[booking.user_id] ?? booking.user_id.slice(0, 8)}</span>
                          <CalendarCheck className="h-3 w-3 ml-1" />
                          <span>{format(new Date(booking.booking_date), "PP")}</span>
                          <Clock className="h-3 w-3" />
                          <span>{booking.time_slot}</span>
                        </div>
                      </div>
                    </div>
                    <Badge
                      variant={
                        booking.status === "confirmed" ? "default" :
                        booking.status === "cancelled" ? "destructive" : "secondary"
                      }
                    >
                      {booking.status}
                    </Badge>
                  </motion.div>
                ))
              )}
            </div>
          </TabsContent>

          {/* ── USERS TAB ── */}
          <TabsContent value="users">
            <h2 className="font-display text-lg font-semibold mb-4">Users</h2>
            {usersWithBookings === undefined ? (
              <div className="flex justify-center py-12"><Loader /></div>
            ) : (
              <div className="glass rounded-xl overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Username</TableHead>
                      <TableHead className="text-right">Bookings</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {usersWithBookings && usersWithBookings.length > 0 ? (
                      usersWithBookings.map((userInfo) => (
                        <TableRow key={userInfo.user_id}>
                          <TableCell className="font-medium">{userInfo.full_name ?? "—"}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant="outline">{userInfo.booking_count}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedUserEmail(userInfo.email || null);
                                setActiveTab("bookings");
                              }}
                            >
                              View Bookings
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                          No users found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          {/* ── STATIONS TAB ── */}
          <TabsContent value="stations">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg font-semibold">Stations</h2>
              <Button onClick={() => { setShowForm(!showForm); if (showForm) resetForm(); }} className="gap-1.5">
                {showForm ? <><X className="h-4 w-4" /> Cancel</> : <><Plus className="h-4 w-4" /> Add Station</>}
              </Button>
            </div>

        {/* Add / Edit Form */}
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="glass rounded-xl p-6 mb-6"
          >
            <h2 className="font-display text-lg font-semibold mb-4">
              {editingId ? "Edit Station" : "Add New Station"}
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-4">
                <div>
                  <label htmlFor="admin-station-name" className="text-sm font-medium mb-1.5 block">Station Name</label>
                  <Input
                    id="admin-station-name"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Enter station name"
                    maxLength={200}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="admin-station-latitude" className="text-sm font-medium mb-1.5 block">Latitude</label>
                    <Input
                      id="admin-station-latitude"
                      value={form.latitude}
                      onChange={(e) => setForm((f) => ({ ...f, latitude: e.target.value }))}
                      placeholder="e.g. 28.6139"
                    />
                  </div>
                  <div>
                    <label htmlFor="admin-station-longitude" className="text-sm font-medium mb-1.5 block">Longitude</label>
                    <Input
                      id="admin-station-longitude"
                      value={form.longitude}
                      onChange={(e) => setForm((f) => ({ ...f, longitude: e.target.value }))}
                      placeholder="e.g. 77.2090"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="admin-charger-type" className="text-sm font-medium mb-1.5 block">Charger Type</label>
                  <Select
                    value={form.charger_type}
                    onValueChange={(v) => setForm((f) => ({ ...f, charger_type: v as ChargerType }))}
                  >
                    <SelectTrigger id="admin-charger-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Constants.public.Enums.charger_type.map((type) => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label htmlFor="admin-available-slots" className="text-sm font-medium mb-1.5 block">Available Slots</label>
                  <Input
                    id="admin-available-slots"
                    type="number"
                    min="0"
                    value={form.available_slots}
                    onChange={(e) => setForm((f) => ({ ...f, available_slots: e.target.value }))}
                  />
                </div>
                <Button onClick={() => upsertStation.mutate()} disabled={upsertStation.isPending} className="w-full">
                  {upsertStation.isPending ? "Saving..." : editingId ? "Update Station" : "Add Station"}
                </Button>
              </div>
              <div>
                <p className="text-sm font-medium mb-1.5 block">Pick Location on Map</p>
                <MapView
                  stations={stations || []}
                  onMapClick={handleMapClick}
                  selectedPosition={mapPosition}
                  className="h-[300px]"
                />
              </div>
            </div>
          </motion.div>
        )}

        {/* Stations Table */}
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader /></div>
        ) : (
          <div className="glass rounded-xl overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Charger Type</TableHead>
                  <TableHead>Slots</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stations && stations.length > 0 ? (
                  stations.map((station) => (
                    <TableRow key={station.id}>
                      <TableCell className="font-medium">{station.name}</TableCell>
                      <TableCell>{station.charger_type}</TableCell>
                      <TableCell>{station.available_slots}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {station.latitude.toFixed(4)}, {station.longitude.toFixed(4)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(station)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => deleteStation.mutate(station.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No stations yet. Add your first one!
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
          </TabsContent>

          {/* ── ALL BOOKINGS TAB ── */}
          <TabsContent value="bookings">
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <h2 className="font-display text-lg font-semibold">All Bookings</h2>
                {selectedUserEmail && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedUserEmail(null)}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Clear Filter
                  </Button>
                )}
              </div>
              
              {selectedUserEmail && (
                <div className="glass rounded-xl p-4 bg-primary/5 border border-primary/20">
                  <p className="text-sm">
                    <span className="font-semibold">Filtering by email:</span> {selectedUserEmail}
                  </p>
                </div>
              )}

              {bookingsLoading ? (
                <div className="flex justify-center py-12"><Loader /></div>
              ) : (
                <div className="glass rounded-xl overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Station</TableHead>
                        <TableHead>Username</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Time Slot</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredBookings && filteredBookings.length > 0 ? (
                        filteredBookings.map((booking) => {
                          const userProfile = profiles?.find((p) => p.user_id === booking.user_id);
                          return (
                            <TableRow key={booking.id}>
                              <TableCell className="font-medium">{booking.stations?.name ?? "—"}</TableCell>
                              <TableCell className="text-sm">{userProfile?.full_name ?? "—"}</TableCell>
                              <TableCell>{format(new Date(booking.booking_date), "PP")}</TableCell>
                              <TableCell>{booking.time_slot}</TableCell>
                              <TableCell>
                                <Badge
                                  variant={
                                    booking.status === "confirmed" ? "default" :
                                    booking.status === "cancelled" ? "destructive" : "secondary"
                                  }
                                >
                                  {booking.status}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      ) : (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                            {selectedUserEmail ? "No bookings found for this user." : "No bookings yet."}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </motion.div>
  );
}
