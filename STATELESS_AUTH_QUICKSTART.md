# Stateless Auth System - Quick Start Guide

## 🚀 Implementation Checklist

### Step 1: Database Setup
- [ ] Run migration: `supabase/migrations/20260322_stateless_auth_schema.sql`
- [ ] Create test users with credentials in `user_credentials` table
- [ ] Assign roles in `user_roles` table

```sql
-- Test setup
INSERT INTO user_credentials (user_id, username, password_hash)
VALUES ('user-uuid', 'testuser', 'bcrypt-hash-here');

INSERT INTO user_roles (user_id, role)
VALUES ('user-uuid', 'USER');
```

### Step 2: Environment Variables
Add to `.env`:
```env
VITE_API_URL=http://localhost:3000
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_key
```

### Step 3: Update AuthContext.tsx
```typescript
// OLD: Remove session-based logic
// NEW: Replace with useBasicAuth hook

import { useBasicAuth } from "@/hooks/useBasicAuth";

export function useAuth() {
  // Migrate to basic auth internally if needed
  // OR keep both systems temporarily
  const basicAuth = useBasicAuth();
  return basicAuth;
}
```

### Step 4: Update Login Component
```typescript
import { useBasicAuth } from "@/hooks/useBasicAuth";
import { useNavigate } from "react-router-dom";

export function Login() {
  const { authenticate, error, loading } = useBasicAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget as HTMLFormElement);
    const username = form.get("username") as string;
    const password = form.get("password") as string;

    const result = await authenticate(username, password);
    if (result) {
      navigate("/dashboard");
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input name="username" placeholder="Username" required />
      <input name="password" type="password" placeholder="Password" required />
      <button disabled={loading}>{loading ? "Logging in..." : "Login"}</button>
      {error && <p style={{ color: "red" }}>{error}</p>}
    </form>
  );
}
```

### Step 5: Protect Routes
```typescript
import { Navigate } from "react-router-dom";
import { useBasicAuth } from "@/hooks/useBasicAuth";

export function ProtectedUserRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, credentials } = useBasicAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Optional: Check role
  // if (userRole !== "USER") {
  //   return <Navigate to="/unauthorized" replace />;
  // }

  return children;
}

export function ProtectedAdminRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useBasicAuth();
  
  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace />;
  }

  return children;
}
```

### Step 6: Update API Calls
```typescript
// Before:
const { data } = await supabase.from("bookings").select();

// After:
import { getUserBookings } from "@/lib/api-endpoints";
import { useBasicAuth } from "@/hooks/useBasicAuth";

function BookingsPage() {
  const { credentials } = useBasicAuth();
  const [bookings, setBookings] = useState([]);

  useEffect(() => {
    if (credentials) {
      getUserBookings(credentials)
        .then(setBookings)
        .catch(err => console.error("Failed:", err));
    }
  }, [credentials]);

  return <div>{/* render bookings */}</div>;
}
```

### Step 7: Error Handling
```typescript
import { isAuthError, isPermissionError } from "@/lib/api-endpoints";

async function fetchData() {
  try {
    const data = await getAdminUsers(credentials);
  } catch (error) {
    if (isAuthError(error)) {
      // Handle invalid credentials (401)
      alert("Invalid credentials. Please login again.");
      logout();
    } else if (isPermissionError(error)) {
      // Handle insufficient permissions (403)
      alert("You don't have permission to access this resource.");
    } else {
      alert("Network error");
    }
  }
}
```

---

## 📋 Migration Path

### Phase 1: Parallel Deployment
1. Keep existing JWT/session auth working
2. Add new Basic Auth alongside it
3. Test both systems
4. Migrate features one-by-one

### Phase 2: Feature Migration
1. Login pages → useBasicAuth
2. User bookings → /user/* endpoints
3. Admin dashboard → /admin/* endpoints
4. Settings pages → /user/* endpoints

### Phase 3: Cleanup
1. Remove JWT middleware
2. Remove session storage
3. Remove old AuthContext
4. Update all imports

---

## 🧪 Testing

### Run Test Suite
```typescript
// In browser console:
import { runAllTests } from "@/lib/auth-tests";
await runAllTests();
```

### Manual Tests

#### Test 1: Public Endpoints (No Auth)
```bash
curl http://localhost:3000/public/health
# Should return 200 OK (no auth required)
```

#### Test 2: USER Route (USER Role)
```bash
curl -H "Authorization: Basic dGVzdHVzZXI6dXNlcjEyMw==" \
  http://localhost:3000/user/bookings
# Should return 200 OK
```

#### Test 3: USER Route (ADMIN Role) - Should Fail
```bash
curl -H "Authorization: Basic YWRtaW46YWRtaW4xMjM=" \
  http://localhost:3000/user/bookings
# Should return 403 Forbidden
```

#### Test 4: ADMIN Route (ADMIN Role)
```bash
curl -H "Authorization: Basic YWRtaW46YWRtaW4xMjM=" \
  http://localhost:3000/admin/users
# Should return 200 OK
```

#### Test 5: ADMIN Route (USER Role) - Should Fail
```bash
curl -H "Authorization: Basic dGVzdHVzZXI6dXNlcjEyMw==" \
  http://localhost:3000/admin/users
# Should return 403 Forbidden
```

---

## 📁 File Organization

```
src/
├── lib/
│   ├── auth-stateless.ts        # ← Core utilities
│   ├── api-client.ts            # ← API clients
│   ├── api-endpoints.ts         # ← Example endpoints
│   └── auth-tests.ts            # ← Test suite
├── hooks/
│   ├── useBasicAuth.ts          # ← Main hook
│   └── useGeolocation.ts        # Keep existing
├── contexts/
│   └── AuthContext.tsx          # ← Update or replace
└── pages/
    ├── Login.tsx                # ← Update
    └── AdminLogin.tsx           # ← Update

supabase/
├── functions/
│   └── auth-middleware/
│       └── index.ts             # ← Backend validation
└── migrations/
    └── 20260322_stateless_auth_schema.sql

docs/
├── STATELESS_AUTH_README.md     # ← Full documentation
└── .gitignore                   # Add sensitive files
```

---

## 🔐 Important Reminders

1. **HTTPS Only** - Never use Basic Auth over HTTP
2. **Password Hashing** - Always bcrypt, never plaintext
3. **No localStorage** - Credentials stored in memory only
4. **Tab Isolation** - Each tab has independent credentials
5. **Role Enforcement** - Validate on server, never client
6. **No Hierarchy** - ADMIN ≠ USER, enforce strictly

---

## 💡 Tips & Tricks

### Debugging Auth Issues
```typescript
// Check if user is authenticated
const { isAuthenticated, credentials } = useBasicAuth();
console.log("Auth:", isAuthenticated, credentials?.username);

// Check authorization for a path
import { checkPathAuthorization } from "@/lib/auth-stateless";
const allowed = checkPathAuthorization("/admin/users", "USER");
console.log("Allowed:", allowed.authorized);
```

### Using with React Query
```typescript
import { useQuery } from "@tanstack/react-query";
import { getUserBookings } from "@/lib/api-endpoints";
import { useBasicAuth } from "@/hooks/useBasicAuth";

export function useUserBookings() {
  const { credentials, isAuthenticated } = useBasicAuth();

  return useQuery({
    queryKey: ["bookings", credentials?.username],
    queryFn: () => getUserBookings(credentials!),
    enabled: isAuthenticated,
  });
}
```

### Custom Authorization Hook
```typescript
import { useBasicAuth } from "@/hooks/useBasicAuth";
import { checkPathAuthorization } from "@/lib/auth-stateless";

export function useAuthorized(path: string) {
  const { credentials } = useBasicAuth();
  // Get user role from somewhere...
  const role = /* fetch role */;
  
  return checkPathAuthorization(path, role).authorized;
}
```

---

## 📚 Next Steps

1. ✅ Review `STATELESS_AUTH_README.md` for full documentation
2. ✅ Run tests: `import { runAllTests } from "@/lib/auth-tests"`
3. ✅ Update login component to use `useBasicAuth`
4. ✅ Replace API calls with `/user/*` and `/admin/*` endpoints
5. ✅ Test authorization matrix in QA environment
6. ✅ Deploy with gradual rollout

---

## 🆘 Troubleshooting

### Issue: "Unauthorized" error on every request
**Solution:** Check if credentials are being sent in header:
```typescript
const { getAuthHeader } = useBasicAuth();
console.log("Auth header:", getAuthHeader()); // Should be "Basic ..."
```

### Issue: "Forbidden" error for ADMIN trying to access USER endpoint
**Solution:** This is correct! ADMIN cannot access `/user/*` routes (strict RBAC)

### Issue: Credentials lost on page refresh
**Solution:** This is expected! Memory storage doesn't persist across page reloads. Add prompt to re-login or accept as security feature.

### Issue: "Invalid Basic Auth header format"
**Solution:** Ensure credentials are encoded as Base64:
```typescript
const encoded = encodeBasicAuth("username", "password");
// Should be: "Basic dXNlcm5hbWU6cGFzc3dvcmQ="
```

---

**Questions?** Check `STATELESS_AUTH_README.md` for detailed documentation.
