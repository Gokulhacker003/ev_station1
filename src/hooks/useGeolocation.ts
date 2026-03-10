import { useState, useEffect } from "react";

interface GeoState {
  latitude: number | null;
  longitude: number | null;
  error: string | null;
  loading: boolean;
}

export function useGeolocation() {
  const [state, setState] = useState<GeoState>({
    latitude: null,
    longitude: null,
    error: null,
    loading: true,
  });

  useEffect(() => {
    if (!navigator.geolocation) {
      setState((s) => ({ ...s, error: "Geolocation not supported", loading: false }));
      return;
    }

    const attemptGeolocation = (highAccuracy: boolean) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setState({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            error: null,
            loading: false,
          });
        },
        (err) => {
          // If high accuracy times out, retry with lower accuracy
          if (err.code === 3 && highAccuracy) {
            console.warn("High accuracy geolocation timeout, retrying with lower accuracy...");
            attemptGeolocation(false);
          } else {
            console.error("Geolocation error:", err);
            setState((s) => ({
              ...s,
              error: err.message,
              loading: false,
            }));
          }
        },
        { 
          enableHighAccuracy: highAccuracy, 
          timeout: 20000,
          maximumAge: 0
        }
      );
    };

    attemptGeolocation(true);
  }, []);

  return state;
}
