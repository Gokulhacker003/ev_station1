import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader } from "@/components/Loader";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  guestOrUser?: boolean; // public pages that admins should be redirected away from
}

export function ProtectedRoute({ children, requireAdmin = false, guestOrUser = false }: ProtectedRouteProps) {
  const { user, isAdmin, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader />
      </div>
    );
  }

  // Public/user pages: redirect admins to their dashboard
  if (guestOrUser && isAdmin) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  if (!user && !guestOrUser) {
    return <Navigate to={requireAdmin ? "/admin/login" : "/login"} replace />;
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  // Regular user routes: block admins
  if (!requireAdmin && !guestOrUser && isAdmin) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return <>{children}</>;
}
