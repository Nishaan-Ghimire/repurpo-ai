import { createFileRoute, Link, Outlet, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Sparkles, Upload, Mic, FileText, User, LogOut, LayoutDashboard, Menu, Calendar, Flame, Beaker } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { PremiumLoader } from "@/components/premium-loader";

export const Route = createFileRoute("/_authenticated")({
  component: AuthLayout,
});

const NAV = [
  { to: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { to: "/upload", label: "Upload Content", icon: Upload },
  { to: "/voice", label: "Brand Voice", icon: Mic },
  { to: "/content", label: "Generated Content", icon: FileText },
  { to: "/moments", label: "Viral Moments", icon: Flame },
  { to: "/calendar", label: "Calendar", icon: Calendar },
  { to: "/account", label: "Account", icon: User },
] as const;

function AuthLayout() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  // close mobile sidebar on route change
  useEffect(() => { setOpen(false); }, [location.pathname]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <PremiumLoader label="Loading workspace" />
      </div>
    );
  }

  const SidebarBody = (
    <>
      <Link to="/dashboard" className="flex h-16 items-center gap-2 border-b border-sidebar-border px-6 font-display font-bold">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-primary text-primary-foreground shadow-glow">
          <Sparkles className="h-4 w-4" />
        </span>
        Repurpo
      </Link>
      <nav className="flex-1 space-y-1 p-3">
        {NAV.map(({ to, label, icon: Icon }) => {
          const active = location.pathname === to;
          return (
            <Link
              key={to}
              to={to}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground ring-1 ring-primary/30 shadow-glow"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-sidebar-border p-3">
        <div className="mb-2 truncate px-3 text-xs text-muted-foreground">{user.email}</div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start"
          onClick={async () => {
            await signOut();
            navigate({ to: "/" });
          }}
        >
          <LogOut className="mr-2 h-4 w-4" /> Sign out
        </Button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen w-full">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar/60 backdrop-blur md:flex">
        {SidebarBody}
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-border/60 bg-background/60 px-4 backdrop-blur md:px-6">
          <div className="flex items-center gap-2">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="md:hidden">
                  <Menu className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="flex w-72 flex-col p-0 bg-sidebar">
                {SidebarBody}
              </SheetContent>
            </Sheet>
            <span className="font-display text-sm font-semibold md:hidden">Repurpo</span>
          </div>
          <ThemeSwitcher />
        </header>

        <main className="flex-1 overflow-x-hidden">
          <div className="mx-auto max-w-5xl px-4 py-6 md:px-6 md:py-10">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
