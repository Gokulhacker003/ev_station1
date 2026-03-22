/**
 * Example API Endpoint Implementations
 * Shows how to protect endpoints with stateless auth + role-based access control
 * 
 * Pattern:
 * - /public/* → No auth required
 * - /user/* → Only USER role
 * - /admin/* → Only ADMIN role
 */

import { AuthenticatedFetchClient } from "@/lib/api-client";
import { AuthCredentials } from "@/lib/auth-stateless";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

/**
 * Create an authenticated API client
 */
function createClient(credentials: AuthCredentials | null) {
  return new AuthenticatedFetchClient(credentials, API_BASE_URL);
}

/**
 * ========================================
 * PUBLIC ENDPOINTS (No auth required)
 * ========================================
 */

/**
 * GET /public/stations - List all available stations
 */
export async function getPublicStations() {
  const response = await fetch(`${API_BASE_URL}/public/stations`);
  if (!response.ok) throw new Error("Failed to fetch stations");
  return response.json();
}

/**
 * GET /public/health - Health check
 */
export async function healthCheck() {
  const response = await fetch(`${API_BASE_URL}/public/health`);
  if (!response.ok) throw new Error("Health check failed");
  return response.json();
}

/**
 * ========================================
 * USER ENDPOINTS (USER role only)
 * ========================================
 */

/**
 * GET /user/bookings - Get user's bookings
 * Only USER role can access
 */
export async function getUserBookings(credentials: AuthCredentials) {
  const client = createClient(credentials);
  try {
    const response = await client.get(`/user/bookings`);
    return response.data;
  } catch (error) {
    console.error("Failed to fetch user bookings:", error);
    throw error;
  }
}

/**
 * POST /user/bookings - Create a booking
 * Only USER role can access
 */
export async function createBooking(
  credentials: AuthCredentials,
  bookingData: {
    station_id: string;
    booking_date: string;
    time_slot: string;
  }
) {
  const client = createClient(credentials);
  try {
    const response = await client.post(`/user/bookings`, bookingData);
    return response.data;
  } catch (error) {
    console.error("Failed to create booking:", error);
    throw error;
  }
}

/**
 * PATCH /user/bookings/:id - Update user's booking
 * Only USER role can access
 */
export async function updateBooking(
  credentials: AuthCredentials,
  bookingId: string,
  updateData: Partial<{
    booking_date: string;
    time_slot: string;
    status: string;
  }>
) {
  const client = createClient(credentials);
  try {
    const response = await client.put(`/user/bookings/${bookingId}`, updateData);
    return response.data;
  } catch (error) {
    console.error("Failed to update booking:", error);
    throw error;
  }
}

/**
 * DELETE /user/bookings/:id - Cancel user's booking
 * Only USER role can access
 */
export async function cancelBooking(credentials: AuthCredentials, bookingId: string) {
  const client = createClient(credentials);
  try {
    const response = await client.delete(`/user/bookings/${bookingId}`);
    return response.data;
  } catch (error) {
    console.error("Failed to cancel booking:", error);
    throw error;
  }
}

/**
 * ========================================
 * ADMIN ENDPOINTS (ADMIN role only)
 * ========================================
 */

/**
 * GET /admin/users - List all users
 * Only ADMIN role can access
 */
export async function getAdminUsers(credentials: AuthCredentials) {
  const client = createClient(credentials);
  try {
    const response = await client.get(`/admin/users`);
    return response.data;
  } catch (error) {
    console.error("Failed to fetch users:", error);
    throw error;
  }
}

/**
 * POST /admin/stations - Create a new station
 * Only ADMIN role can access
 */
export async function createStation(
  credentials: AuthCredentials,
  stationData: {
    name: string;
    latitude: number;
    longitude: number;
    charger_type: string;
    available_slots: number;
  }
) {
  const client = createClient(credentials);
  try {
    const response = await client.post(`/admin/stations`, stationData);
    return response.data;
  } catch (error) {
    console.error("Failed to create station:", error);
    throw error;
  }
}

/**
 * GET /admin/bookings - List all bookings (admin view)
 * Only ADMIN role can access
 */
export async function getAdminBookings(credentials: AuthCredentials) {
  const client = createClient(credentials);
  try {
    const response = await client.get(`/admin/bookings`);
    return response.data;
  } catch (error) {
    console.error("Failed to fetch admin bookings:", error);
    throw error;
  }
}

/**
 * PATCH /admin/bookings/:id - Update booking status
 * Only ADMIN role can access
 */
export async function updateBookingStatus(
  credentials: AuthCredentials,
  bookingId: string,
  status: "confirmed" | "cancelled" | "completed"
) {
  const client = createClient(credentials);
  try {
    const response = await client.put(`/admin/bookings/${bookingId}`, { status });
    return response.data;
  } catch (error) {
    console.error("Failed to update booking status:", error);
    throw error;
  }
}

/**
 * DELETE /admin/stations/:id - Delete a station
 * Only ADMIN role can access
 */
export async function deleteStation(credentials: AuthCredentials, stationId: string) {
  const client = createClient(credentials);
  try {
    const response = await client.delete(`/admin/stations/${stationId}`);
    return response.data;
  } catch (error) {
    console.error("Failed to delete station:", error);
    throw error;
  }
}

/**
 * ========================================
 * AUTHORIZATION ERROR HANDLING
 * ========================================
 */

/**
 * Helper to identify authorization errors
 */
export function isAuthError(error: unknown): boolean {
  if (error instanceof Error) {
    return (
      error.message.includes("Unauthorized") ||
      error.message.includes("Forbidden") ||
      error.message.includes("Invalid credentials")
    );
  }
  return false;
}

/**
 * Helper to identify permission errors
 */
export function isPermissionError(error: unknown): boolean {
  if (error instanceof Error) {
    return (
      error.message.includes("Forbidden") ||
      error.message.includes("role") ||
      error.message.includes("permission")
    );
  }
  return false;
}
