import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  Bell,
  Crosshair,
  FileText,
  Gauge,
  KanbanSquare,
  LogOut,
  Menu,
  MessageSquare,
  Radar,
  Search,
  Settings as SettingsIcon,
  Users,
  Wallet,
} from "lucide-react";
import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/dashboard", label: "Command Center", icon: Gauge },
  { to: "/hunter", label: "Lead Hunter", icon: Radar },
  { to: "/attack", label: "Attack Queue", icon: Crosshair },
  { to: "/leads", label: "Leads", icon: Users },
  { to: "/crm", label: "Pipeline", icon: KanbanSquare },
  { to: "/outreach", label: "Abordagens", icon: MessageSquare },
  { to: "/proposals", label: "Propostas", icon: FileText },
  { to: "/finance", label: "Financeiro", icon: Wallet },
  { to: "/intelligence", label: "Inteligência", icon: BarChart3 },
  { to: "/settings", label: "Configurações", icon: SettingsIcon },
] as const;

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  return (
    <nav className="flex flex-col gap-1">
      {NAV.map((item) => {
        const active = pathname === item.to || pathname.startsWith(`${item.to}/`);
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={cn(
              "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
              active
                ? "bg-soft text-foreground"
                : "text-muted-foreground hover:bg-soft/60 hover:text-foreground",
            )}
          >
            <item.icon
              className={cn("size-4 shrink-0", active ? "text-ice" : "text-muted-foreground")}
              aria-hidden="true"
            />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5 px-1">
      <span className="grid size-9 place-items-center rounded-xl border border-edge bg-panel">
        <Crosshair className="size-4 text-ice" aria-hidden="true" />
      </span>
      <span className="leading-tight">
        <span className="block text-sm font-semibold tracking-tight text-foreground">
          LEAD HUNTER AI
        </span>
        <span className="label-mono block text-muted-foreground">prospecção inteligente</span>
      </span>
    </div>
  );
}

export interface AppShellProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function AppShell({ title, description, actions, children }: AppShellProps) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [term, setTerm] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    navigate({ to: "/leads", search: { q: term || undefined } });
  }

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col justify-between border-r border-edge bg-panel px-4 py-5 lg:flex">
        <div className="flex flex-col gap-7">
          <Brand />
          <NavList />
        </div>
        <div className="border-t border-edge pt-4">
          <p className="truncate px-1 text-xs text-muted-foreground">{user?.email}</p>
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 w-full justify-start gap-2 text-muted-foreground"
            onClick={() => signOut()}
          >
            <LogOut className="size-4" aria-hidden="true" />
            Sair
          </Button>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-edge bg-background/85 backdrop-blur">
          <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Abrir menu">
                  <Menu className="size-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 border-edge bg-panel px-4 py-5">
                <div className="flex flex-col gap-7">
                  <Brand />
                  <NavList onNavigate={() => setMobileOpen(false)} />
                </div>
              </SheetContent>
            </Sheet>

            <form onSubmit={submitSearch} className="relative hidden flex-1 max-w-sm md:block">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                placeholder="Buscar empresa, cidade, segmento, telefone…"
                className="h-9 border-edge bg-card pl-9 text-sm"
                aria-label="Busca global"
              />
            </form>

            <div className="ml-auto flex items-center gap-2">
              <Button variant="ghost" size="icon" aria-label="Notificações" asChild>
                <Link to="/dashboard">
                  <Bell className="size-4" />
                </Link>
              </Button>
              <Button asChild size="sm" className="gap-2">
                <Link to="/hunter">
                  <Radar className="size-4" aria-hidden="true" />
                  Caçar leads
                </Link>
              </Button>
            </div>
          </div>
        </header>

        <main className="px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-[1400px]">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
                {description && (
                  <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
                )}
              </div>
              {actions}
            </div>
            <div className="mt-6">{children}</div>
          </div>
        </main>
      </div>
    </div>
  );
}
