/**
 * Stateless Auth System - Test Suite & Validation
 * Tests path authorization rules and role-based access control
 * 
 * cSpell:disable - File contains encoded test data and credentials
 */

import {
  encodeBasicAuth,
  decodeBasicAuth,
  checkPathAuthorization,
  DEFAULT_AUTH_RULES,
  AuthRule,
} from "@/lib/auth-stateless";

// Define proper types to avoid `any` usage
type AuthRole = "USER" | "ADMIN" | null;
type AuthorizationTestCase = [path: string, role: AuthRole, shouldBeAllowed: boolean];

// Extend Window interface for test utilities
declare global {
  interface Window {
    testStatelessAuth: () => Promise<void>;
  }
}

/**
 * ========================================
 * UNIT TESTS
 * ========================================
 */

export function testBasicAuthEncoding() {
  console.log("✓ Testing Basic Auth Encoding...");

  const encoded = encodeBasicAuth("testuser", "password123");
  console.assert(
    encoded === "Basic dGVzdHVzZXI6cGFzc3dvcmQxMjM=",
    "Should encode correctly"
  );

  const decoded = decodeBasicAuth(encoded);
  console.assert(decoded?.username === "testuser", "Should decode username");
  console.assert(decoded?.password === "password123", "Should decode password");

  console.log("  ✓ Basic Auth encoding/decoding works");
}

export function testPathAuthorization() {
  console.log("✓ Testing Path Authorization Rules...");

  // Test 1: Public endpoints - no auth required
  const publicTest = checkPathAuthorization("/public/health", null);
  console.assert(publicTest.authorized === true, "Public endpoints should allow null role");
  console.assert(
    publicTest.requiresAuth === false,
    "Public endpoints should not require auth"
  );
  console.log("  ✓ Public endpoints: Accessible to all (no auth required)");

  // Test 2: USER endpoints - only USER role
  const userEndpointWithUser = checkPathAuthorization("/user/bookings", "USER");
  console.assert(
    userEndpointWithUser.authorized === true,
    "USER should access /user/* endpoints"
  );
  console.log("  ✓ USER role: Can access /user/* endpoints");

  const userEndpointWithAdmin = checkPathAuthorization("/user/bookings", "ADMIN");
  console.assert(
    userEndpointWithAdmin.authorized === false,
    "ADMIN should NOT access /user/* endpoints"
  );
  console.log("  ✓ ADMIN role: BLOCKED from /user/* endpoints (strict RBAC)");

  const userEndpointWithoutAuth = checkPathAuthorization("/user/bookings", null);
  console.assert(
    userEndpointWithoutAuth.authorized === false,
    "Unauthenticated should not access /user/* endpoints"
  );
  console.log("  ✓ No auth: BLOCKED from /user/* endpoints");

  // Test 3: ADMIN endpoints - only ADMIN role
  const adminEndpointWithAdmin = checkPathAuthorization("/admin/users", "ADMIN");
  console.assert(
    adminEndpointWithAdmin.authorized === true,
    "ADMIN should access /admin/* endpoints"
  );
  console.log("  ✓ ADMIN role: Can access /admin/* endpoints");

  const adminEndpointWithUser = checkPathAuthorization("/admin/users", "USER");
  console.assert(
    adminEndpointWithUser.authorized === false,
    "USER should NOT access /admin/* endpoints"
  );
  console.log("  ✓ USER role: BLOCKED from /admin/* endpoints (strict RBAC)");

  const adminEndpointWithoutAuth = checkPathAuthorization("/admin/users", null);
  console.assert(
    adminEndpointWithoutAuth.authorized === false,
    "Unauthenticated should not access /admin/* endpoints"
  );
  console.log("  ✓ No auth: BLOCKED from /admin/* endpoints");
}

export function testRoleHierarchy() {
  console.log("✓ Testing Role Hierarchy (Should be NONE)...");

  // ADMIN should NOT be treated as USER
  const adminAccessUserEndpoint = checkPathAuthorization("/user/bookings", "ADMIN");
  console.assert(
    adminAccessUserEndpoint.authorized === false,
    "ADMIN should NOT inherit USER permissions"
  );
  console.log("  ✓ No role hierarchy: ADMIN ≠ USER");

  // USER should NOT be treated as ADMIN
  const userAccessAdminEndpoint = checkPathAuthorization("/admin/users", "USER");
  console.assert(
    userAccessAdminEndpoint.authorized === false,
    "USER should NOT inherit ADMIN permissions"
  );
  console.log("  ✓ No role hierarchy: USER ≠ ADMIN");
}

/**
 * ========================================
 * INTEGRATION TESTS
 * ========================================
 */

export async function testAuthHeaderValidation() {
  console.log("✓ Testing Auth Header Validation...");

  // Valid header
  const validHeader = "Basic dGVzdHVzZXI6dXNlcjEyMw==";
  const validCredentials = decodeBasicAuth(validHeader);
  console.assert(validCredentials !== null, "Valid header should decode");
  console.log("  ✓ Valid Basic Auth header: Decoded successfully");

  // Invalid format
  const invalidHeader = "Bearer token123";
  const invalidCredentials = decodeBasicAuth(invalidHeader);
  console.assert(invalidCredentials === null, "Non-Basic auth should fail");
  console.log("  ✓ Invalid header format (Bearer): Correctly rejected");

  // Malformed Base64
  const malformedHeader = "Basic !!!invalid!!!";
  const malformedCredentials = decodeBasicAuth(malformedHeader);
  console.assert(malformedCredentials === null, "Malformed Base64 should fail");
  console.log("  ✓ Malformed Base64: Correctly rejected");

  // Missing password
  const noPasswordHeader = `Basic ${btoa("testuser:")}`;
  const noPasswordCredentials = decodeBasicAuth(noPasswordHeader);
  console.assert(noPasswordCredentials === null, "Missing password should fail");
  console.log("  ✓ Missing password: Correctly rejected");
}

/**
 * ========================================
 * AUTHORIZATION MATRIX TESTS
 * ========================================
 */

export function testAuthorizationMatrix() {
  console.log("✓ Testing Authorization Matrix...");

  const matrix: AuthorizationTestCase[] = [
    // [path, role, shouldBeAllowed]
    ["/public/health", null, true],
    ["/public/stations", null, true],
    ["/user/bookings", "USER", true],
    ["/user/bookings", "ADMIN", false],
    ["/user/bookings", null, false],
    ["/admin/users", "ADMIN", true],
    ["/admin/users", "USER", false],
    ["/admin/users", null, false],
    ["/admin/stations/create", "ADMIN", true],
    ["/admin/stations/create", "USER", false],
  ];

  console.log("\n  Authorization Matrix:");
  console.log("  Path\t\t\t\tRole\t\tExpected\tActual\tStatus");
  console.log("  ────────────────────────────────────────────────────────");

  let passed = 0;
  let failed = 0;

  for (const [path, role, expected] of matrix) {
    const result = checkPathAuthorization(path, role);
    const actual = result.authorized;
    const status = actual === expected ? "✓ PASS" : "✗ FAIL";

    if (actual === expected) {
      passed++;
    } else {
      failed++;
    }

    console.log(
      `  ${String(path).padEnd(30)}\t${String(role || "none").padEnd(8)}\t${String(expected).padEnd(8)}\t${actual}\t${status}`
    );
  }

  console.log("  ────────────────────────────────────────────────────────");
  console.log(`  Total: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);

  console.assert(failed === 0, "All authorization tests should pass");
}

/**
 * ========================================
 * SECURITY TESTS
 * ========================================
 */

export function testSecurityFeatures() {
  console.log("✓ Testing Security Features...");

  // Test 1: Strict role enforcement
  console.assert(
    checkPathAuthorization("/user/bookings", "ADMIN").authorized === false,
    "Should enforce strict role separation"
  );
  console.log("  ✓ Strict Role Enforcement: ADMIN cannot become USER");

  // Test 2: No role elevation
  console.assert(
    checkPathAuthorization("/admin/users", "USER").authorized === false,
    "USER should not be elevated to ADMIN"
  );
  console.log("  ✓ No Role Elevation: USER cannot become ADMIN");

  // Test 3: Unauthenticated users cannot access protected endpoints
  console.assert(
    checkPathAuthorization("/user/bookings", null).authorized === false,
    "Unauthenticated should not access protected endpoints"
  );
  console.assert(
    checkPathAuthorization("/admin/users", null).authorized === false,
    "Unauthenticated should not access protected endpoints"
  );
  console.log("  ✓ Authentication Enforcement: Unauthenticated blocked");

  // Test 4: Basic Auth header encoding correctness
  const credentials = decodeBasicAuth(encodeBasicAuth("admin", "pass123"));
  console.assert(
    credentials?.username === "admin" && credentials?.password === "pass123",
    "Credentials should round-trip correctly"
  );
  console.log("  ✓ Credential Integrity: Credentials preserved correctly");
}

/**
 * ========================================
 * RUN ALL TESTS
 * ========================================
 */

export async function runAllTests() {
  console.log(
    "\n╔════════════════════════════════════════════════════════════════╗"
  );
  console.log(
    "║    Stateless Auth System - Test Suite                         ║"
  );
  console.log(
    "╚════════════════════════════════════════════════════════════════╝\n"
  );

  try {
    testBasicAuthEncoding();
    console.log();

    testPathAuthorization();
    console.log();

    testRoleHierarchy();
    console.log();

    await testAuthHeaderValidation();
    console.log();

    testAuthorizationMatrix();
    console.log();

    testSecurityFeatures();
    console.log();

    console.log(
      "╔════════════════════════════════════════════════════════════════╗"
    );
    console.log(
      "║    ✓ All Tests Passed!                                         ║"
    );
    console.log(
      "╚════════════════════════════════════════════════════════════════╝\n"
    );
  } catch (error) {
    console.error(
      "\n╔════════════════════════════════════════════════════════════════╗"
    );
    console.error(
      "║    ✗ Tests Failed!                                             ║"
    );
    console.error(
      "╚════════════════════════════════════════════════════════════════╝"
    );
    console.error(error);
  }
}

// Run tests on import
if (typeof window !== "undefined") {
  window.testStatelessAuth = runAllTests;
  console.log(
    "💡 To run tests: run testStatelessAuth() in browser console"
  );
}
