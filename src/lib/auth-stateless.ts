/**
 * Stateless Authorization Library
 * Basic Auth + Role-Based Access Control (RBAC)
 * No sessions, no JWT, no cookies
 */

export type AppRole = "USER" | "ADMIN";

export interface AuthCredentials {
  username: string;
  password: string;
}

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  role: AppRole;
}

/**
 * Encode credentials for Basic Auth header
 * Format: "Basic base64(username:password)"
 */
export function encodeBasicAuth(username: string, password: string): string {
  const credentials = `${username}:${password}`;
  const encoded = btoa(credentials);
  return `Basic ${encoded}`;
}

/**
 * Decode Basic Auth header
 * Returns { username, password } or null if invalid
 */
export function decodeBasicAuth(authHeader: string): AuthCredentials | null {
  if (!authHeader.startsWith("Basic ")) {
    return null;
  }

  try {
    const encoded = authHeader.slice(6);
    const decoded = atob(encoded);
    const [username, ...passwordParts] = decoded.split(":");
    const password = passwordParts.join(":");

    if (!username || !password) {
      return null;
    }

    return { username, password };
  } catch (error) {
    console.error("Failed to decode Basic Auth header:", error);
    return null;
  }
}

/**
 * Check if a request path matches an authorization rule
 */
export interface AuthRule {
  pattern: string | RegExp;
  roles: AppRole[];
  requiresAuth: boolean;
}

/**
 * Default authorization rules
 * Strict: no role hierarchy (ADMIN !== USER)
 */
export const DEFAULT_AUTH_RULES: AuthRule[] = [
  // Public endpoints - no authentication required
  {
    pattern: /^\/public\//,
    roles: [],
    requiresAuth: false,
  },
  // User endpoints - ONLY USER role
  {
    pattern: /^\/user\//,
    roles: ["USER"],
    requiresAuth: true,
  },
  // Admin endpoints - ONLY ADMIN role
  {
    pattern: /^\/admin\//,
    roles: ["ADMIN"],
    requiresAuth: true,
  },
];

/**
 * Check if a path is authorized for a specific role
 * @param path - Request path
 * @param role - User role (or null if not authenticated)
 * @param rules - Authorization rules
 * @returns { authorized: boolean, requiresAuth: boolean }
 */
export function checkPathAuthorization(
  path: string,
  role: AppRole | null,
  rules: AuthRule[] = DEFAULT_AUTH_RULES
): { authorized: boolean; requiresAuth: boolean } {
  for (const rule of rules) {
    const matches =
      typeof rule.pattern === "string"
        ? path.startsWith(rule.pattern)
        : rule.pattern.test(path);

    if (matches) {
      // Path matches this rule
      if (!rule.requiresAuth) {
        // Public endpoint
        return { authorized: true, requiresAuth: false };
      }

      // Requires authentication
      if (!role) {
        return { authorized: false, requiresAuth: true };
      }

      // Check if role is in allowed roles
      const authorized = rule.roles.includes(role);
      return { authorized, requiresAuth: true };
    }
  }

  // No rule matched - default to requiring authentication
  return { authorized: false, requiresAuth: true };
}

/**
 * Create an auth interceptor for fetch requests
 * Adds Basic Auth header automatically
 */
export function createAuthInterceptor(credentials: AuthCredentials | null) {
  return {
    /**
     * Add Basic Auth header to request
     */
    addHeader: (headers: Record<string, string> = {}): Record<string, string> => {
      if (credentials) {
        const authHeader = encodeBasicAuth(credentials.username, credentials.password);
        return {
          ...headers,
          Authorization: authHeader,
        };
      }
      return headers;
    },

    /**
     * Enhanced fetch with automatic Basic Auth
     */
    fetch: async (url: string, options: RequestInit = {}) => {
      const headers = {
        ...options.headers,
        ...createAuthInterceptor(credentials).addHeader(),
      };

      return fetch(url, { ...options, headers });
    },
  };
}

/**
 * Create an axios interceptor config
 */
export function createAxiosAuthConfig(credentials: AuthCredentials | null) {
  return {
    headers: credentials
      ? {
          Authorization: encodeBasicAuth(credentials.username, credentials.password),
        }
      : {},
  };
}
