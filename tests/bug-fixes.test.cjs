const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

// Execute the real modules with only framework/network boundaries substituted.
function load(file, mocks = {}) {
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, "..", file), "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: file,
  }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", code)(
    (name) => {
      if (name in mocks) return mocks[name];
      if (name.startsWith("@/") || name.startsWith("."))
        throw new Error(`Unmocked dependency: ${name}`);
      return require(name);
    },
    module,
    module.exports,
  );
  return module.exports;
}

const { safeAuthPath } = load("src/lib/auth-redirect.ts");
const score = load("src/lib/score.ts");
test("redirects preserve internal paths, queries and fragments", () => {
  assert.equal(
    safeAuthPath("/leads?q=clinic#results", "https://app.test"),
    "/leads?q=clinic#results",
  );
});
test("redirects reject external, protocol-relative, backslash and control-character tricks", () => {
  for (const next of [
    null,
    "",
    "https://evil.test",
    "//evil.test",
    "/\\evil.test",
    "\\\\evil.test",
    "/\n/evil.test",
    "/a/..//evil.test",
    "javascript:alert(1)",
  ]) {
    assert.equal(safeAuthPath(next, "https://app.test"), null, String(next));
  }
});
test("missing, blank and zero-valued lead evidence scores zero", () => {
  for (const input of [
    undefined,
    {},
    { website: null, rating: null },
    {
      website: "  ",
      phone: " ",
      instagram: " ",
      email: " ",
      whatsapp: " ",
      rating: 0,
      followers: 0,
      review_count: 0,
    },
  ]) {
    assert.equal(score.calculateLeadScore(input).total, 0);
  }
});
test("known evidence scores consistently without inferring absent channels", () => {
  assert.equal(score.calculateLeadScore({ category: "Clínica" }).total, 16);
  assert.equal(score.calculateLeadScore({ website: "https://clinic.test" }).websiteNeed, 0);
  assert.equal(score.calculateLeadScore({ website: "http://clinic.test" }).websiteNeed, 8);
  assert.equal(
    score.calculateLeadScore({ website: "https://wixsite.com.evil.test" }).websiteNeed,
    0,
  );
  assert.equal(score.calculateLeadScore({ rating: 3 }).problems, 1);
});

function database(respond) {
  const calls = [];
  return {
    calls,
    from(table) {
      const call = { table, operation: "read" };
      calls.push(call);
      const query = {};
      for (const method of ["select", "eq", "order", "limit", "single", "maybeSingle"])
        query[method] = () => query;
      for (const method of ["insert", "update", "delete"])
        query[method] = (payload) => {
          Object.assign(call, { operation: method, payload });
          return query;
        };
      query.then = (resolve, reject) => Promise.resolve(respond(call)).then(resolve, reject);
      return query;
    },
  };
}
function aiModule() {
  const chain = { middleware: () => chain, inputValidator: () => chain, handler: (fn) => fn };
  return load("src/lib/ai.functions.ts", {
    "@tanstack/react-start": { createServerFn: () => chain },
    "@/integrations/supabase/auth-middleware": { requireSupabaseAuth: {} },
    "@/lib/ai-gateway.server": { callAi: async () => "Generated prompt" },
  });
}
for (const existing of [false, true]) {
  for (const outcome of ["success", "error", "empty"]) {
    test(`website prompt ${existing ? "update" : "insert"}: ${outcome}`, async () => {
      const db = database(({ table, operation }) => {
        if (table === "leads") return { data: { id: "lead", company_name: "Clinic" }, error: null };
        if (operation === "read")
          return {
            data: table === "design_references" ? [] : existing ? { id: "offer" } : null,
            error: null,
          };
        return {
          data: outcome === "success" ? { id: "offer" } : null,
          error: outcome === "error" ? { message: "write denied" } : null,
        };
      });
      const task = aiModule().generateWebsitePrompt({
        data: { leadId: "lead" },
        context: { supabase: db, userId: "user" },
      });
      if (outcome === "success") assert.deepEqual(await task, { prompt: "Generated prompt" });
      else await assert.rejects(task, outcome === "error" ? /write denied/ : /salvar o prompt/);
      assert.equal(db.calls.at(-1).operation, existing ? "update" : "insert");
    });
  }
}
test("failed context reads abort prompt generation before persistence", async () => {
  const db = database(({ table }) =>
    table === "leads"
      ? { data: { id: "lead" }, error: null }
      : { data: null, error: { message: "read denied" } },
  );
  await assert.rejects(
    aiModule().generateWebsitePrompt({
      data: { leadId: "lead" },
      context: { supabase: db, userId: "user" },
    }),
    /read denied/,
  );
  assert.ok(db.calls.every((call) => call.operation === "read"));
});
test("MCP persists the shared score and every dimension as the signed-in user", async () => {
  const db = database(() => ({ data: { id: "lead", company_name: "Clinic" }, error: null }));
  const tool = load("src/lib/mcp/tools/create-lead.ts", {
    "@lovable.dev/mcp-js": { defineTool: (value) => value, ToolError: Error },
    "../supabase": { supabaseForUser: () => db },
    "@/lib/score": score,
  }).default;
  const input = {
    company_name: "Clinic",
    category: "Clínica",
    website: "https://clinic.test",
    phone: "123",
  };
  await tool.handler(input, { isAuthenticated: () => true, getUserId: () => "user" });
  const row = db.calls[0].payload;
  const expected = score.calculateLeadScore(input);
  assert.equal(row.user_id, "user");
  assert.equal(row.lead_score, expected.total);
  assert.equal(
    row.investment_score +
      row.website_need_score +
      row.digital_presence_score +
      row.sales_potential_score +
      row.problem_score,
    expected.total,
  );
});

// Hook-level unit harness: effects and state transitions, without a browser or account.
function hooks() {
  const values = [];
  const effects = [];
  let cursor = 0;
  let mounted = false;
  return {
    react: {
      createContext: (value) => ({ Provider: "provider", value }),
      useContext: (context) => context.value,
      useMemo: (fn) => fn(),
      useState: (initial) => {
        const index = cursor++;
        if (!(index in values)) values[index] = typeof initial === "function" ? initial() : initial;
        return [
          values[index],
          (value) => {
            values[index] = typeof value === "function" ? value(values[index]) : value;
          },
        ];
      },
      useEffect: (fn) => {
        if (!mounted) effects.push(fn);
      },
    },
    render(fn) {
      cursor = 0;
      return fn();
    },
    reset() {
      values.length = 0;
      cursor = 0;
    },
    mount() {
      mounted = true;
      return effects.map((fn) => fn());
    },
  };
}
const jsx = {
  jsx: (type, props, key) => ({ type, props, key }),
  jsxs: (type, props, key) => ({ type, props, key }),
};
function find(node, predicate) {
  if (!node || typeof node !== "object") return undefined;
  if (predicate(node)) return node;
  for (const child of [node.props?.children].flat(Infinity)) {
    const result = find(child, predicate);
    if (result) return result;
  }
}
const tick = () => new Promise((resolve) => setImmediate(resolve));

test("session switches clear cached data, token refresh preserves it, logout redirects", async () => {
  const h = hooks();
  let listener;
  let clears = 0;
  const navigations = [];
  let resolveInitial;
  const auth = {
    getSession: () =>
      new Promise((resolve) => {
        resolveInitial = resolve;
      }),
    onAuthStateChange: (fn) => {
      listener = fn;
      return { data: { subscription: { unsubscribe() {} } } };
    },
    signOut: async () => ({ error: null }),
  };
  const { AuthProvider } = load("src/hooks/useAuth.tsx", {
    react: h.react,
    "react/jsx-runtime": jsx,
    "@tanstack/react-query": { useQueryClient: () => ({ clear: () => clears++ }) },
    "@tanstack/react-router": { useNavigate: () => (to) => navigations.push(to) },
    "@/integrations/supabase/client": { supabase: { auth } },
  });
  const render = () => h.render(() => AuthProvider({ children: "app" }));
  render();
  h.mount();
  listener("SIGNED_IN", { user: { id: "A" } });
  listener("TOKEN_REFRESHED", { user: { id: "A" } });
  assert.equal(clears, 1);
  listener("SIGNED_IN", { user: { id: "B" } });
  assert.equal(clears, 2);
  resolveInitial({ data: { session: { user: { id: "A" } } } });
  await tick();
  assert.equal(
    render().props.value.user.id,
    "B",
    "late initial session must not restore previous user",
  );
  await render().props.value.signOut();
  assert.equal(render().props.value.user, null);
  assert.equal(navigations.at(-1).to, "/auth");
  assert.equal(clears, 3);
});

function authHarness(url, session = { user: { id: "user" } }) {
  const h = hooks();
  const navigations = [];
  const updates = [];
  const notices = [];
  let listener;
  global.window = { location: new URL(url) };
  window.location.replace = (to) => navigations.push(to);
  const auth = {
    getSession: async () => ({ data: { session }, error: null }),
    onAuthStateChange: (fn) => {
      listener = fn;
      return { data: { subscription: { unsubscribe() {} } } };
    },
    updateUser: async (input) => {
      updates.push(input);
      return { data: { user: { id: "user" } }, error: null };
    },
  };
  const mocks = {
    react: h.react,
    "react/jsx-runtime": jsx,
    "@tanstack/react-router": {
      createFileRoute: () => (config) => config,
      useNavigate: () => (to) => navigations.push(to),
    },
    "lucide-react": { Crosshair: "icon", Loader2: "icon" },
    sonner: {
      toast: {
        error: (message) => notices.push(message),
        success: (message) => notices.push(message),
      },
    },
    "@/integrations/supabase/client": { supabase: { auth } },
    "@/lib/auth-redirect": { safeAuthPath },
  };
  for (const [file, names] of Object.entries({
    button: ["Button"],
    input: ["Input"],
    label: ["Label"],
    tabs: ["Tabs", "TabsContent", "TabsList", "TabsTrigger"],
  }))
    mocks[`@/components/ui/${file}`] = Object.fromEntries(names.map((name) => [name, name]));
  const { Route } = load("src/routes/auth.tsx", mocks);
  return {
    h,
    updates,
    notices,
    navigations,
    auth,
    render: () => h.render(Route.component),
    event: (type) => listener(type),
  };
}
for (const url of [
  "https://app.test/auth?recovery=1",
  "https://app.test/auth#type=recovery",
  "https://app.test/auth?type=recovery",
]) {
  test(`recovery session stays on password form: ${url}`, async () => {
    const a = authHarness(url);
    a.render();
    a.h.mount();
    await tick();
    assert.equal(a.navigations.length, 0);
    assert.ok(find(a.render(), (node) => node.type?.name === "NewPasswordForm"));
  });
}
test("PASSWORD_RECOVERY event wins over automatic dashboard navigation", async () => {
  const a = authHarness("https://app.test/auth");
  a.render();
  a.h.mount();
  a.event("PASSWORD_RECOVERY");
  await tick();
  assert.equal(a.navigations.length, 0);
  assert.ok(find(a.render(), (node) => node.type?.name === "NewPasswordForm"));
});
test("ordinary login sessions still navigate to dashboard", async () => {
  const a = authHarness("https://app.test/auth");
  a.render();
  a.h.mount();
  await tick();
  assert.equal(a.navigations[0].to, "/dashboard");
});
test("new-password form rejects mismatch and persists a matching password", async () => {
  const a = authHarness("https://app.test/auth?recovery=1");
  const component = find(a.render(), (node) => node.type?.name === "NewPasswordForm").type;
  // Separate hook slots for this child component.
  a.h.reset();
  const form = () => a.h.render(component);
  find(form(), (node) => node.props?.id === "new-password").props.onChange({
    target: { value: "new-secret" },
  });
  find(form(), (node) => node.props?.id === "confirm-password").props.onChange({
    target: { value: "different" },
  });
  await form().props.onSubmit({ preventDefault() {} });
  assert.equal(a.updates.length, 0);
  find(form(), (node) => node.props?.id === "confirm-password").props.onChange({
    target: { value: "new-secret" },
  });
  await form().props.onSubmit({ preventDefault() {} });
  assert.deepEqual(a.updates, [{ password: "new-secret" }]);
  assert.equal(a.navigations.at(-1), "/dashboard");
});

for (const failure of ["expired", "write-error"]) {
  test(`new-password form does not report success on ${failure}`, async () => {
    const a = authHarness(
      "https://app.test/auth?recovery=1",
      failure === "expired" ? null : { user: { id: "user" } },
    );
    if (failure === "write-error")
      a.auth.updateUser = async () => ({
        data: { user: null },
        error: new Error("password rejected"),
      });
    const component = find(a.render(), (node) => node.type?.name === "NewPasswordForm").type;
    a.h.reset();
    const form = () => a.h.render(component);
    for (const id of ["new-password", "confirm-password"])
      find(form(), (node) => node.props?.id === id).props.onChange({
        target: { value: "new-secret" },
      });
    await form().props.onSubmit({ preventDefault() {} });
    assert.equal(a.navigations.length, 0);
    assert.equal(a.notices.length, 1);
    assert.match(a.notices[0], failure === "expired" ? /expirado/ : /password rejected/);
  });
}

test("Google login calls Supabase directly with an internal redirect", async () => {
  const a = authHarness("https://app.test/auth?next=%2F%5Cevil.test", null);
  const calls = [];
  a.auth.signInWithOAuth = async (input) => {
    calls.push(input);
    return { error: null };
  };
  const button = find(a.render(), (node) => node.props?.children === "Continuar com Google");
  await button.props.onClick();
  assert.deepEqual(calls, [
    { provider: "google", options: { redirectTo: "https://app.test/dashboard" } },
  ]);
});

test("Google login errors re-enable the button and display feedback", async () => {
  const a = authHarness("https://app.test/auth", null);
  a.auth.signInWithOAuth = async () => {
    throw new Error("unavailable");
  };
  await find(a.render(), (node) => node.props?.children === "Continuar com Google").props.onClick();
  assert.equal(
    find(a.render(), (node) => node.props?.children === "Continuar com Google").props.disabled,
    false,
  );
  assert.match(a.notices[0], /Google/);
});
