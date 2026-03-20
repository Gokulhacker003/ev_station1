import { useState, useEffect, useRef, useCallback } from "react";

interface GeoState {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  error: string | null;
  loading: boolean;
  isSecureContext: boolean;
  permission: PermissionState | "unknown";
}

export function useGeolocation() {
  const [state, setState] = useState<GeoState>({
    latitude: null,
    longitude: null,
    accuracy: null,
    error: null,
    loading: true,
    isSecureContext: typeof window !== "undefined" ? window.isSecureContext : true,
    permission: "unknown",
  });
  const watchIdRef = useRef<number | null>(null);
  const loadingTimeoutRef = useRef<number | null>(null);
  const fallbackAttemptedRef = useRef(false);
  const hasPositionRef = useRef(false);

  const clearLoadingTimeout = useCallback(() => {
    if (loadingTimeoutRef.current !== null) {
      window.clearTimeout(loadingTimeoutRef.current);
      loadingTimeoutRef.current = null;
    }
  }, []);

  const beginLoadingTimeout = useCallback(() => {
    clearLoadingTimeout();
    // Some browsers keep geolocation pending for a long time; fail fast for better UX.
    loadingTimeoutRef.current = window.setTimeout(() => {
      setState((s) => {
        if (!s.loading || s.latitude !== null || s.longitude !== null) {
          return s;
        }
        return {
          ...s,
          loading: false,
          error:
            "Could not get your current location yet. Please enable GPS/location services and tap Retry Location.",
        };
      });
    }, 15000);
  }, [clearLoadingTimeout]);

  const applyPosition = useCallback((pos: GeolocationPosition) => {
    clearLoadingTimeout();
    fallbackAttemptedRef.current = false;
    hasPositionRef.current = true;
    setState((s) => ({
      ...s,
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
      error: null,
      loading: false,
    }));
  }, [clearLoadingTimeout]);

  const requestBalancedLocation = useCallback(() => {
    beginLoadingTimeout();
    navigator.geolocation.getCurrentPosition(applyPosition, (err) => {
      clearLoadingTimeout();
      const permissionDenied = err.code === err.PERMISSION_DENIED;
      const positionUnavailable = err.code === err.POSITION_UNAVAILABLE;

      let message = "Unable to get location.";
      if (permissionDenied) {
        message = "Location access denied. Enable location permission in your browser settings.";
      } else if (positionUnavailable) {
        message = "Location signal unavailable. Move near open sky and try again.";
      } else {
        message = "Location request timed out. Turn on GPS/location services and tap Retry Location.";
      }

      setState((s) => ({
        ...s,
        error: message,
        loading: false,
        permission: permissionDenied ? "denied" : s.permission,
      }));
    }, {
      enableHighAccuracy: false,
      timeout: 20000,
      maximumAge: 60000,
    });
  }, [applyPosition, beginLoadingTimeout, clearLoadingTimeout]);

  const handleGeoError = useCallback((err: GeolocationPositionError) => {
    clearLoadingTimeout();
    const permissionDenied = err.code === err.PERMISSION_DENIED;
    const timedOut = err.code === err.TIMEOUT;
    const positionUnavailable = err.code === err.POSITION_UNAVAILABLE;

    // If a position already exists, don't surface background watch timeout noise.
    if (timedOut && hasPositionRef.current) {
      setState((s) => ({ ...s, loading: false }));
      return;
    }

    if (timedOut && !fallbackAttemptedRef.current) {
      fallbackAttemptedRef.current = true;
      requestBalancedLocation();
      return;
    }

    const message = permissionDenied
      ? "Location access denied. Enable location permission in your browser settings."
      : positionUnavailable
        ? "Location signal unavailable. Move near open sky and try again."
        : timedOut
          ? "Location request timed out. Turn on GPS/location services and tap Retry Location."
          : err.message || "Unable to get location.";
    setState((s) => ({
      ...s,
      error: message,
      loading: false,
      permission: permissionDenied ? "denied" : s.permission,
    }));
  }, [clearLoadingTimeout, requestBalancedLocation]);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setState((s) => ({ ...s, error: "Geolocation not supported", loading: false }));
      return;
    }

    if (!window.isSecureContext) {
      setState((s) => ({
        ...s,
        loading: false,
        isSecureContext: false,
        error: "Location on mobile requires HTTPS. Open this site using https:// (or localhost).",
      }));
      return;
    }

    setState((s) => ({ ...s, loading: true, error: null }));
    fallbackAttemptedRef.current = false;
    hasPositionRef.current = false;
    beginLoadingTimeout();
    navigator.geolocation.getCurrentPosition(applyPosition, handleGeoError, {
      enableHighAccuracy: true,
      timeout: 12000,
      maximumAge: 0,
    });
  }, [applyPosition, beginLoadingTimeout, handleGeoError]);

  useEffect(() => {
    if (!navigator.geolocation) {
      setState((s) => ({ ...s, error: "Geolocation not supported", loading: false }));
      return;
    }

    if (!window.isSecureContext) {
      setState((s) => ({
        ...s,
        loading: false,
        isSecureContext: false,
        error: "Location on mobile requires HTTPS. Open this site using https:// (or localhost).",
      }));
      return;
    }

    if (navigator.permissions?.query) {
      navigator.permissions
        .query({ name: "geolocation" })
        .then((result) => {
          setState((s) => ({ ...s, permission: result.state }));
          result.onchange = () => {
            setState((s) => ({ ...s, permission: result.state }));
          };
        })
        .catch(() => {
          // Some browsers do not fully support geolocation permission querying.
        });
    }

    requestLocation();
    // Keep watching for better/fresher position updates.
    watchIdRef.current = navigator.geolocation.watchPosition(
      applyPosition,
      handleGeoError,
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );

    return () => {
      clearLoadingTimeout();
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [applyPosition, beginLoadingTimeout, clearLoadingTimeout, handleGeoError, requestLocation]);

  return {
    ...state,
    requestLocation,
  };
}
