// @ts-expect-error - Deno URL import, not resolved by Node.js TypeScript compiler
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Max-Age": "86400",
};

interface WikiEntry {
  title: string;
  extract: string;
  url: string;
}

interface Coordinates {
  latitude: number;
  longitude: number;
}

interface OverpassElement {
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

interface StationResult {
  name: string;
  latitude: number;
  longitude: number;
  distanceKm: number;
  address: string;
  operator?: string;
  openingHours?: string;
  phone?: string;
  website?: string;
  connectorDetails?: string[];
  source: string;
}

function stripHtml(input: string): string {
  return input.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function haversineKm(from: Coordinates, to: Coordinates): number {
  const earthRadiusKm = 6371;
  const dLat = toRadians(to.latitude - from.latitude);
  const dLon = toRadians(to.longitude - from.longitude);
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(to.latitude);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusKm * c;
}

function extractLocationHint(query: string): string | null {
  const normalized = query.toLowerCase();
  const match = normalized.match(/(?:in|near)\s+([a-z0-9 ,.-]{3,})/i);
  if (!match?.[1]) {
    return null;
  }

  return match[1].trim();
}

async function geocodeLocation(locationHint: string): Promise<Coordinates | null> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "json");
  url.searchParams.set("q", locationHint);
  url.searchParams.set("limit", "1");

  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      "User-Agent": "ev-charge-connect-assistant/1.0",
    },
  });

  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  if (!Array.isArray(data) || data.length === 0) {
    return null;
  }

  const first = data[0];
  const latitude = Number(first?.lat);
  const longitude = Number(first?.lon);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return { latitude, longitude };
}

function isNearestStationQuery(query: string): boolean {
  const normalized = query.toLowerCase();
  return (
    /(nearest|closest|nearby|near me)/.test(normalized) &&
    /(ev|charging|charger|station)/.test(normalized)
  );
}

function buildAddress(tags: Record<string, string>): string {
  const parts = [
    tags["addr:housenumber"],
    tags["addr:street"],
    tags["addr:city"],
    tags["addr:state"],
    tags["addr:postcode"],
    tags["addr:country"],
  ].filter((part) => typeof part === "string" && part.trim().length > 0);

  if (parts.length === 0) {
    return "Address not available";
  }

  return parts.join(", ");
}

function extractConnectorDetails(tags: Record<string, string>): string[] {
  return Object.entries(tags)
    .filter(([key, value]) => key.startsWith("socket:") && value && value !== "no")
    .map(([key, value]) => {
      const connector = key.replace("socket:", "").replace(/_/g, " ");
      return `${connector}: ${value}`;
    });
}

async function fetchNearestStations(center: Coordinates): Promise<StationResult[]> {
  const overpassQuery = `
[out:json][timeout:25];
(
  node["amenity"="charging_station"](around:7000,${center.latitude},${center.longitude});
  way["amenity"="charging_station"](around:7000,${center.latitude},${center.longitude});
  relation["amenity"="charging_station"](around:7000,${center.latitude},${center.longitude});
);
out center tags 20;
`;

  const response = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: overpassQuery,
  });

  if (!response.ok) {
    return [];
  }

  const data = await response.json();
  const elements: OverpassElement[] = Array.isArray(data?.elements) ? data.elements : [];

  const stations = elements
    .map((element: OverpassElement) => {
      const lat = Number(element?.lat ?? element?.center?.lat);
      const lon = Number(element?.lon ?? element?.center?.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        return null;
      }

      const tags: Record<string, string> = element?.tags ?? {};
      const name = tags.name?.trim() || "Unnamed EV Charging Station";
      const distanceKm = haversineKm(center, { latitude: lat, longitude: lon });

      return {
        name,
        latitude: lat,
        longitude: lon,
        distanceKm,
        address: buildAddress(tags),
        operator: tags.operator,
        openingHours: tags.opening_hours,
        phone: tags.phone,
        website: tags.website,
        connectorDetails: extractConnectorDetails(tags),
        source: `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=17/${lat}/${lon}`,
      } as StationResult;
    })
    .filter((station: StationResult | null): station is StationResult => !!station)
    .sort((a: StationResult, b: StationResult) => a.distanceKm - b.distanceKm)
    .slice(0, 5);

  return stations;
}

function buildNearestStationsReply(stations: StationResult[], usedLocation: Coordinates): string {
  if (stations.length === 0) {
    return "I could not find EV charging stations nearby from web map data right now. Please try again or provide a city name, for example: nearest EV station in Bangalore.";
  }

  const stationDetails = stations
    .map((station, index) => {
      const lines = [
        `${index + 1}. **${station.name}**`,
        `Location: ${station.latitude.toFixed(6)}, ${station.longitude.toFixed(6)}`,
        `Distance: ${station.distanceKm.toFixed(2)} km`,
        `Address: ${station.address}`,
      ];

      if (station.operator) {
        lines.push(`Operator: ${station.operator}`);
      }
      if (station.openingHours) {
        lines.push(`Opening hours: ${station.openingHours}`);
      }
      if (station.connectorDetails && station.connectorDetails.length > 0) {
        lines.push(`Connectors: ${station.connectorDetails.join("; ")}`);
      }
      if (station.phone) {
        lines.push(`Phone: ${station.phone}`);
      }
      if (station.website) {
        lines.push(`Website: ${station.website}`);
      }

      lines.push(`Source: ${station.source}`);
      return lines.join("\n");
    })
    .join("\n\n");

  return `Nearest EV charging stations from live web map data around ${usedLocation.latitude.toFixed(5)}, ${usedLocation.longitude.toFixed(5)}:\n\n${stationDetails}`;
}

async function fetchWikipediaEntries(query: string): Promise<WikiEntry[]> {
  const searchUrl = new URL("https://en.wikipedia.org/w/api.php");
  searchUrl.searchParams.set("action", "query");
  searchUrl.searchParams.set("list", "search");
  searchUrl.searchParams.set("srsearch", `${query} electric vehicle charging`);
  searchUrl.searchParams.set("srlimit", "3");
  searchUrl.searchParams.set("format", "json");
  searchUrl.searchParams.set("origin", "*");

  const searchResponse = await fetch(searchUrl.toString(), {
    headers: { Accept: "application/json" },
  });

  if (!searchResponse.ok) {
    return [];
  }

  const searchData = await searchResponse.json();
  const searchItems = searchData?.query?.search ?? [];

  if (!Array.isArray(searchItems) || searchItems.length === 0) {
    return [];
  }

  const entries = await Promise.all(
    searchItems.slice(0, 3).map(async (item: { title?: string; snippet?: string }) => {
      const title = item?.title?.trim();
      if (!title) return null;

      const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
      const summaryResponse = await fetch(summaryUrl, {
        headers: { Accept: "application/json" },
      });

      if (!summaryResponse.ok) {
        return {
          title,
          extract: stripHtml(item.snippet || "No summary available."),
          url: `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/\s+/g, "_"))}`,
        };
      }

      const summaryData = await summaryResponse.json();
      const extract =
        typeof summaryData?.extract === "string" && summaryData.extract.trim().length > 0
          ? summaryData.extract.trim()
          : stripHtml(item.snippet || "No summary available.");

      return {
        title,
        extract,
        url:
          typeof summaryData?.content_urls?.desktop?.page === "string"
            ? summaryData.content_urls.desktop.page
            : `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/\s+/g, "_"))}`,
      };
    }),
  );

  return entries.filter((entry): entry is WikiEntry => !!entry);
}

function getFallbackReply(lastMessage: string): string {
  if (lastMessage.includes("charging") || lastMessage.includes("charger")) {
    return "⚡ **EV Charging Help**\n\nI can help you with:\n- Finding charging stations\n- Understanding charger types\n- Charging tips and best practices\n\n🔌 **Common EV Charger Types:**\n- **Type 1/2**: Standard AC charging (home/workplace)\n- **CCS**: Fast DC charging for most EVs\n- **CHAdeMO**: Fast charging for Nissan, Mitsubishi\n- **Tesla Supercharger**: High-speed Tesla network";
  }

  if (lastMessage.includes("battery") && (lastMessage.includes("low") || lastMessage.includes("empty"))) {
    return "🔋 **Low Battery Alert!**\n\n⚠️ Find the nearest **fast charger** immediately!\n\n📍 **Quick Tips:**\n- Look for CCS or CHAdeMO fast chargers\n- Avoid long trips with <20% battery\n- Use navigation to find nearest stations\n- Try the map feature in this app!";
  }

  if (lastMessage.includes("time") && lastMessage.includes("charge")) {
    return "⏱️ **Charging Times**\n\n**AC Charging (Type 1/2):**\n- Home (3.7kW): 6-12 hours\n- Public (22kW): 2-4 hours\n\n**DC Fast Charging:**\n- CCS/CHAdeMO (50kW): 30-60 min\n- Tesla Supercharger (150kW+): 15-30 min\n\n*Times vary by battery size and current charge level*";
  }

  if (lastMessage.includes("type") && (lastMessage.includes("charger") || lastMessage.includes("plug"))) {
    return "🔌 **EV Charger Types**\n\n**Type 1**: Older standard, mainly US\n**Type 2**: Common in Europe, increasingly worldwide\n**CCS**: Combined Charging System - most new EVs\n**CHAdeMO**: Mainly Nissan Leaf, Mitsubishi\n**Tesla**: Supercharger network (adapters available)\n\n💡 Check your car's manual for compatible types!";
  }

  if (lastMessage.includes("hello") || lastMessage.includes("hi") || lastMessage.includes("help")) {
    return "⚡ **Hello! I'm your EV Assistant**\n\n🚗 I can help you with:\n- Finding charging stations\n- Understanding charger types\n- Booking charging slots\n- Battery and charging tips\n\n❓ **Try asking:**\n- \"Where can I charge my car?\"\n- \"My battery is low, what should I do?\"\n- \"What charger type do I need?\"";
  }

  return "⚡ **EV Assistant**\n\nI'm here to help with EV charging! 🔋\n\n**Popular questions:**\n- Finding charging stations 📍\n- Charger types and compatibility 🔌\n- Charging times and tips ⏱️\n- Using this app's features 📱\n\nWhat would you like to know about EV charging?";
}

function buildWebBackedReply(userQuery: string, entries: WikiEntry[]): string {
  if (entries.length === 0) {
    return getFallbackReply(userQuery);
  }

  const lines = entries
    .map((entry, index) => `${index + 1}. **${entry.title}**\n${entry.extract}\nSource: ${entry.url}`)
    .join("\n\n");

  return `🌐 **Live EV information from the web**\n\nI found recent reference material related to your question:\n\n${lines}\n\nAsk a follow-up and I can narrow this down to practical charging advice.`;
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { 
      status: 200,
      headers: corsHeaders 
    });
  }

  // Only allow POST requests
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { messages, location } = await req.json();
    
    if (!messages || !Array.isArray(messages)) {
      throw new Error("Invalid messages format");
    }

    const lastMessage = messages[messages.length - 1]?.content?.toLowerCase() || "";

    if (isNearestStationQuery(lastMessage)) {
      let targetLocation: Coordinates | null = null;

      if (
        location &&
        Number.isFinite(location.latitude) &&
        Number.isFinite(location.longitude)
      ) {
        targetLocation = {
          latitude: Number(location.latitude),
          longitude: Number(location.longitude),
        };
      }

      if (!targetLocation) {
        const locationHint = extractLocationHint(lastMessage);
        if (locationHint) {
          targetLocation = await geocodeLocation(locationHint);
        }
      }

      if (!targetLocation) {
        return new Response(
          JSON.stringify({
            reply:
              "Please allow location access in the app, or include a place name like: nearest EV station in Mumbai. Then I will return nearest station name, location, and details from live web data.",
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      const nearestStations = await fetchNearestStations(targetLocation);
      const nearestReply = buildNearestStationsReply(nearestStations, targetLocation);

      return new Response(JSON.stringify({ reply: nearestReply }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const wikiEntries = await fetchWikipediaEntries(lastMessage);
    const reply = buildWebBackedReply(lastMessage, wikiEntries);

    return new Response(JSON.stringify({ reply }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
    
  } catch (error) {
    console.error("ev-assistant error:", error);
    
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    
    return new Response(
      JSON.stringify({ 
        error: "Sorry, I encountered an error. Please try again.",
        details: errorMessage 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
