# Stateless Authorization System (Basic Auth + RBAC)

## Overview

This is a **stateless, session-less authorization system** that uses **Basic Authentication** headers and **Role-Based Access Control (RBAC)**. 

**Key Features:**
- ✅ No sessions, no JWT, no cookies
- ✅ Credentials sent with every request via `Authorization` header
- ✅ Strict role-based access control (no role hierarchy)
- ✅ Two roles: `USER` and `ADMIN` (mutually exclusive)
- ✅ Path-based authorization rules
- ✅ In-memory credential storage (no persistence)

---

## How It Works

### 1. Authentication (Stateless)

Every HTTP request includes credentials in the `Authorization` header:

```http
Authorization: Basic base64(username:password)
```

**Example:**
```javascript
// Username: "testuser", Password: "user123"
Authorization: Basic dGVzdHVzZXI6dXNlcjEyMw==
```

### 2. Authorization Rules

Requests are validated based on their **path pattern** and the user's **role**:

| Pattern | Roles | Auth Required | Example |
|---------|-------|---------------|---------|
| `/public/*` | `[]` | ❌ No | `/public/health`, `/public/stations` |
| `/user/*` | `['USER']` | ✅ Yes | `/user/bookings`, `/user/profile` |
| `/admin/*` | `['ADMIN']` | ✅ Yes | `/admin/users`, `/admin/stations` |

**Strict RBAC:** `ADMIN` role **cannot** access `/user/*` endpoints!

### 3. Role Definitions

```typescript
type AppRole = "USER" | "ADMIN";
```

- **USER**: Regular users can only access `/user/*` endpoints
- **ADMIN**: Administrators can only access `/admin/*` endpoints
- **No hierarchy**: Roles are mutually exclusive and separate

---

## Implementation

### Core Files

1. **`src/lib/auth-stateless.ts`** - Core authentication utilities
   - `encodeBasicAuth()` - Encode credentials to Basic Auth header
   - `decodeBasicAuth()` - Decode Basic Auth header
   - `checkPathAuthorization()` - Validate path + role combination
   
2. **`src/hooks/useBasicAuth.ts`** - React hook for managing credentials
   - Store credentials in memory (not localStorage/sessionStorage)
   - `authenticate()` - Login with username/password
   - `logout()` - Clear credentials
   - `authenticatedFetch()` - Make authenticated requests

3. **`src/lib/api-client.ts`** - API client implementations
   - `createAuthenticatedAxiosClient()` - Axios with auto-auth
   - `AuthenticatedFetchClient` - Fetch wrapper with auto-auth

4. **`supabase/functions/auth-middleware/`** - Backend validation
   - Validates credentials against database
   - Checks authorization rules
   - Returns 401/403 for failures

5. **`src/lib/api-endpoints.ts`** - Example API endpoints
   - `/public/*` endpoints
   - `/user/*` endpoints (USER role only)
   - `/admin/*` endpoints (ADMIN role only)

---

## Usage Examples

### 1. React Component with Basic Auth

```typescript
import { useBasicAuth } from "@/hooks/useBasicAuth";
import { getUserBookings } from "@/lib/api-endpoints";

function BookingsPage() {
  const { authenticate, logout, credentials, isAuthenticated, error } = useBasicAuth();
  const [bookings, setBookings] = useState([]);

  // Login
  const handleLogin = async (username: string, password: string) => {
    await authenticate(username, password);
  };

  // Fetch bookings (requires credentials)
  const loadBookings = async () => {
    if (!credentials) {
      alert("Please login first");
      return;
    }
    
    try {
      const data = await getUserBookings(credentials);
      setBookings(data);
    } catch (error) {
      if (error instanceof Error && error.message.includes("Forbidden")) {
        alert("You don't have permission to view bookings. ADMIN role required.");
      }
    }
  };

  return (
    <div>
      {!isAuthenticated ? (
        <form onSubmit={(e) => {
          e.preventDefault();
          const username = (e.target as any).username.value;
          const password = (e.target as any).password.value;
          handleLogin(username, password);
        }}>
          <input name="username" placeholder="Username" required />
          <input name="password" type="password" placeholder="Password" required />
          <button type="submit">Login</button>
        </form>
      ) : (
        <div>
          <p>Logged in as: {credentials.username}</p>
          <button onClick={loadBookings}>Load My Bookings</button>
          <button onClick={logout}>Logout</button>
          <ul>
            {bookings.map(b => <li key={b.id}>{b.station_name}</li>)}
          </ul>
        </div>
      )}
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  );
}
```

### 2. Admin Only Feature

```typescript
import { useBasicAuth } from "@/hooks/useBasicAuth";
import { getAdminUsers, isPermissionError } from "@/lib/api-endpoints";

function AdminPanel() {
  const { credentials } = useBasicAuth();
  const [users, setUsers] = useState([]);
  const [error, setError] = useState<string | null>(null);

  const loadUsers = async () => {
    if (!credentials) return;
    
    try {
      const data = await getAdminUsers(credentials);
      setUsers(data);
      setError(null);
    } catch (err) {
      if (isPermissionError(err)) {
        setError("❌ You must be an ADMIN to view users");
      } else {
        setError((err as Error).message);
      }
    }
  };

  return (
    <div>
      <button onClick={loadUsers}>Load Users</button>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <ul>
        {users.map(u => <li key={u.id}>{u.username}</li>)}
      </ul>
    </div>
  );
}
```

### 3. Using Authenticated Fetch Client

```typescript
import { AuthenticatedFetchClient } from "@/lib/api-client";
import { useBasicAuth } from "@/hooks/useBasicAuth";

function MyComponent() {
  const { credentials } = useBasicAuth();

  const fetchData = async () => {
    const client = new AuthenticatedFetchClient(credentials);
    
    try {
      // GET request
      const response = await client.get("/user/bookings");
      console.log("Bookings:", response.data);
      
      // POST request
      const newBooking = await client.post("/user/bookings", {
        station_id: "123",
        booking_date: "2026-03-25",
        time_slot: "10:00-11:00"
      });
      console.log("Created:", newBooking.data);
    } catch (error) {
      console.error("API Error:", error);
    }
  };

  return <button onClick={fetchData}>Fetch Data</button>;
}
```

---

## HTTP Examples

### Public Endpoint (No Auth)

```bash
GET /public/stations HTTP/1.1
Host: api.example.com

# Response: 200 OK
```

### User Endpoint (USER Role)

```bash
GET /user/bookings HTTP/1.1
Authorization: Basic dGVzdHVzZXI6dXNlcjEyMw==
Host: api.example.com

# Response: 200 OK
```

### User Endpoint (ADMIN Role) - FORBIDDEN

```bash
GET /user/bookings HTTP/1.1
Authorization: Basic YWRtaW46YWRtaW4xMjM=
Host: api.example.com

# Response: 403 Forbidden
# "ADMIN role cannot access /user/* endpoints"
```

### Admin Endpoint (ADMIN Role)

```bash
GET /admin/users HTTP/1.1
Authorization: Basic YWRtaW46YWRtaW4xMjM=
Host: api.example.com

# Response: 200 OK
```

### Admin Endpoint (USER Role) - FORBIDDEN

```bash
GET /admin/users HTTP/1.1
Authorization: Basic dGVzdHVzZXI6dXNlcjEyMw==
Host: api.example.com

# Response: 403 Forbidden
# "USER role cannot access /admin/* endpoints"
```

---

## Database Schema

### Tables

**`user_credentials`**
- Stores username + bcrypt-hashed passwords
- No plaintext passwords ever
- One per user

**`user_roles`**
- Stores role assignments: `USER` or `ADMIN`
- Strict: one role per user (no multiple roles)
- No hierarchy

```sql
-- Example queries
SELECT u.username, r.role 
FROM user_credentials u
JOIN user_roles r ON u.user_id = r.user_id
WHERE u.username = 'testuser';

-- Returns: testuser | USER
```

---

## Security Considerations

### ✅ Good

- Credentials never stored in localStorage/sessionStorage
- Passwords are bcrypt hashed in database
- HTTPS required for production
- Credentials in memory only

### ⚠️ Important

- **Always use HTTPS** in production
- **Never log credentials** to console
- **Sign out** between user sessions
- **Set a timeout** for credential validity
- Consider adding **rate limiting** to prevent brute force
- **Never trust client-side role validation** - always validate on server

### ❌ Do NOT

- Store plaintext passwords
- Store credentials in localStorage
- Use Basic Auth over HTTP (man-in-the-middle attacks)
- Allow role escalation (USER becoming ADMIN)
- Cache passwords in browser memory long-term

---

## Testing

### Test User Accounts

| Username | Password | Role |
|----------|----------|------|
| `testuser` | `user123` | `USER` |
| `admin` | `admin123` | `ADMIN` |

Tests must verify:

1. **Public endpoints work** without auth
2. **USER role can't access /admin/** → 403
3. **ADMIN role can't access /user/** → 403
4. **Wrong password** → 401 Unauthorized
5. **Missing credentials** → 401 Unauthorized

```typescript
// Example test
test("ADMIN cannot access USER endpoints", async () => {
  const credentials = { username: "admin", password: "admin123" };
  
  expect(() => getUserBookings(credentials))
    .rejects
    .toThrow("Forbidden");
});
```

---

## Migration from JWT/Sessions

If migrating from JWT or session-based auth:

1. **Keep existing auth.ts** temporarily for compatibility
2. **Add new Basic Auth endpoints** alongside old ones
3. **Gradually migrate features** to use Basic Auth
4. **Remove JWT/sessions** after migration complete

---

## File Structure

```
src/
├── lib/
│   ├── auth-stateless.ts       # Core auth utilities
│   ├── api-client.ts           # API clients (axios + fetch)
│   └── api-endpoints.ts        # Example API endpoints
├── hooks/
│   └── useBasicAuth.ts         # React hook
├── contexts/
│   └── AuthContext.tsx         # (Legacy - consider removing)
└── pages/
    └── Login.tsx               # Update to use useBasicAuth

supabase/
├── functions/
│   └── auth-middleware/        # Backend validation
│       └── index.ts
└── migrations/
    └── 20260322_stateless_auth_schema.sql
```

---

## Summary

| Feature | Details |
|---------|---------|
| **Auth Type** | Basic Auth (username + password) |
| **Header Format** | `Authorization: Basic base64(user:pass)` |
| **Storage** | Memory only (cleared on logout) |
| **Sessions** | None - stateless |
| **Roles** | USER, ADMIN (strict, exclusive) |
| **Authorization** | Path-based + role matching |
| **Hierarchy** | None - roles are independent |
