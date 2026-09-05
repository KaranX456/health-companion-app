import type { ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Activity,
  HeartPulse,
  Home,
  Camera,
  Lightbulb,
  Smile,
  Users,
  Stethoscope,
  ClipboardList,
  FileHeart,
  LogOut,
  Menu,
} from "lucide-react";
import { useAuth, useSignOut } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export const NAV = [
  { to: "/", label: "Dashboard", icon: Home },
  { to: "/symptoms", label: "Symptoms", icon: Activity },
  { to: "/medications", label: "Medications", icon: HeartPulse },
  { to: "/triage", label: "Photo Triage", icon: Camera },
  { to: "/guidance", label: "Guidance", icon: Lightbulb },
  { to: "/wellbeing", label: "Wellbeing", icon: Smile },
  { to: "/community", label: "Community", icon: Users },
  { to: "/care-team", label: "Care Team", icon: Stethoscope },
  { to: "/prep", label: "Appointment Prep", icon: ClipboardList },
  { to: "/profile", label: "Medical Profile", icon: FileHeart },
] as const;

const DESKTOP_GROUPS: { label: string; items: (typeof NAV)[number][] }[] = [
  { label: "Overview", items: [NAV[0]] },
  { label: "Health Tracking", items: [NAV[1], NAV[2], NAV[3], NAV[5]] },
  { label: "Care & Support", items: [NAV[4], NAV[6], NAV[7], NAV[8], NAV[9]] },
];

const MOBILE_PRIMARY = [NAV[0], NAV[1], NAV[2], NAV[4]];
const MOBILE_MORE = [NAV[3], NAV[5], NAV[6], NAV[7], NAV[8], NAV[9]];

export function AppLayout({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const signOut = useSignOut();
  const [moreOpen, setMoreOpen] = useState(false);
  const currentPath = useRouterState({
    select: (router) => router.location.pathname,
  });

  useEffect(() => {
    if (false && !loading && !user) navigate({ to: "/auth", replace: true }); // TEMP preview bypass
  }, [loading, user, navigate]);

  if (false && (loading || !user)) { // TEMP preview bypass
    return (
      <div className="min-h-screen space-y-4 p-8">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const isActive = (to: string) => (to === "/" ? currentPath === "/" : currentPath.startsWith(to));
  const moreActive = MOBILE_MORE.some((item) => isActive(item.to));

  return (
    <div className="min-h-screen bg-background">
      <aside className="no-print fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar p-4 lg:flex">
        <div className="mb-6 flex items-center gap-2 px-2">
          <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <HeartPulse className="size-5" />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold text-sidebar-foreground">AI Health</p>
            <p className="text-xs text-muted-foreground">Companion</p>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto">
          {DESKTOP_GROUPS.map((group, i) => (
            <div key={group.label} className={i > 0 ? "mt-6" : ""}>
              <p className="px-3 pb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {group.label}
              </p>
              <div className="space-y-1">
                {group.items.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    activeOptions={{ exact: item.to === "/" }}
                    activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground" }}
                    className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
                  >
                    <item.icon className="size-4" />
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>
        <Button variant="ghost" className="mt-4 justify-start gap-2" onClick={() => void signOut()}>
          <LogOut className="size-4" /> Sign out
        </Button>
      </aside>

      <div className="lg:pl-64">
        <header className="no-print sticky top-0 z-20 flex items-center justify-between border-b border-border bg-background/85 px-4 py-4 backdrop-blur lg:px-8">
          <div>
            <h1 className="font-display text-2xl font-medium tracking-tight">{title}</h1>
            {description ? (
              <p className="text-sm text-muted-foreground">{description}</p>
            ) : null}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            aria-label="Sign out"
            onClick={() => void signOut()}
          >
            <LogOut className="size-4" />
          </Button>
        </header>
        <main className="px-4 pb-28 pt-6 lg:px-8 lg:pb-12">{children}</main>
      </div>

      <nav className="no-print fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-background/95 backdrop-blur lg:hidden">
        {MOBILE_PRIMARY.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            activeOptions={{ exact: item.to === "/" }}
            activeProps={{ className: "text-primary" }}
            className="flex flex-1 flex-col items-center gap-1 px-2 py-2 text-[10px] text-muted-foreground"
          >
            <item.icon className="size-4" />
            <span className="whitespace-nowrap">{item.label}</span>
          </Link>
        ))}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          aria-label="More"
          className={`flex flex-1 flex-col items-center gap-1 px-2 py-2 text-[10px] ${
            moreActive ? "text-primary" : "text-muted-foreground"
          }`}
        >
          <Menu className="size-4" />
          <span className="whitespace-nowrap">More</span>
        </button>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>More</SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-2 gap-3 px-4 pb-8">
            {MOBILE_MORE.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setMoreOpen(false)}
                className={`flex flex-col items-center gap-2 rounded-2xl border border-border px-4 py-4 text-sm font-medium transition-colors hover:bg-muted ${
                  isActive(item.to) ? "text-primary" : "text-foreground"
                }`}
              >
                <item.icon className="size-5" />
                {item.label}
              </Link>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
