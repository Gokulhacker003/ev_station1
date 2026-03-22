import { Link, useLocation } from "react-router-dom";
import { Home, Map, List, CalendarCheck, User, Settings, LayoutDashboard } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const userLinks = [
  { to: "/", label: "Home", icon: Home },
  { to: "/map", label: "Map", icon: Map },
  { to: "/stations", label: "Stations", icon: List },
  { to: "/bookings", label: "Bookings", icon: CalendarCheck, auth: true },
  { to: "/settings", label: "Settings", icon: Settings, auth: true },
  { to: "/login", label: "Login", icon: User, guestOnly: true },
];

const adminLinks = [
  { to: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
];

export function BottomNav() {
  const location = useLocation();
  const { user, isAdmin } = useAuth();

  if (isAdmin) {
    return (
      <nav className="fixed bottom-0 left-0 right-0 z-[700] border-t border-slate-200 bg-white/95 shadow-[0_-6px_20px_rgba(15,23,42,0.12)] backdrop-blur-md md:hidden safe-bottom">
        <div className="flex h-16 items-center justify-around px-2">
          {adminLinks.map((link) => {
            const Icon = link.icon;
            const active = location.pathname.startsWith("/admin");
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`flex min-w-[72px] flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 text-xs font-medium transition ${
                  active ? "bg-emerald-50 text-[#16a34a]" : "text-slate-500"
                }`}
              >
                <Icon className={`h-5 w-5 ${active ? "text-[#16a34a]" : ""}`} />
                {link.label}
              </Link>
            );
          })}
        </div>
      </nav>
    );
  }

  const filtered = userLinks.filter((l) => {
    if (l.auth && !user) return false;
    if (l.guestOnly && user) return false;
    return true;
  });

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-[700] border-t border-slate-200 bg-white/95 shadow-[0_-6px_20px_rgba(15,23,42,0.12)] backdrop-blur-md md:hidden safe-bottom">
      <div className="flex h-16 items-center justify-around px-2">
        {filtered.map((link) => {
          const Icon = link.icon;
          const active = location.pathname === link.to;
          return (
            <Link
              key={link.to}
              to={link.to}
              className={`flex min-w-[68px] flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 text-xs font-medium transition ${
                active ? "bg-emerald-50 text-[#16a34a]" : "text-slate-500"
              }`}
            >
              <Icon className={`h-5 w-5 ${active ? "text-[#16a34a]" : ""}`} />
              {link.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
