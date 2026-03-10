import { Link, useLocation } from "react-router-dom";
import { Home, Map, List, CalendarCheck, User, Settings } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const links = [
  { to: "/", label: "Home", icon: Home },
  { to: "/map", label: "Map", icon: Map },
  { to: "/stations", label: "Stations", icon: List },
  { to: "/bookings", label: "Bookings", icon: CalendarCheck, auth: true },
  { to: "/settings", label: "Settings", icon: Settings, auth: true },
  { to: "/login", label: "Login", icon: User, guestOnly: true },
];

export function BottomNav() {
  const location = useLocation();
  const { user } = useAuth();

  const filtered = links.filter((l) => {
    if (l.auth && !user) return false;
    if (l.guestOnly && user) return false;
    return true;
  });

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden glass border-t border-border safe-bottom">
      <div className="flex items-center justify-around h-16">
        {filtered.map((link) => {
          const Icon = link.icon;
          const active = location.pathname === link.to;
          return (
            <Link
              key={link.to}
              to={link.to}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                active ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <Icon className={`h-5 w-5 ${active ? "text-primary" : ""}`} />
              {link.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
