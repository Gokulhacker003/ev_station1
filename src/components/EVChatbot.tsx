import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, Send, Zap, Bot, User, LogIn, LogOut, Eye, EyeOff, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useAuth } from "@/contexts/AuthContext";

interface ActionGroup {
  stationName: string;
  bookTo?: string;
  navigateTo?: string;
  authAction?: "login" | "signup";
}

interface Message {
  role: "user" | "assistant";
  content: string;
  actionGroups?: ActionGroup[];
}

interface GeoPoint {
  latitude: number;
  longitude: number;
}

// Local EV Assistant - provides comprehensive EV charging help without server dependency
function getEVAssistantResponse(userMessage: string): string {
  const message = userMessage.toLowerCase();
  
  // Emergency situations
  if (message.includes("stranded") || message.includes("stuck") || message.includes("dead") || message.includes("0%")) {
    return "🚨 **Emergency Battery Assistance**\n\n**Immediate Steps:**\n1. 🔍 Use our map to find the nearest charging station\n2. 📞 Call roadside assistance if needed\n3. 🚗 Try to get to a charging station with remaining range\n\n**Prevention:** Keep battery above 20% for peace of mind. Most EVs have 10-50 miles of reserve range even at 0%.";
  }

  // Charger types and compatibility
  if (message.includes("charger type") || message.includes("plug type") || message.includes("connector") || message.includes("compatible")) {
    return "🔌 **EV Charger Types Guide**\n\n**AC Charging (Slow/Fast):**\n- **Type 1** (J1772): 3.7-7kW, common in US\n- **Type 2** (Mennekes): 3.7-22kW, standard in Europe\n\n**DC Fast Charging:**\n- **CCS** (Combo): Up to 350kW, most common\n- **CHAdeMO**: Up to 100kW, mainly Nissan/older cars\n- **Tesla Supercharger**: Tesla-specific, adapters available\n\n💡 Check your car manual or charging port label for your connector type!";
  }

  // Charging speeds and times
  if (message.includes("charging time") || message.includes("how long") || message.includes("speed") || message.includes("fast")) {
    return "⚡ **Charging Speeds & Times**\n\n**Level 1 (Home outlet):** 2-5 miles/hour\n**Level 2 (Home/Public):** 10-60 miles/hour  \n**DC Fast:** 100-300+ miles/hour\n\n**Typical Times (10-80%):**\n- 🏠 Home Level 2: 4-8 hours\n- ⚡ DC Fast: 20-45 minutes\n- 🚀 Ultra-fast: 15-25 minutes\n\n**Speed factors:** Battery size, temperature, current charge level, charger power rating";
  }

  // Battery level and recommendations
  if (message.match(/\b(\d+)%/) || message.includes("battery") || message.includes("charge level")) {
    const percentMatch = message.match(/\b(\d+)%/);
    const batteryLevel = percentMatch ? parseInt(percentMatch[1]) : null;
    
    if (batteryLevel !== null) {
      if (batteryLevel < 20) {
        return `🔋 **${batteryLevel}% Battery - Action Needed**\n\n⚠️ **Find charging soon!** \n\n**Recommendations:**\n1. 🗺️ Use our map to locate nearest stations\n2. ⚡ Look for DC fast charging (20-30 min boost)\n3. 🎯 Charge to 80% for optimal speed\n\n**Tip:** Many stations offer amenities while you charge!`;
      } else if (batteryLevel < 50) {
        return `🔋 **${batteryLevel}% Battery - Good Range**\n\n✅ You have decent range remaining!\n\n**Suggestions:**\n- 🗺️ Plan your next charging stop\n- ⚡ Consider topping up at convenient locations\n- 🎯 Charging from ${batteryLevel}% to 80% is typically fastest\n\n**Range tip:** Most EVs get 250-400 miles on a full charge.`;
      } else {
        return `🔋 **${batteryLevel}% Battery - Excellent!**\n\n🎉 You're in great shape for your journey!\n\n**Smart charging:**\n- 🏠 Charge overnight at home when possible\n- ⚡ Use fast charging for long trips\n- 🌡️ Pre-condition battery in extreme weather\n\n**Pro tip:** Keep between 20-80% for daily use to maximize battery life.`;
      }
    }
    
    return "🔋 **Battery Management Tips**\n\n**Daily use:** Keep between 20-80%\n**Long trips:** Charge to 100% before departure\n**Storage:** Store at ~50% if unused for weeks\n\n**Battery health:** Modern EVs have 8-10 year warranties and minimal degradation with proper care!";
  }

  // Finding stations
  if (message.includes("find") || message.includes("nearest") || message.includes("station") || message.includes("map") || message.includes("location")) {
    return "🗺️ **Finding Charging Stations**\n\n**Using our app:**\n1. 📍 Tap the **Map** tab at the bottom\n2. 🎯 Allow location access for nearest stations\n3. 🔍 Filter by charger type, speed, availability\n4. 📅 Book time slots to guarantee access\n\n**What you'll see:**\n- ⚡ Real-time availability\n- 💰 Pricing information\n- 🔌 Connector types available\n- ⭐ User ratings and amenities";
  }

  // Booking help
  if (message.includes("book") || message.includes("reservation") || message.includes("reserve") || message.includes("appointment")) {
    return "📅 **Booking Time Slots**\n\n**How to book:**\n1. 🗺️ Find a station on the map\n2. 📋 Tap the station card\n3. ⏰ Select your preferred time slot\n4. ✅ Confirm your booking\n\n**Booking benefits:**\n- 🎯 Guaranteed charger access\n- ⏰ No waiting in line\n- 📱 Arrival reminders\n- 💰 Sometimes better pricing\n\n**Tip:** Book ahead for busy locations and during peak travel times!";
  }

  // Costs and pricing
  if (message.includes("cost") || message.includes("price") || message.includes("expensive") || message.includes("cheap") || message.includes("money")) {
    return "💰 **EV Charging Costs**\n\n**Typical pricing:**\n- 🏠 Home: $0.10-0.30/kWh (cheapest)\n- 🅿️ Level 2 public: $0.20-0.50/kWh\n- ⚡ DC Fast: $0.30-0.60/kWh\n- 🚀 Premium fast: $0.40-0.70/kWh\n\n**Cost comparison:**\n- ⚡ EV: ~$0.04-0.15/mile\n- ⛽ Gas car: ~$0.12-0.20/mile\n\n**Money-saving tips:**\n- 🕐 Charge during off-peak hours\n- 🎫 Look for membership discounts\n- 🏠 Home charging is usually cheapest";
  }

  // Weather and charging
  if (message.includes("cold") || message.includes("winter") || message.includes("hot") || message.includes("weather") || message.includes("temperature")) {
    return "🌡️ **Weather & Charging Tips**\n\n**Cold weather:**\n- ❄️ Range reduced 20-40% in freezing temps\n- 🔥 Pre-heat car while plugged in\n- 🔋 Battery warms up during charging\n- 🅿️ Park in garage when possible\n\n**Hot weather:**\n- ☀️ Use sunshades and park in shade\n- ❄️ Pre-cool car while plugged in\n- 🔋 Very hot batteries charge slower\n\n**Year-round:** Keep battery between 20-80% for best performance in all weather!";
  }

  // Troubleshooting
  if (message.includes("error") || message.includes("problem") || message.includes("not working") || message.includes("failed") || message.includes("trouble")) {
    return "🔧 **Charging Troubleshooting**\n\n**Common solutions:**\n1. 🔄 Try a different charging port\n2. 📱 Restart the charging app\n3. 🔌 Check connector is fully inserted\n4. 💳 Verify payment method works\n\n**If charging won't start:**\n- 🚗 Ensure car is unlocked\n- 🔋 Check if battery is too hot/cold\n- ⏰ Verify time slot is active\n- 📞 Contact station support number\n\n**App issues?** Try logging out and back in, or contact our support team!";
  }

  // General/greeting responses
  if (message.includes("hello") || message.includes("hi") || message.includes("help") || message.length < 5) {
    return "⚡ **Welcome to EV Assistant!**\n\nI'm here to help with all your electric vehicle charging needs!\n\n**Popular topics:**\n- 🔍 *\"Find nearest charging station\"*\n- 🔋 *\"My battery is at [X]%\"*\n- 🔌 *\"What charger type do I need?\"*\n- 📅 *\"How do I book a time slot?\"*\n- 💰 *\"How much does charging cost?\"*\n- 🌡️ *\"Charging in cold weather\"*\n\n**What can I help you with today?**";
  }

  // App navigation help
  if (message.includes("how to") || message.includes("navigate") || message.includes("use app") || message.includes("feature")) {
    return "📱 **App Navigation Guide**\n\n**Main tabs:**\n🏠 **Home:** Quick access to nearby stations\n🗺️ **Map:** Interactive station finder with filters\n📋 **Bookings:** Your reservations and history\n⚙️ **Settings:** Account and preferences\n\n**Key features:**\n- 📍 Location-based station search\n- ⚡ Real-time availability\n- 📅 Time slot booking system\n- 💰 Price comparison\n- ⭐ User reviews and ratings\n\n**Need help with a specific feature? Just ask!**";
  }

  // Default response for unmatched queries
  return "🤔 **I'd love to help!**\n\nI specialize in EV charging assistance. Try asking about:\n\n🔋 **Battery & Charging:**\n- Battery level recommendations\n- Charging times and speeds\n- Connector types\n\n🗺️ **Finding Stations:**\n- Locating nearby chargers\n- Booking time slots\n- Station amenities\n\n💡 **Tips & Troubleshooting:**\n- Cost-saving strategies\n- Weather considerations\n- Problem solving\n\n**What specific EV topic can I help with?**";
}

function isNearestStationQuery(input: string): boolean {
  const message = input.toLowerCase();
  return /(nearest|closest|nearby|near me|find.*station|station.*near|where.*charg|charg.*where)/.test(message);
}

function haversineKm(from: GeoPoint, to: GeoPoint): number {
  const R = 6371;
  const dLat = ((to.latitude - from.latitude) * Math.PI) / 180;
  const dLon = ((to.longitude - from.longitude) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((from.latitude * Math.PI) / 180) *
      Math.cos((to.latitude * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function getAppNearestStationsReply(
  input: string,
  location: GeoPoint | null,
): Promise<{ content: string; actionGroups: ActionGroup[] } | null> {
  if (!isNearestStationQuery(input)) return null;

  const { data: stations, error } = await supabase
    .from("stations")
    .select("id, name, latitude, longitude, charger_type, available_slots");

  if (error || !stations || stations.length === 0) {
    return {
      content: "No EV charging stations are registered in this app yet. Check back soon or contact the admin to add stations.",
      actionGroups: [],
    };
  }

  const withDistance = stations
    .map((s) => ({
      ...s,
      distanceKm: location
        ? haversineKm(location, { latitude: s.latitude, longitude: s.longitude })
        : null,
    }))
    .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity))
    .slice(0, 5);

  const header = location
    ? `Here are the nearest EV charging stations on this app:`
    : `Here are EV charging stations on this app (allow location access to sort by distance):`;

  const details = withDistance
    .map((s, i) => {
      const lines = [
        `${i + 1}. **${s.name}**`,
        `Charger: ${s.charger_type}`,
        `Slots: ${s.available_slots > 0 ? s.available_slots + " available" : "Full — no slots"}`,
        `Coordinates: ${s.latitude.toFixed(6)}, ${s.longitude.toFixed(6)}`,
      ];
      if (s.distanceKm !== null) {
        const km = s.distanceKm;
        const distLabel = km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(2)} km`;
        const driveMin = Math.round((km / 30) * 60);
        lines.push(`Distance: ${distLabel} (~${driveMin} min drive)`);
      }
      return lines.join("\n");
    })
    .join("\n\n");

  const actionGroups: ActionGroup[] = withDistance.map((s) => ({
    stationName: s.name,
    bookTo: s.available_slots > 0 ? `/bookings?station=${s.id}` : undefined,
    navigateTo: `/map?station=${s.id}`,
  }));

  return { content: `${header}\n\n${details}`, actionGroups };
}

function isBookIntent(input: string): boolean {
  const msg = input.toLowerCase();
  return /(book|reserve|schedule).*(slot|station|charge|charg)|(slot|station).*(book|reserve)/.test(msg);
}

function isNavigateIntent(input: string): boolean {
  const msg = input.toLowerCase();
  return /(navigate|direction|route|how.*get|take me|drive to|get to).*(station|charg)|(station|charg).*(navigate|direction|route)/.test(msg);
}

function extractStationNameHint(input: string): string | null {
  const match = input.match(
    /(?:at|to|for|navigate to|directions? to|route to|book at|reserve at|get to)\s+([a-zA-Z0-9 &'().\-]{2,40}?)(?:\s+station|\s+charger|$|[?,.!])/i,
  );
  return match?.[1]?.trim() || null;
}

async function getStationActionReply(
  input: string,
  intent: "book" | "navigate",
): Promise<{ content: string; actionGroups: ActionGroup[] } | null> {
  const { data: stations, error } = await supabase
    .from("stations")
    .select("id, name, charger_type, available_slots");

  if (error || !stations || stations.length === 0) return null;

  const hint = extractStationNameHint(input);
  const matched = hint
    ? stations.filter(
        (s) =>
          s.name.toLowerCase().includes(hint.toLowerCase()) ||
          hint.toLowerCase().includes(s.name.toLowerCase().split(" ")[0]),
      )
    : stations;

  const targets = (matched.length > 0 ? matched : stations).slice(0, 5);

  const actionWord = intent === "book" ? "book a slot at" : "navigate to";
  const content =
    targets.length === 1
      ? `**${targets[0].name}**\nCharger: ${targets[0].charger_type}\nSlots: ${
          targets[0].available_slots > 0
            ? targets[0].available_slots + " available"
            : "Full — no slots"
        }\n\nTap the button below to ${actionWord} this station.`
      : `Found **${targets.length} station${targets.length > 1 ? "s" : ""}**. Tap a button below:`;

  const actionGroups: ActionGroup[] = targets.map((s) => ({
    stationName: s.name,
    bookTo:
      intent === "book" && s.available_slots > 0
        ? `/bookings?station=${s.id}`
        : undefined,
    navigateTo: intent === "navigate" ? `/map?station=${s.id}` : undefined,
  }));

  return { content, actionGroups };
}

type AuthMode = "none" | "login" | "signup";

export function EVChatbot() {
  const navigate = useNavigate();
  const { user, signIn, signUp, signOut, loading: authLoading } = useAuth();
  const { latitude, longitude, loading: geoLoading } = useGeolocation();

  // Inline auth panel state
  const [authMode, setAuthMode] = useState<AuthMode>("none");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authName, setAuthName] = useState("");
  const [authError, setAuthError] = useState("");
  const [authSuccess, setAuthSuccess] = useState("");
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const openAuth = (mode: AuthMode) => {
    setAuthMode(mode);
    setAuthEmail("");
    setAuthPassword("");
    setAuthName("");
    setAuthError("");
    setAuthSuccess("");
    setShowPw(false);
  };

  const closeAuth = () => setAuthMode("none");

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authEmail.trim() || !authPassword.trim()) return;
    setAuthSubmitting(true);
    setAuthError("");
    setAuthSuccess("");
    try {
      if (authMode === "signup") {
        if (!authName.trim()) { setAuthError("Full name is required"); setAuthSubmitting(false); return; }
        await signUp(authEmail.trim(), authPassword, authName.trim());
        setAuthSuccess("✅ Account created! Check your email to confirm.");
        setAuthEmail(""); setAuthPassword(""); setAuthName("");
      } else {
        await signIn(authEmail.trim(), authPassword);
        closeAuth();
        setMessages((prev) => [...prev, { role: "assistant", content: `✅ **Welcome back!** You're now signed in and can book charging slots.` }]);
      }
    } catch (err: any) {
      setAuthError(err?.message || "Something went wrong. Please try again.");
    } finally {
      setAuthSubmitting(false);
    }
  };
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "⚡ **Welcome! I'm your EV Assistant** 🚗💨\n\nI have comprehensive knowledge about electric vehicle charging and can help you with:\n\n🔋 **Battery questions:** *\"My battery is at 25%\"*\n🗺️ **Finding stations:** *\"Find nearest DC fast charging\"*\n🔌 **Charger types:** *\"What connector do I need?\"*\n📅 **Booking help:** *\"How do I reserve a time slot?\"*\n💰 **Costs & savings:** *\"How much does charging cost?\"*\n🌡️ **Weather tips:** *\"Charging in cold weather\"*\n\n**Ready to help you charge smarter!** ⚡",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");

    const userMsg: Message = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      // If geo is still resolving and user wants nearest stations, wait up to 6 s
      if (isNearestStationQuery(text) && geoLoading) {
        await new Promise<void>((resolve) => setTimeout(resolve, 6000));
      }

      const userLocation =
        latitude !== null && longitude !== null ? { latitude, longitude } : null;

      // 1. Nearest station query → stations from app DB with Book + Navigate buttons
      const appStationsReply = await getAppNearestStationsReply(text, userLocation);
      if (appStationsReply) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: appStationsReply.content, actionGroups: appStationsReply.actionGroups },
        ]);
        return;
      }

      // 2. Book intent → show matching stations with Book Slot button
      // 2. Book intent → require login, then show matching stations with Book Slot button
      if (isBookIntent(text)) {
        if (!user) {
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: "🔐 **Sign in required**\n\nYou need to be logged in to book a charging slot. Sign in or create a free account to continue.",
              actionGroups: [{ stationName: "", authAction: "login" as const }],
            },
          ]);
          return;
        }
        const result = await getStationActionReply(text, "book");
        if (result) {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: result.content, actionGroups: result.actionGroups },
          ]);
          return;
        }
      }

      // 3. Navigate intent → show matching stations with Navigate button
      if (isNavigateIntent(text)) {
        const result = await getStationActionReply(text, "navigate");
        if (result) {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: result.content, actionGroups: result.actionGroups },
          ]);
          return;
        }
      }

      // 4. Other questions → try edge function, fallback to local knowledge
      const { data, error } = await supabase.functions.invoke("ev-assistant", {
        body: { messages: [...messages, userMsg], location: userLocation },
      });

      if (error) throw error;

      const reply = typeof data?.reply === "string" ? data.reply : "";
      if (!reply) throw new Error("Empty response");

      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (err: any) {
      console.error("Chatbot error:", err);
      const fallbackReply = getEVAssistantResponse(text);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: fallbackReply },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating button */}
      <AnimatePresence>
        {!open && (
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            onClick={() => setOpen(true)}
            className="fixed bottom-24 right-5 z-[9999] flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 hover:scale-110 transition-all duration-200"
          >
            <MessageCircle className="h-6 w-6" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat window */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.95 }}
            className="fixed bottom-24 right-4 z-[9999] w-[340px] max-h-[500px] flex flex-col rounded-2xl shadow-2xl border border-border overflow-hidden bg-card md:w-[360px] md:max-h-[520px]"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 bg-primary text-primary-foreground">
              <div className="flex items-center gap-2 min-w-0">
                <Zap className="h-5 w-5 shrink-0" />
                <div className="min-w-0">
                  <span className="font-display font-semibold">
                    {user
                      ? `Hi, ${user.user_metadata?.full_name?.split(" ")[0] || user.email?.split("@")[0]}!`
                      : "EV Assistant"}
                  </span>
                  <p className="text-[10px] text-primary-foreground/70 leading-none mt-0.5 truncate">
                    {geoLoading
                      ? "📡 Acquiring location…"
                      : latitude !== null
                      ? "📍 Location ready"
                      : "⚠️ Location unavailable"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {user ? (
                  <button
                    title="Sign out"
                    onClick={async () => { await signOut(); setMessages((prev) => [...prev, { role: "assistant", content: "👋 You've been signed out." }]); }}
                    className="hover:bg-primary-foreground/20 rounded-lg px-2 py-1 text-[11px] font-medium flex items-center gap-1"
                  >
                    <LogOut className="h-3.5 w-3.5" /> Sign Out
                  </button>
                ) : (
                  <>
                    <button
                      title="Login"
                      onClick={() => openAuth("login")}
                      className="hover:bg-primary-foreground/20 rounded-lg px-2 py-1 text-[11px] font-medium flex items-center gap-1"
                    >
                      <LogIn className="h-3.5 w-3.5" /> Login
                    </button>
                    <button
                      title="Sign Up"
                      onClick={() => openAuth("signup")}
                      className="hover:bg-primary-foreground/20 rounded-lg px-2 py-1 text-[11px] font-medium flex items-center gap-1"
                    >
                      <UserPlus className="h-3.5 w-3.5" /> Sign Up
                    </button>
                  </>
                )}
                <button onClick={() => { setOpen(false); closeAuth(); }} className="hover:bg-primary-foreground/20 rounded-lg p-1 ml-1">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Inline Auth Panel */}
            {authMode !== "none" && (
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
                <div className="flex items-center gap-2 mb-1">
                  {authMode === "login"
                    ? <LogIn className="h-4 w-4 text-primary" />
                    : <UserPlus className="h-4 w-4 text-primary" />}
                  <span className="font-semibold text-sm">
                    {authMode === "login" ? "Sign In" : "Create Account"}
                  </span>
                  <button onClick={closeAuth} className="ml-auto text-muted-foreground hover:text-foreground">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <form onSubmit={handleAuthSubmit} className="flex flex-col gap-2">
                  {authMode === "signup" && (
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="Full name"
                        value={authName}
                        onChange={(e) => setAuthName(e.target.value)}
                        required
                        className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                  )}
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">@</span>
                    <input
                      type="email"
                      placeholder="Email address"
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                      required
                      className="w-full pl-7 pr-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div className="relative">
                    <input
                      type={showPw ? "text" : "password"}
                      placeholder="Password"
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      required
                      minLength={6}
                      className="w-full pl-3 pr-9 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw((v) => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                    >
                      {showPw ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                  {authError && (
                    <p className="text-xs text-destructive bg-destructive/10 rounded-lg px-2 py-1">{authError}</p>
                  )}
                  {authSuccess && (
                    <p className="text-xs text-green-700 bg-green-100 rounded-lg px-2 py-1">{authSuccess}</p>
                  )}
                  <Button type="submit" size="sm" className="w-full mt-1" disabled={authSubmitting}>
                    {authSubmitting ? "Please wait…" : authMode === "login" ? "Sign In" : "Create Account"}
                  </Button>
                </form>
                <button
                  onClick={() => openAuth(authMode === "login" ? "signup" : "login")}
                  className="text-xs text-center text-muted-foreground hover:text-primary underline underline-offset-2"
                >
                  {authMode === "login" ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
                </button>
              </div>
            )}

            {/* Messages */}
            {/* Messages (hidden while auth panel is open) */}
            {authMode === "none" && (
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 min-h-[280px] max-h-[350px]">
              {messages.map((msg, i) => (
                <div key={i} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  {msg.role === "assistant" && (
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                  )}
                  <div
                    className={`rounded-xl px-3 py-2 text-sm max-w-[80%] ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                    }`}
                  >
                    <ReactMarkdown
                      components={{
                        p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
                        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                        ul: ({ children }) => <ul className="list-disc pl-4 mb-1">{children}</ul>,
                        li: ({ children }) => <li className="mb-0.5">{children}</li>,
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                    {msg.actionGroups && msg.actionGroups.length > 0 && (
                      <div className="mt-2 space-y-2 border-t border-border/40 pt-2">
                        {msg.actionGroups.map((group, gi) => (
                          <div key={gi} className="flex flex-col gap-1">
                            <span className="text-[11px] text-muted-foreground font-medium truncate">
                              {group.stationName}
                            </span>
                            <div className="flex gap-1.5 flex-wrap">
                              {group.authAction && (
                                <>
                                  <button
                                    className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md text-[11px] font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                                    onClick={() => openAuth("login")}
                                  >
                                    <LogIn className="h-3 w-3" /> Sign In
                                  </button>
                                  <button
                                    className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md text-[11px] font-semibold border border-border bg-background text-foreground hover:bg-muted transition-colors"
                                    onClick={() => openAuth("signup")}
                                  >
                                    <UserPlus className="h-3 w-3" /> Sign Up
                                  </button>
                                </>
                              )}
                              {group.bookTo && (
                                <button
                                  className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md text-[11px] font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                                  onClick={() => { navigate(group.bookTo!); setOpen(false); }}
                                >
                                  📅 Book Slot
                                </button>
                              )}
                              {group.navigateTo && (
                                <button
                                  className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md text-[11px] font-semibold border border-border bg-background text-foreground hover:bg-muted transition-colors"
                                  onClick={() => { navigate(group.navigateTo!); setOpen(false); }}
                                >
                                  🗺️ Navigate
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {msg.role === "user" && (
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary">
                      <User className="h-4 w-4 text-secondary-foreground" />
                    </div>
                  )}
                </div>
              ))}
              {loading && (
                <div className="flex gap-2 items-center">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex gap-1 px-3 py-2">
                    <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              )}
            </div>
            )}

            {/* Guest quick-action bar */}
            {authMode === "none" && !user && !authLoading && (
              <div className="px-3 py-2 border-t border-border flex gap-2">
                <button
                  onClick={() => openAuth("login")}
                  className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  <LogIn className="h-3.5 w-3.5" /> Sign In
                </button>
                <button
                  onClick={() => openAuth("signup")}
                  className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg text-xs font-semibold border border-border bg-background text-foreground hover:bg-muted transition-colors"
                >
                  <UserPlus className="h-3.5 w-3.5" /> Sign Up
                </button>
              </div>
            )}

            {/* Input (hidden while auth panel is open) */}
            {authMode === "none" && (
            <div className="p-3 border-t border-border">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  send();
                }}
                className="flex gap-2"
              >
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about EV charging..."
                  className="flex-1 text-sm"
                  disabled={loading}
                />
                <Button type="submit" size="icon" disabled={!input.trim() || loading} className="shrink-0">
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
            )}
            </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
