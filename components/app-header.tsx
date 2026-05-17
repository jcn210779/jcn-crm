"use client";

import { BarChart3, CalendarCheck2, ChevronDown, HardHat, KanbanSquare, LogOut, Plus, Users, Wrench } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type AppHeaderProps = {
  userEmail: string;
  showNewLead?: boolean;
  title?: string;
};

export function AppHeader({
  userEmail,
  showNewLead = true,
  title = "Pipeline",
}: AppHeaderProps) {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 md:px-6">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/brand/jcn-symbol-gold.png"
            alt="JCN Construction"
            width={36}
            height={31}
            priority
            className="h-9 w-auto"
          />
          <div className="hidden flex-col leading-none sm:flex">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-jcn-gold/70">
              JCN Construction
            </span>
            <span className="mt-0.5 text-sm font-bold tracking-tight text-jcn-ice">
              {title}
            </span>
          </div>
        </Link>

        <nav className="flex items-center gap-1">
          <NavLink href="/" active={pathname === "/"} icon={KanbanSquare}>
            Pipeline
          </NavLink>
          <NavLink
            href="/jobs"
            active={
              (pathname?.startsWith("/jobs") ?? false) ||
              (pathname?.startsWith("/job/") ?? false)
            }
            icon={HardHat}
          >
            Jobs
          </NavLink>
          <NavLink
            href="/tasks"
            active={pathname?.startsWith("/tasks") ?? false}
            icon={CalendarCheck2}
          >
            Tasks
          </NavLink>
          <NavLink
            href="/team"
            active={pathname?.startsWith("/team") ?? false}
            icon={Users}
          >
            Team
          </NavLink>
          <NavLink
            href="/subcontractors"
            active={pathname?.startsWith("/subcontractors") ?? false}
            icon={Wrench}
          >
            Subs
          </NavLink>
          <NavLink
            href="/dashboard"
            active={pathname?.startsWith("/dashboard") ?? false}
            icon={BarChart3}
          >
            Dashboard
          </NavLink>
        </nav>

        <div className="flex items-center gap-2">
          {showNewLead && (
            <Button asChild size="sm" className="hidden font-semibold md:inline-flex">
              <Link href="/lead/novo">
                <Plus className="h-4 w-4" />
                Novo lead
              </Link>
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-white/75 transition hover:bg-white/[0.07]">
                <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]" />
                <span className="hidden max-w-[150px] truncate sm:inline">
                  {userEmail || "Conectado"}
                </span>
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="text-xs font-semibold text-white/55">
                {userEmail}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <form action="/auth/signout" method="post" className="w-full">
                  <button
                    type="submit"
                    className="flex w-full items-center gap-2 text-sm"
                  >
                    <LogOut className="h-4 w-4" />
                    Sair
                  </button>
                </form>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}

type NavLinkProps = {
  href: string;
  active: boolean;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
};

function NavLink({ href, active, icon: Icon, children }: NavLinkProps) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] transition",
        active
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-white/[0.06] bg-white/[0.02] text-white/55 hover:text-white",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">{children}</span>
    </Link>
  );
}
