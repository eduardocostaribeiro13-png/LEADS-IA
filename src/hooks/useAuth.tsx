import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  user: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    let authEventReceived = false;
    let currentUserId: string | null = null;
    const applySession = (nextSession: Session | null) => {
      if (!active) return;
      const nextUserId = nextSession?.user.id ?? null;
      if (nextUserId !== currentUserId) queryClient.clear();
      currentUserId = nextUserId;
      setSession(nextSession);
      setLoading(false);
    };
    const { data: subscription } = supabase.auth.onAuthStateChange((event, nextSession) => {
      authEventReceived = true;
      if (event === "PASSWORD_RECOVERY") {
        const url = new URL(window.location.href);
        url.searchParams.set("recovery", "1");
        window.history.replaceState(window.history.state, "", url);
      }
      applySession(nextSession);
      if (event === "SIGNED_OUT") {
        queryClient.clear();
        void navigate({ to: "/auth", replace: true });
      }
    });

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!authEventReceived) applySession(data.session);
      })
      .catch((error) => console.error("Falha ao ler sessão", error))
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [queryClient, navigate]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      signOut: async () => {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        queryClient.clear();
        setSession(null);
        await navigate({ to: "/auth", replace: true });
      },
    }),
    [session, loading, queryClient, navigate],
  );

  return (
    <AuthContext.Provider value={value}>
      <AuthSession key={session?.user.id ?? "anonymous"}>{children}</AuthSession>
    </AuthContext.Provider>
  );
}

// Remount observers and local drafts when accounts change, after clearing queries.
function AuthSession({ children }: { children: ReactNode }) {
  return children;
}

export function useAuth() {
  return useContext(AuthContext);
}
