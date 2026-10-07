import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Crosshair, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { safeAuthPath } from "@/lib/auth-redirect";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Entrar | Lead Hunter AI" },
      {
        name: "description",
        content:
          "Acesse o Lead Hunter AI e encontre empresas com alta probabilidade de comprar seus serviços digitais.",
      },
      { property: "og:title", content: "Entrar | Lead Hunter AI" },
      {
        property: "og:description",
        content: "Prospecção inteligente: encontre, analise, qualifique e feche mais clientes.",
      },
    ],
  }),
  component: AuthPage,
});

/** Retorna um caminho relativo seguro (mesma origem) vindo de ?next=, ou null. */
function safeNext(): string | null {
  if (typeof window === "undefined") return null;
  const raw = new URLSearchParams(window.location.search).get("next");
  return safeAuthPath(raw, window.location.origin);
}

function isRecoveryLocation() {
  if (typeof window === "undefined") return false;
  const query = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.slice(1));
  return (
    query.get("recovery") === "1" ||
    query.get("type") === "recovery" ||
    hash.get("type") === "recovery"
  );
}

function NewPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (password.length < 6 || password !== confirmation) {
      toast.error("Informe uma senha com pelo menos 6 caracteres e confirme a mesma senha.");
      return;
    }
    setBusy(true);
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!sessionData.session)
        throw new Error("Link inválido ou expirado. Solicite um novo link de recuperação.");
      const { data, error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      if (!data.user) throw new Error("Não foi possível atualizar a senha.");
      toast.success("Senha atualizada.");
      window.location.replace("/dashboard");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível atualizar a senha.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-4">
      <div className="space-y-2">
        <Label htmlFor="new-password">Nova senha</Label>
        <Input
          id="new-password"
          type="password"
          autoComplete="new-password"
          required
          minLength={6}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="border-edge bg-card"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm-password">Confirmar nova senha</Label>
        <Input
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          required
          minLength={6}
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          className="border-edge bg-card"
        />
      </div>
      <Button type="submit" className="w-full gap-2" disabled={busy}>
        {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
        Salvar nova senha
      </Button>
      <a href="/auth" className="block text-center text-xs text-muted-foreground">
        Voltar para entrar
      </a>
    </form>
  );
}

function goAfterLogin(navigate: ReturnType<typeof useNavigate>) {
  const next = safeNext();
  if (next) window.location.href = next;
  else navigate({ to: "/dashboard" });
}

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const [recovery, setRecovery] = useState(isRecoveryLocation);

  useEffect(() => {
    let active = true;
    let recovering = isRecoveryLocation();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        recovering = true;
        setRecovery(true);
      }
    });
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!active) return;
        recovering ||= isRecoveryLocation();
        if (recovering) setRecovery(true);
        else if (!error && data.session) goAfterLogin(navigate);
      })
      .catch(() => toast.error("Não foi possível verificar sua sessão."));
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [navigate]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}${safeNext() ?? "/dashboard"}`,
            data: { full_name: fullName },
          },
        });
        if (error) throw error;
        toast.success("Conta criada! Confirme pelo link enviado ao seu e-mail antes de entrar.");
        setMode("login");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        goAfterLogin(navigate);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível continuar.";
      const friendly = message.includes("Invalid login credentials")
        ? "E-mail ou senha incorretos."
        : message.includes("Email not confirmed")
          ? "Confirme seu e-mail pelo link que enviamos antes de entrar."
          : message.includes("already registered")
            ? "Este e-mail já tem conta. Use a aba Entrar."
            : message.includes("Failed to fetch")
              ? "Servidor indisponível no momento. Tente novamente em alguns minutos."
              : message;
      toast.error(friendly);
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}${safeNext() ?? "/dashboard"}` },
      });
      if (error) throw error;
    } catch {
      setBusy(false);
      toast.error("Não foi possível entrar com o Google.");
    }
  }

  async function handleReset() {
    if (!email) {
      toast.error("Informe seu e-mail para receber o link de recuperação.");
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth?recovery=1`,
    });
    if (error) toast.error(error.message);
    else toast.success("Enviamos um link de recuperação para o seu e-mail.");
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <section className="hidden flex-col justify-between border-r border-edge bg-panel p-10 lg:flex">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl border border-edge bg-card">
            <Crosshair className="size-4 text-ice" aria-hidden="true" />
          </span>
          <span className="text-sm font-semibold tracking-tight">LEAD HUNTER AI</span>
        </div>
        <div className="max-w-md">
          <h2 className="text-3xl font-semibold leading-tight tracking-tight">
            Encontre empresas que realmente podem comprar.
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            Dinheiro, necessidade, oportunidade e facilidade de contato — o sistema pontua cada
            empresa de 0 a 100, mostra o que está fazendo ela perder clientes e monta a oferta, o
            prompt do site e a mensagem de abordagem.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-muted-foreground">
            {[
              "Lead Score com 5 dimensões ponderadas",
              "Auditoria de site, Google e Instagram",
              "Oferta, prompt e abordagem gerados por IA",
              "Pipeline, propostas e meta Malta Fund",
            ].map((item) => (
              <li key={item} className="flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-ice" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <p className="label-mono text-muted-foreground">encontrar · priorizar · fechar</p>
      </section>

      <section className="flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-semibold tracking-tight">
            {recovery ? "Definir nova senha" : mode === "login" ? "Entrar" : "Criar conta"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {recovery
              ? "Escolha e confirme sua nova senha."
              : mode === "login"
                ? "Acesse seu Command Center."
                : "Comece a caçar leads em poucos minutos."}
          </p>

          {recovery ? (
            <NewPasswordForm />
          ) : (
            <Tabs
              value={mode}
              onValueChange={(value) => setMode(value as "login" | "signup")}
              className="mt-6"
            >
              <TabsList className="grid w-full grid-cols-2 border border-edge bg-card">
                <TabsTrigger value="login">Entrar</TabsTrigger>
                <TabsTrigger value="signup">Cadastrar</TabsTrigger>
              </TabsList>

              <TabsContent value={mode} className="mt-5">
                <form onSubmit={handleSubmit} className="space-y-4">
                  {mode === "signup" && (
                    <div className="space-y-2">
                      <Label htmlFor="fullName">Nome</Label>
                      <Input
                        id="fullName"
                        value={fullName}
                        onChange={(event) => setFullName(event.target.value)}
                        placeholder="Seu nome"
                        className="border-edge bg-card"
                      />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="email">E-mail</Label>
                    <Input
                      id="email"
                      type="email"
                      required
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="voce@empresa.com"
                      className="border-edge bg-card"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Senha</Label>
                    <Input
                      id="password"
                      type="password"
                      required
                      minLength={6}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="••••••••"
                      className="border-edge bg-card"
                    />
                  </div>
                  <Button type="submit" className="w-full gap-2" disabled={busy}>
                    {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                    {mode === "login" ? "Entrar" : "Criar conta"}
                  </Button>
                </form>

                <div className="my-4 flex items-center gap-3">
                  <span className="h-px flex-1 bg-edge" />
                  <span className="label-mono text-muted-foreground">ou</span>
                  <span className="h-px flex-1 bg-edge" />
                </div>

                <Button
                  variant="outline"
                  className="w-full border-edge bg-card"
                  onClick={handleGoogle}
                  disabled={busy}
                >
                  Continuar com Google
                </Button>

                {mode === "login" && (
                  <button
                    type="button"
                    onClick={handleReset}
                    className="mt-4 w-full text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                  >
                    Esqueci minha senha
                  </button>
                )}
              </TabsContent>
            </Tabs>
          )}
        </div>
      </section>
    </div>
  );
}
