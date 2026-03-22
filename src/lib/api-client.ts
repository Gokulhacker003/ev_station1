/**
 * API Client with Stateless Basic Auth
 * Automatically includes Authorization header in all requests
 */

import axios, { AxiosInstance, AxiosError, AxiosResponse, AxiosRequestConfig, InternalAxiosRequestConfig } from "axios";
import { AuthCredentials, encodeBasicAuth } from "@/lib/auth-stateless";

/**
 * Create axios instance with Basic Auth interceptor
 */
export function createAuthenticatedAxiosClient(
  credentials: AuthCredentials | null
): AxiosInstance {
  const client = axios.create();

  // Request interceptor: Add Basic Auth header
  client.interceptors.request.use((config) => {
    if (credentials) {
      const authHeader = encodeBasicAuth(credentials.username, credentials.password);
      config.headers.Authorization = authHeader;
    }
    return config;
  });

  // Response interceptor: Handle 401/403
  client.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
      if (error.response?.status === 401) {
        console.error("Unauthorized: Invalid credentials");
      } else if (error.response?.status === 403) {
        console.error("Forbidden: Insufficient permissions for this role");
      }
      return Promise.reject(error);
    }
  );

  return client;
}

/**
 * Enhanced fetch with Basic Auth support
 */
export class AuthenticatedFetchClient {
  private credentials: AuthCredentials | null;
  private baseURL?: string;

  constructor(credentials: AuthCredentials | null, baseURL?: string) {
    this.credentials = credentials;
    this.baseURL = baseURL;
  }

  /**
   * Make authenticated request
   */
  private async request<T>(
    url: string,
    options: RequestInit = {}
  ): Promise<AxiosResponse<T>> {
    const fullURL = this.baseURL ? `${this.baseURL}${url}` : url;

    const headers: Record<string, string> = {
      ...Object.fromEntries(
        Object.entries(options.headers || {}).map(([k, v]) => [k, String(v)])
      ),
    };

    if (this.credentials) {
      const authHeader = encodeBasicAuth(
        this.credentials.username,
        this.credentials.password
      );
      headers.Authorization = authHeader;
    }

    try {
      const response = await fetch(fullURL, { ...options, headers });

      // Handle error status codes
      if (!response.ok) {
        const contentType = response.headers.get("content-type");
        let data;

        if (contentType?.includes("application/json")) {
          data = await response.json();
        } else {
          data = await response.text();
        }

        if (response.status === 401) {
          throw new Error("Unauthorized: Invalid credentials");
        } else if (response.status === 403) {
          throw new Error(
            "Forbidden: Your role does not have permission to access this resource"
          );
        }

        throw new Error(
          typeof data === "object" ? data.error || response.statusText : data
        );
      }

      const responseBody = await response.json();

      return {
        data: responseBody,
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers),
        config: {
          headers: Object.fromEntries(response.headers),
        } as InternalAxiosRequestConfig<unknown>,
      } as AxiosResponse<T>;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("Network error");
    }
  }

  /**
   * GET request
   */
  async get<T>(url: string): Promise<AxiosResponse<T>> {
    return this.request<T>(url, { method: "GET" });
  }

  /**
   * POST request
   */
  async post<T>(url: string, data?: unknown): Promise<AxiosResponse<T>> {
    return this.request<T>(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  /**
   * PUT request
   */
  async put<T>(url: string, data?: unknown): Promise<AxiosResponse<T>> {
    return this.request<T>(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  /**
   * DELETE request
   */
  async delete<T>(url: string): Promise<AxiosResponse<T>> {
    return this.request<T>(url, { method: "DELETE" });
  }
}
