import { useState, useCallback, useEffect } from "react";
import { AuthCredentials, encodeBasicAuth } from "@/lib/auth-stateless";

/**
 * Hook for managing stateless Basic Auth credentials
 * Stores credentials in memory (no sessionStorage/localStorage)
 */
export function useBasicAuth() {
  const [credentials, setCredentials] = useState<AuthCredentials | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Authenticate with username and password
   */
  const authenticate = useCallback(
    async (username: string, password: string) => {
      setLoading(true);
      setError(null);

      try {
        // Verify credentials by making a test request
        const authHeader = encodeBasicAuth(username, password);

        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/auth-middleware`,
          {
            method: "POST",
            headers: {
              Authorization: authHeader,
              "Content-Type": "application/json",
            },
          }
        );

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Authentication failed");
        }

        const data = await response.json();

        // Store credentials in memory
        setCredentials({ username, password });
        setIsAuthenticated(true);

        return data;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Authentication failed";
        setError(message);
        setIsAuthenticated(false);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  /**
   * Clear credentials (logout)
   */
  const logout = useCallback(() => {
    setCredentials(null);
    setIsAuthenticated(false);
    setError(null);
  }, []);

  /**
   * Get Authorization header for requests
   */
  const getAuthHeader = useCallback(() => {
    if (!credentials) {
      return null;
    }
    return encodeBasicAuth(credentials.username, credentials.password);
  }, [credentials]);

  /**
   * Make authenticated fetch request
   */
  const authenticatedFetch = useCallback(
    (url: string, options: RequestInit = {}) => {
      const authHeader = getAuthHeader();

      if (!authHeader) {
        throw new Error("Not authenticated");
      }

      const headers = {
        ...options.headers,
        Authorization: authHeader,
      };

      return fetch(url, { ...options, headers });
    },
    [getAuthHeader]
  );

  return {
    credentials,
    isAuthenticated,
    loading,
    error,
    authenticate,
    logout,
    getAuthHeader,
    authenticatedFetch,
  };
}
