import { useState, useEffect, useRef } from "react";

interface GeoState {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  error: string | null;
  loading: boolean;
}

export function useGeolocation() {
  const [state, setState] = useState<GeoState>({
    latitude: null,
    longitude: null,
    accuracy: null,
    error: null,
    loading: true,
  });
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      setState((s) => ({ ...s, error: "Geolocation not supported", loading: false }));
      return;
    }

    // First: get a quick initial fix using cached position (up to 60 s old)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setState({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          error: null,
          loading: false,
        });
      },
      () => {
        // quick fix failed — watchPosition below will still try
        setState((s) => ({ ...s, loading: false }));
      },
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 },
    );

    // Then: watch for accurate live position updates
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setState({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          error: null,
          loading: false,
        });
      },
      (err) => {
        console.error("Geolocation watch error:", err);
        setState((s) => ({
          ...s,
          error: err.message,
          loading: false,
        }));
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  return state;
}
