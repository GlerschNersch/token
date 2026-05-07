import { useState } from "react";
import { Link } from "wouter";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Sidebar, type Filter } from "@/components/Sidebar";
import { Wordmark } from "@/components/Logo";
import { Menu } from "lucide-react";

interface Props {
  active: Filter;
}

export function MobileTopBar({ active }: Props) {
  const [open, setOpen] = useState(false);

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
          <SheetTitle className="sr-only">Cabinet Bridge navigation</SheetTitle>
          <div className="h-full flex">
            <SidebarMobileWrapper active={active} onNavigate={() => setOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>
      <Link href="/" className="flex items-center" data-testid="link-home-mobile">
        <Wordmark />
      </Link>
      <div className="size-9" />
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
