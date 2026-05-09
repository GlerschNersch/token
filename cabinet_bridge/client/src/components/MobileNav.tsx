import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Sidebar, type Filter } from "@/components/Sidebar";
import { Wordmark } from "@/components/Logo";
import { Menu, LayoutDashboard, Gamepad2, Trophy, Settings, History } from "lucide-react";

interface Props {
  active?: Filter;
}

export function MobileTopBar({ active }: Props) {
  const [open, setOpen] = useState(false);
  const [location] = useLocation();
  const onSettingsRoute = location.startsWith("/settings");

  return (
    <div
      className="lg:hidden flex items-center justify-between px-4 h-14 border-b border-border bg-sidebar/80 backdrop-blur-md sticky top-0 z-30"
      data-testid="bar-mobile-top"
    >
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <button
            type="button"
            className="size-9 rounded-md border border-border flex items-center justify-center hover-elevate"
            data-testid="button-open-nav"
            aria-label="Open navigation"
          >
            <Menu className="size-4" />
          </button>
        </SheetTrigger>
        <SheetContent side="left" className="p-0 w-72 bg-sidebar text-sidebar-foreground border-sidebar-border">
          <SheetTitle className="sr-only">HomeArcade navigation</SheetTitle>
          <div className="h-full flex">
            <SidebarMobileWrapper active={active ?? "all"} onNavigate={() => setOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>

      <Link href="/" className="flex items-center" data-testid="link-home-mobile">
        <Wordmark />
      </Link>

      {/* Settings shortcut — highlighted when on settings route */}
      <Link
        href="/settings"
        className={`size-9 rounded-md border border-border flex items-center justify-center hover-elevate transition-colors ${
          onSettingsRoute
            ? "border-primary/60 bg-primary/15 text-primary"
            : "text-muted-foreground hover:text-foreground"
        }`}
        aria-label="Integration & Settings"
        data-testid="link-settings-topbar"
      >
        <Settings className="size-4" />
      </Link>
    </div>
  );
}

function SidebarMobileWrapper({
  active,
  onNavigate,
}: {
  active: Filter;
  onNavigate: () => void;
}) {
  return (
    <div className="flex flex-col w-full h-full">
      <Sidebar active={active} alwaysVisible onNavigate={onNavigate} />
    </div>
  );
}

/**
 * Fixed bottom tab bar — visible only below lg breakpoint.
 * Place once in App.tsx; pages add `pb-20 lg:pb-0` to their scroll containers.
 */
export function MobileBottomNav() {
  const [location] = useLocation();

  const tabs = [
    { href: "/", icon: LayoutDashboard, label: "Home" },
    { href: "/library", icon: Gamepad2, label: "Library" },
    { href: "/history", icon: History, label: "History" },
    { href: "/achievements", icon: Trophy, label: "Awards" },
    { href: "/settings", icon: Settings, label: "Settings" },
  ] as const;

  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-sidebar/95 backdrop-blur-md"
      data-testid="nav-mobile-bottom"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex h-16 items-stretch">
        {tabs.map(({ href, icon: Icon, label }) => {
          const active =
            href === "/"
              ? location === "/"
              : location === href ||
                location.startsWith(href + "/") ||
                location.startsWith(href + "?");
          return (
            <Link
              key={href}
              href={href}
              className={`flex-1 flex flex-col items-center justify-center gap-1 transition-colors ${
                active ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
              data-testid={`nav-bottom-${label.toLowerCase()}`}
              aria-current={active ? "page" : undefined}
            >
              <Icon
                className={`transition-transform ${active ? "size-[22px] scale-110" : "size-5"}`}
              />
              <span className="font-mono text-[9px] uppercase tracking-wider">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
