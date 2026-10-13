"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

const API_URL = "https://lattice-api.princechaurasiya.in".replace(/\/+$/, "");

type Provider = {
  _id: string;
  name: string;
  provider: string;
  baseUrl: string;
  isEnabled: boolean;
  priority: number;
  supportedModels: string[];
  health: "unknown" | "healthy" | "degraded" | "unavailable";
  consecutiveFailures: number;
  lastUsedAt: string | null;
};

type GatewayToken = {
  _id?: string;
  id?: string;
  name: string;
  tokenPrefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  token?: string;
};

type ChatMessage = { role: "user" | "assistant"; content: string };

type User = { id: string; name: string; email: string };

type ApiError = {
  error?: { message?: string; details?: { message: string }[] };
};

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      credentials: "include",
      headers: {
        ...(options.body ? { "content-type": "application/json" } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new Error(
      `Cannot reach the gateway API at ${API_URL}. Start the backend and check its frontend CORS origin.`,
    );
  }

  if (!response.ok) {
    let detail = `Request failed (${response.status})`;
    try {
      const body = (await response.json()) as ApiError;
      detail =
        body.error?.details?.map((item) => item.message).join(", ") ??
        body.error?.message ??
        detail;
    } catch {
      // Use the HTTP status when the server did not return JSON.
    }
    throw new Error(detail);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };

  const paths: Record<string, React.ReactNode> = {
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
      </>
    ),
    layers: (
      <>
        <path d="m12 3 9 5-9 5-9-5 9-5Z" />
        <path d="m3 12 9 5 9-5M3 16l9 5 9-5" />
      </>
    ),
    key: (
      <>
        <circle cx="8" cy="15" r="5" />
        <path d="m11.5 11.5 9-9M17 6l2 2M14 9l2 2" />
      </>
    ),
    chat: (
      <>
        <path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z" />
      </>
    ),
    plus: (
      <>
        <path d="M12 5v14M5 12h14" />
      </>
    ),
    arrow: (
      <>
        <path d="M7 17 17 7M7 7h10v10" />
      </>
    ),
    shield: (
      <>
        <path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
    dots: (
      <>
        <circle cx="5" cy="12" r="1" />
        <circle cx="12" cy="12" r="1" />
        <circle cx="19" cy="12" r="1" />
      </>
    ),
    trash: (
      <>
        <path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m4 4v6m6-6v6" />
      </>
    ),
    copy: (
      <>
        <rect x="8" y="8" width="13" height="13" rx="2" />
        <path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" />
      </>
    ),
    eye: (
      <>
        <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    logout: (
      <>
        <path d="M10 17l5-5-5-5M15 12H3" />
        <path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    close: (
      <>
        <path d="m18 6-12 12M6 6l12 12" />
      </>
    ),
  };

  return <svg {...common}>{paths[name] ?? paths.grid}</svg>;
}

function Button({
  children,
  variant = "primary",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "quiet" | "danger";
}) {
  return (
    <button className={`button button-${variant}`} {...props}>
      {children}
    </button>
  );
}

function Modal({
  title,
  description,
  onClose,
  children,
}: {
  title: string;
  description: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-heading">
          <div>
            <h2>{title}</h2>
            <p>{description}</p>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [providers, setProviders] = useState<Provider[]>([]);
  const [tokens, setTokens] = useState<GatewayToken[]>([]);
  const [usableGatewayToken, setUsableGatewayToken] = useState<{
    id: string;
    token: string;
  } | null>(null);
  const [activePage, setActivePage] = useState("Overview");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [modal, setModal] = useState<"provider" | "token" | null>(null);
  const [revealedToken, setRevealedToken] = useState<GatewayToken | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [providerForm, setProviderForm] = useState({
    name: "",
    provider: "openrouter",
    apiKey: "",
    baseUrl: "https://openrouter.ai/api/v1",
    priority: "100",
    supportedModels: "",
  });
  const [tokenName, setTokenName] = useState("");
  const [chatModel, setChatModel] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [usedProvider, setUsedProvider] = useState("");
  const [copied, setCopied] = useState(false);

  const enabledProviders = useMemo(
    () => providers.filter((provider) => provider.isEnabled),
    [providers],
  );
  const configuredModels = useMemo(
    () => [
      ...new Set(
        enabledProviders.flatMap((provider) => provider.supportedModels),
      ),
    ],
    [enabledProviders],
  );

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [providerResult, tokenResult] = await Promise.all([
        request<{ data: Provider[] }>("/api/providers"),
        request<{ data: GatewayToken[] }>("/api/tokens"),
      ]);
      setProviders(providerResult.data);
      setTokens(tokenResult.data);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not load dashboard",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    request<{ user?: User; session?: unknown } | null>("/api/auth/get-session")
      .then((session) => {
        if (session?.user) {
          setUser(session.user);
          void loadDashboard();
        }
      })
      .catch((cause: unknown) => {
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not connect to the API",
        );
      })
      .finally(() => setCheckingSession(false));
  }, [loadDashboard]);

  async function handleAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const path =
        authMode === "signup"
          ? "/api/auth/sign-up/email"
          : "/api/auth/sign-in/email";
      const result = await request<{ user: User }>(path, {
        method: "POST",
        body: JSON.stringify(
          authMode === "signup"
            ? { name: fullName, email, password }
            : { email, password },
        ),
      });
      setUser(result.user);
      await loadDashboard();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Authentication failed",
      );
    } finally {
      setLoading(false);
    }
  }

  async function signOut() {
    try {
      await request("/api/auth/sign-out", { method: "POST", body: "{}" });
    } finally {
      setUser(null);
      setProviders([]);
      setTokens([]);
      setUsableGatewayToken(null);
    }
  }

  async function createProvider(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      await request("/api/providers", {
        method: "POST",
        body: JSON.stringify({
          ...providerForm,
          priority: Number(providerForm.priority),
          supportedModels: providerForm.supportedModels
            .split(",")
            .map((model) => model.trim())
            .filter(Boolean),
        }),
      });
      setModal(null);
      setProviderForm({
        name: "",
        provider: "openrouter",
        apiKey: "",
        baseUrl: "https://openrouter.ai/api/v1",
        priority: "100",
        supportedModels: "",
      });
      setNotice("Provider connected");
      await loadDashboard();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not add provider",
      );
    } finally {
      setLoading(false);
    }
  }

  async function toggleProvider(provider: Provider) {
    setError("");
    try {
      await request(`/api/providers/${provider._id}`, {
        method: "PATCH",
        body: JSON.stringify({ isEnabled: !provider.isEnabled }),
      });
      await loadDashboard();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not update provider",
      );
    }
  }

  async function removeProvider(provider: Provider) {
    if (!window.confirm(`Remove ${provider.name}?`)) return;
    setError("");
    try {
      await request(`/api/providers/${provider._id}`, { method: "DELETE" });
      await loadDashboard();
      setNotice("Provider removed");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not remove provider",
      );
    }
  }

  async function createToken(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await request<{ data: GatewayToken }>("/api/tokens", {
        method: "POST",
        body: JSON.stringify({ name: tokenName }),
      });
      setRevealedToken(result.data);
      setUsableGatewayToken({
        id: result.data.id ?? result.data._id ?? "",
        token: result.data.token ?? "",
      });
      const savedToken = { ...result.data };
      delete savedToken.token;
      setTokens((current) => [savedToken, ...current]);
      setTokenName("");
      setModal(null);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not create token",
      );
    } finally {
      setLoading(false);
    }
  }

  async function removeToken(token: GatewayToken) {
    const id = token.id ?? token._id;
    if (!id || !window.confirm(`Revoke "${token.name}"?`)) return;
    setError("");
    try {
      await request(`/api/tokens/${id}`, { method: "DELETE" });
      setTokens((current) =>
        current.filter((item) => (item.id ?? item._id) !== id),
      );
      setUsableGatewayToken((current) => (current?.id === id ? null : current));
      setNotice("Token revoked");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not revoke token",
      );
    }
  }

  async function copyValue(value: string) {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  async function sendChat(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const gatewayToken = usableGatewayToken?.token;
    if (!gatewayToken) {
      setError("Create a gateway token in this session to use the playground.");
      setActivePage("API keys");
      return;
    }
    const prompt = chatInput.trim();
    if (!prompt || !chatModel.trim()) {
      setError("Enter a model ID and a message");
      return;
    }
    const updatedMessages = [
      ...chatMessages,
      { role: "user" as const, content: prompt },
    ];
    setChatMessages(updatedMessages);
    setChatInput("");
    setChatLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_URL}/v1/chat/completions`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${gatewayToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: chatModel.trim(),
          messages: updatedMessages,
          stream: false,
        }),
      });
      if (!response.ok) {
        const result = (await response.json()) as ApiError;
        throw new Error(
          result.error?.message ?? `Chat failed (${response.status})`,
        );
      }
      const result = (await response.json()) as {
        choices?: { message?: { content?: string | { text?: string }[] } }[];
      };
      const content = result.choices?.[0]?.message?.content;
      const text =
        typeof content === "string"
          ? content
          : Array.isArray(content)
            ? content.map((part) => part.text ?? "").join("")
            : "";
      setChatMessages([
        ...updatedMessages,
        { role: "assistant", content: text },
      ]);
      setUsedProvider(response.headers.get("x-gateway-provider") ?? "Provider");
    } catch (cause) {
      setChatMessages(chatMessages);
      setError(
        cause instanceof TypeError
          ? `Cannot reach the gateway API at ${API_URL}. Check that the backend is running and its CORS origin is configured.`
          : cause instanceof Error
            ? cause.message
            : "Chat request failed",
      );
    } finally {
      setChatLoading(false);
    }
  }

  if (checkingSession) {
    return (
      <main className="loading-screen">
        <span className="spinner" />
        Connecting to your workspace…
      </main>
    );
  }

  if (!user) {
    return (
      <main className="auth-layout">
        <div className="auth-art">
          <div className="brand">
            <span className="brand-mark">l</span> lattice
          </div>
          <div className="auth-art-copy">
            <div className="eyebrow">
              <span className="live-dot" /> OPEN MODEL ACCESS
            </div>
            <h1>
              One gateway.
              <br />
              Many possibilities.
            </h1>
            <p>
              Bring your favorite providers together and build on a single,
              reliable API.
            </p>
          </div>
          <div className="auth-art-foot">
            <span>Built for the open AI ecosystem</span>
            <span>01 / 04</span>
          </div>
        </div>
        <section className="auth-panel">
          <div className="mobile-brand brand">
            <span className="brand-mark">l</span> lattice
          </div>
          <div className="auth-card">
            <span className="auth-kicker">YOUR AI WORKSPACE</span>
            <h2>
              {authMode === "signin" ? "Welcome back" : "Create your account"}
            </h2>
            <p className="muted">
              {authMode === "signin"
                ? "Sign in to manage your providers and API keys."
                : "Get started with your personal LLM gateway."}
            </p>
            {error && <div className="alert alert-error">{error}</div>}
            <form className="form-stack" onSubmit={handleAuth}>
              {authMode === "signup" && (
                <label className="field">
                  <span>Your name</span>
                  <input
                    required
                    autoComplete="name"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    placeholder="Alex Morgan"
                  />
                </label>
              )}
              <label className="field">
                <span>Email address</span>
                <input
                  required
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                />
              </label>
              <label className="field">
                <span>Password</span>
                <input
                  required
                  type="password"
                  minLength={8}
                  autoComplete={
                    authMode === "signin" ? "current-password" : "new-password"
                  }
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="At least 8 characters"
                />
              </label>
              <Button disabled={loading}>
                {loading
                  ? "Please wait…"
                  : authMode === "signin"
                    ? "Sign in"
                    : "Create account"}{" "}
                <span>→</span>
              </Button>
            </form>
            <p className="switch-auth">
              {authMode === "signin"
                ? "New to Lattice?"
                : "Already have an account?"}{" "}
              <button
                onClick={() => {
                  setError("");
                  setAuthMode(authMode === "signin" ? "signup" : "signin");
                }}
              >
                {authMode === "signin" ? "Create an account" : "Sign in"}
              </button>
            </p>
          </div>
          <p className="auth-legal">
            By continuing, you agree to our terms and privacy policy.
          </p>
        </section>
      </main>
    );
  }

  const navItems = [
    { label: "Overview", icon: "grid" },
    { label: "Providers", icon: "layers" },
    { label: "API keys", icon: "key" },
    { label: "Playground", icon: "chat" },
  ];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#">
          <span className="brand-mark">l</span> lattice
        </a>
        <div className="workspace-label">WORKSPACE</div>
        <div className="workspace-switch">
          <span className="workspace-avatar">
            {user.name.slice(0, 1).toUpperCase()}
          </span>
          <span className="workspace-name">{user.name}&apos;s workspace</span>
          <span className="chevron">⌄</span>
        </div>
        <div className="nav-caption">PLATFORM</div>
        <nav className="nav-list">
          {navItems.map((item) => (
            <button
              key={item.label}
              className={`nav-item ${activePage === item.label ? "active" : ""}`}
              onClick={() => {
                setActivePage(item.label);
                setError("");
              }}
            >
              <Icon name={item.icon} size={17} />
              <span>{item.label}</span>
              {item.label === "Providers" && (
                <span className="nav-count">{providers.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="help-card">
            <div className="help-icon">
              <Icon name="shield" size={16} />
            </div>
            <strong>Your keys stay yours.</strong>
            <p>
              Provider credentials are encrypted and never exposed in the
              dashboard.
            </p>
            <a href="https://github.com" target="_blank" rel="noreferrer">
              Learn about security <Icon name="arrow" size={13} />
            </a>
          </div>
          <button className="profile-row" onClick={signOut}>
            <span className="profile-avatar">
              {user.name.slice(0, 1).toUpperCase()}
            </span>
            <span className="profile-meta">
              <strong>{user.name}</strong>
              <small>{user.email}</small>
            </span>
            <Icon name="logout" size={16} />
          </button>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div className="breadcrumbs">
            <span>Workspace</span>
            <span className="crumb-slash">/</span>
            <strong>{activePage}</strong>
          </div>
          <div className="topbar-right">
            <span className="status-pill">
              <span className="live-dot" /> Gateway connected
            </span>
            <div className="top-avatar">
              {user.name.slice(0, 1).toUpperCase()}
            </div>
          </div>
        </header>
        <div className="page-content">
          {(error || notice) && (
            <div
              className={`alert ${error ? "alert-error" : "alert-success"}`}
              role="status"
            >
              {error || notice}
              <button
                onClick={() => {
                  setError("");
                  setNotice("");
                }}
                aria-label="Dismiss"
              >
                <Icon name="close" size={15} />
              </button>
            </div>
          )}
          {activePage === "Overview" && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">YOUR WORKSPACE</div>
                  <h1>Good to see you, {user.name.split(" ")[0]}.</h1>
                  <p>
                    Here&apos;s what&apos;s happening with your LLM gateway.
                  </p>
                </div>
                <Button
                  onClick={() => {
                    setActivePage("Providers");
                    setModal("provider");
                  }}
                >
                  <Icon name="plus" size={16} /> Add provider
                </Button>
              </div>
              <section className="stats-grid">
                <article className="stat-card">
                  <div className="stat-label">
                    Connected providers{" "}
                    <span className="stat-icon indigo">
                      <Icon name="layers" />
                    </span>
                  </div>
                  <div className="stat-value">
                    {enabledProviders.length}
                    <span className="stat-unit">
                      /{providers.length} active
                    </span>
                  </div>
                  <div className="stat-foot">
                    <span className="stat-dot green" /> Ready for requests
                  </div>
                </article>
                <article className="stat-card">
                  <div className="stat-label">
                    Gateway API keys{" "}
                    <span className="stat-icon amber">
                      <Icon name="key" />
                    </span>
                  </div>
                  <div className="stat-value">
                    {tokens.length}
                    <span className="stat-unit">created</span>
                  </div>
                  <div className="stat-foot">Use keys with any OpenAI SDK</div>
                </article>
                <article className="stat-card">
                  <div className="stat-label">
                    Available models{" "}
                    <span className="stat-icon teal">
                      <Icon name="chat" />
                    </span>
                  </div>
                  <div className="stat-value">
                    {configuredModels.length}
                    <span className="stat-unit">configured</span>
                  </div>
                  <div className="stat-foot">Across your providers</div>
                </article>
              </section>
              <section className="overview-grid">
                <div className="surface-card provider-overview">
                  <div className="section-heading">
                    <div>
                      <h2>Your providers</h2>
                      <p>Manage the connections behind your gateway.</p>
                    </div>
                    <button
                      className="text-link"
                      onClick={() => setActivePage("Providers")}
                    >
                      View all <span>→</span>
                    </button>
                  </div>
                  {providers.length === 0 ? (
                    <EmptyState
                      icon="layers"
                      title="No providers connected"
                      description="Connect a model provider to start routing requests through your gateway."
                      action={
                        <Button onClick={() => setModal("provider")}>
                          <Icon name="plus" size={15} /> Connect provider
                        </Button>
                      }
                    />
                  ) : (
                    <div className="provider-list">
                      {providers.slice(0, 4).map((provider) => (
                        <ProviderRow
                          key={provider._id}
                          provider={provider}
                          onToggle={() => void toggleProvider(provider)}
                        />
                      ))}
                    </div>
                  )}
                </div>
                <div className="surface-card quickstart">
                  <div className="section-heading">
                    <div>
                      <h2>Make your first request</h2>
                      <p>One endpoint for all your models.</p>
                    </div>
                    <div className="quickstart-icon">
                      <Icon name="arrow" />
                    </div>
                  </div>
                  <div className="code-block">
                    <div className="code-top">
                      <span>
                        <i /> <i /> <i />
                      </span>
                      <span>curl</span>
                      <button
                        onClick={() =>
                          void copyValue(`curl ${API_URL}/v1/chat/completions`)
                        }
                        aria-label="Copy endpoint"
                      >
                        <Icon name={copied ? "check" : "copy"} size={14} />
                      </button>
                    </div>
                    <code>
                      <span className="code-purple">curl</span> {API_URL}
                      /v1/chat/completions
                      <br />
                      <span className="code-muted"> -H</span>{" "}
                      <span className="code-green">
                        &apos;Authorization: Bearer YOUR_KEY&apos;
                      </span>
                      <br />
                      <span className="code-muted"> -d</span>{" "}
                      <span className="code-green">
                        &apos;{`{"model":"your-model","messages":[...]}`}&apos;
                      </span>
                    </code>
                  </div>
                  <button
                    className="text-link docs-link"
                    onClick={() => setActivePage("API keys")}
                  >
                    Create a gateway key <span>→</span>
                  </button>
                </div>
              </section>
              <section className="bottom-banner">
                <div className="banner-mark">✳</div>
                <div>
                  <strong>
                    Simple, reliable access to the models you love.
                  </strong>
                  <p>
                    Add multiple providers and let Lattice route around failures
                    automatically.
                  </p>
                </div>
                <Button
                  variant="secondary"
                  onClick={() => setActivePage("Playground")}
                >
                  Try the playground <Icon name="arrow" size={15} />
                </Button>
              </section>
            </>
          )}

          {activePage === "Providers" && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">CONNECTIONS</div>
                  <h1>Providers</h1>
                  <p>Connect your model accounts and set failover priority.</p>
                </div>
                <Button onClick={() => setModal("provider")}>
                  <Icon name="plus" size={16} /> Add provider
                </Button>
              </div>
              <div className="surface-card full-card">
                <div className="section-heading">
                  <div>
                    <h2>
                      Connected providers{" "}
                      <span className="heading-count">{providers.length}</span>
                    </h2>
                    <p>Enabled providers are tried in priority order.</p>
                  </div>
                  <button
                    className="icon-button"
                    onClick={() => void loadDashboard()}
                    aria-label="Refresh"
                  >
                    <span className={loading ? "refresh-spin" : ""}>↻</span>
                  </button>
                </div>
                {providers.length === 0 ? (
                  <EmptyState
                    icon="layers"
                    title="Your gateway is waiting for a provider"
                    description="Connect OpenRouter or another OpenAI-compatible service. You can add multiple keys from the same provider."
                    action={
                      <Button onClick={() => setModal("provider")}>
                        <Icon name="plus" size={15} /> Add your first provider
                      </Button>
                    }
                  />
                ) : (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>PROVIDER</th>
                          <th>MODELS</th>
                          <th>PRIORITY</th>
                          <th>HEALTH</th>
                          <th>STATUS</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {providers.map((provider) => (
                          <tr key={provider._id}>
                            <td>
                              <div className="table-provider">
                                <ProviderLogo provider={provider.provider} />
                                <span>
                                  <strong>{provider.name}</strong>
                                  <small>
                                    {provider.provider} ·{" "}
                                    {new URL(provider.baseUrl).host}
                                  </small>
                                </span>
                              </div>
                            </td>
                            <td>
                              <span className="models-cell">
                                {provider.supportedModels.length
                                  ? provider.supportedModels
                                      .slice(0, 2)
                                      .join(", ")
                                  : "All models"}
                                {provider.supportedModels.length > 2 &&
                                  ` +${provider.supportedModels.length - 2}`}
                              </span>
                            </td>
                            <td>
                              <span className="priority-tag">
                                #{provider.priority}
                              </span>
                            </td>
                            <td>
                              <span className={`health ${provider.health}`}>
                                <i />
                                {provider.health}
                              </span>
                            </td>
                            <td>
                              <button
                                className={`toggle ${provider.isEnabled ? "on" : ""}`}
                                aria-label={
                                  provider.isEnabled
                                    ? "Disable provider"
                                    : "Enable provider"
                                }
                                onClick={() => void toggleProvider(provider)}
                              >
                                <span />
                              </button>
                            </td>
                            <td>
                              <button
                                className="icon-button danger-icon"
                                onClick={() => void removeProvider(provider)}
                                aria-label={`Remove ${provider.name}`}
                              >
                                <Icon name="trash" size={16} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              <div className="tip-row">
                <span className="tip-icon">i</span>
                <p>
                  <strong>Automatic failover is on.</strong> When a provider
                  returns an error or rate limit, your request is routed to the
                  next available provider.
                </p>
              </div>
            </>
          )}

          {activePage === "API keys" && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">ACCESS MANAGEMENT</div>
                  <h1>Gateway API keys</h1>
                  <p>
                    Use these keys to connect your apps to your unified LLM
                    endpoint.
                  </p>
                </div>
                <Button onClick={() => setModal("token")}>
                  <Icon name="plus" size={16} /> Create key
                </Button>
              </div>
              <div className="key-notice">
                <div className="notice-icon">
                  <Icon name="shield" />
                </div>
                <div>
                  <strong>Your keys are only shown once</strong>
                  <p>
                    For security, we store a hash of each key. Copy a new key
                    when it is created.
                  </p>
                </div>
              </div>
              <div className="surface-card full-card">
                <div className="section-heading">
                  <div>
                    <h2>
                      Your keys{" "}
                      <span className="heading-count">{tokens.length}</span>
                    </h2>
                    <p>Each key gives access to your configured providers.</p>
                  </div>
                </div>
                {tokens.length === 0 ? (
                  <EmptyState
                    icon="key"
                    title="No gateway keys yet"
                    description="Create a key to authenticate requests from the OpenAI SDK or playground."
                    action={
                      <Button onClick={() => setModal("token")}>
                        <Icon name="plus" size={15} /> Create your first key
                      </Button>
                    }
                  />
                ) : (
                  <div className="token-list">
                    {tokens.map((token) => (
                      <div className="token-row" key={token.id ?? token._id}>
                        <div className="token-icon">
                          <Icon name="key" />
                        </div>
                        <div className="token-info">
                          <strong>{token.name}</strong>
                          <code>{token.tokenPrefix}••••••••••••••••</code>
                        </div>
                        <div className="token-meta">
                          <span>
                            Created{" "}
                            {new Date(token.createdAt).toLocaleDateString()}
                          </span>
                          <span>
                            {token.lastUsedAt
                              ? `Last used ${new Date(token.lastUsedAt).toLocaleDateString()}`
                              : "Never used"}
                          </span>
                        </div>
                        <button
                          className="icon-button danger-icon"
                          onClick={() => void removeToken(token)}
                          aria-label={`Revoke ${token.name}`}
                        >
                          <Icon name="trash" size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="surface-card endpoint-card">
                <div className="endpoint-title">
                  <span className="endpoint-icon">
                    <Icon name="arrow" />
                  </span>
                  <div>
                    <strong>OpenAI-compatible endpoint</strong>
                    <p>
                      Drop this into your existing OpenAI SDK configuration.
                    </p>
                  </div>
                </div>
                <div className="endpoint-code">
                  <code>{API_URL}/v1</code>
                  <button onClick={() => void copyValue(`${API_URL}/v1`)}>
                    <Icon name={copied ? "check" : "copy"} size={15} />{" "}
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>
            </>
          )}

          {activePage === "Playground" && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">TEST YOUR SETUP</div>
                  <h1>Playground</h1>
                  <p>
                    Try a model through your gateway before wiring up your app.
                  </p>
                </div>
                <span className="endpoint-badge">
                  <i /> {enabledProviders.length} providers ready
                </span>
              </div>
              <div className="playground surface-card">
                <div className="playground-top">
                  <div>
                    <span className="playground-label">CHAT COMPLETION</span>
                    <h2>New conversation</h2>
                  </div>
                  <button
                    className="text-link"
                    onClick={() => {
                      setChatMessages([]);
                      setUsedProvider("");
                    }}
                  >
                    Clear chat <Icon name="trash" size={14} />
                  </button>
                </div>
                {!usableGatewayToken && (
                  <div className="alert alert-info">
                    <Icon name="key" size={16} /> Create a gateway key in this
                    session to use the playground.{" "}
                    <button onClick={() => setActivePage("API keys")}>
                      Manage keys →
                    </button>
                  </div>
                )}
                {chatMessages.length === 0 ? (
                  <div className="chat-empty">
                    <div className="chat-empty-mark">
                      <Icon name="chat" size={23} />
                    </div>
                    <h3>What would you like to explore?</h3>
                    <p>
                      Your message will be routed through the providers you have
                      connected.
                    </p>
                    <div className="prompt-suggestions">
                      <button
                        onClick={() =>
                          setChatInput("What can you help me with?")
                        }
                      >
                        What can you help me with?
                      </button>
                      <button
                        onClick={() =>
                          setChatInput("Explain how LLM failover works.")
                        }
                      >
                        Explain LLM failover
                      </button>
                      <button
                        onClick={() =>
                          setChatInput("Write a short haiku about open source.")
                        }
                      >
                        Write a short haiku
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="chat-transcript">
                    {chatMessages.map((message, index) => (
                      <div
                        className={`chat-message ${message.role}`}
                        key={`${message.role}-${index}`}
                      >
                        <div className="message-avatar">
                          {message.role === "assistant"
                            ? "l"
                            : user.name.slice(0, 1).toUpperCase()}
                        </div>
                        <div className="message-body">
                          <span>
                            {message.role === "assistant"
                              ? `Lattice${usedProvider ? ` · ${usedProvider}` : ""}`
                              : "You"}
                          </span>
                          <p>{message.content}</p>
                        </div>
                      </div>
                    ))}
                    {chatLoading && (
                      <div className="chat-message assistant">
                        <div className="message-avatar">l</div>
                        <div className="message-body">
                          <span>Lattice</span>
                          <p className="typing">
                            <i />
                            <i />
                            <i />
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <form
                  className="chat-composer"
                  onSubmit={(event) => void sendChat(event)}
                >
                  <div className="model-input">
                    <label htmlFor="chat-model">MODEL</label>
                    <input
                      id="chat-model"
                      value={chatModel}
                      onChange={(event) => setChatModel(event.target.value)}
                      placeholder={
                        configuredModels[0] ?? "e.g. openai/gpt-4o-mini"
                      }
                      list="model-options"
                    />
                    <datalist id="model-options">
                      {configuredModels.map((model) => (
                        <option value={model} key={model} />
                      ))}
                    </datalist>
                  </div>
                  <div className="composer-line">
                    <textarea
                      rows={2}
                      value={chatInput}
                      onChange={(event) => setChatInput(event.target.value)}
                      placeholder="Send a message…"
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          event.currentTarget.form?.requestSubmit();
                        }
                      }}
                    />
                    <button
                      className="send-button"
                      type="submit"
                      disabled={chatLoading || !chatInput.trim()}
                      aria-label="Send message"
                    >
                      {chatLoading ? (
                        <span className="spinner small" />
                      ) : (
                        <span>↑</span>
                      )}
                    </button>
                  </div>
                  <div className="composer-foot">
                    <span>Enter to send · Shift + Enter for a new line</span>
                    {usedProvider && (
                      <span className="provider-used">
                        Routed through <strong>{usedProvider}</strong>
                      </span>
                    )}
                  </div>
                </form>
              </div>
            </>
          )}
          <footer className="page-footer">
            <span>© 2026 Lattice Gateway</span>
            <span>Built for the open model ecosystem</span>
          </footer>
        </div>
      </main>

      {modal === "provider" && (
        <Modal
          title="Connect a provider"
          description="Add an OpenAI-compatible provider to your gateway."
          onClose={() => setModal(null)}
        >
          <form
            className="form-stack modal-form"
            onSubmit={(event) => void createProvider(event)}
          >
            <label className="field">
              <span>Connection name</span>
              <input
                required
                maxLength={80}
                value={providerForm.name}
                onChange={(event) =>
                  setProviderForm({ ...providerForm, name: event.target.value })
                }
                placeholder="OpenRouter primary"
              />
            </label>
            <div className="form-row">
              <label className="field">
                <span>Provider ID</span>
                <input
                  required
                  value={providerForm.provider}
                  onChange={(event) =>
                    setProviderForm({
                      ...providerForm,
                      provider: event.target.value,
                    })
                  }
                  placeholder="openrouter"
                />
              </label>
              <label className="field">
                <span>Priority</span>
                <input
                  type="number"
                  min={0}
                  max={1000}
                  value={providerForm.priority}
                  onChange={(event) =>
                    setProviderForm({
                      ...providerForm,
                      priority: event.target.value,
                    })
                  }
                />
              </label>
            </div>
            <label className="field">
              <span>Base URL</span>
              <input
                required
                type="url"
                value={providerForm.baseUrl}
                onChange={(event) =>
                  setProviderForm({
                    ...providerForm,
                    baseUrl: event.target.value,
                  })
                }
                placeholder="https://openrouter.ai/api/v1"
              />
            </label>
            <label className="field">
              <span>Provider API key</span>
              <input
                required
                type="password"
                autoComplete="off"
                value={providerForm.apiKey}
                onChange={(event) =>
                  setProviderForm({
                    ...providerForm,
                    apiKey: event.target.value,
                  })
                }
                placeholder="sk-…"
              />
            </label>
            <label className="field">
              <span>
                Supported model IDs <small>Optional · comma separated</small>
              </span>
              <input
                value={providerForm.supportedModels}
                onChange={(event) =>
                  setProviderForm({
                    ...providerForm,
                    supportedModels: event.target.value,
                  })
                }
                placeholder="openai/gpt-4o-mini, meta-llama/…"
              />
            </label>
            <div className="modal-actions">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setModal(null)}
              >
                Cancel
              </Button>
              <Button disabled={loading}>
                {loading ? "Connecting…" : "Connect provider"} <span>→</span>
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {modal === "token" && (
        <Modal
          title="Create a gateway key"
          description="Give this key a name so you can recognize it later."
          onClose={() => setModal(null)}
        >
          <form
            className="form-stack modal-form"
            onSubmit={(event) => void createToken(event)}
          >
            <label className="field">
              <span>Key name</span>
              <input
                required
                maxLength={80}
                value={tokenName}
                onChange={(event) => setTokenName(event.target.value)}
                placeholder="My application"
                autoFocus
              />
            </label>
            <div className="modal-actions">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setModal(null)}
              >
                Cancel
              </Button>
              <Button disabled={loading}>
                {loading ? "Creating…" : "Create key"} <span>→</span>
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {revealedToken?.token && (
        <Modal
          title="Your new key is ready"
          description="Copy this key now. For security, the full value will not be shown again."
          onClose={() => setRevealedToken(null)}
        >
          <div className="new-token-box">
            <code>{revealedToken.token}</code>
            <button onClick={() => void copyValue(revealedToken.token!)}>
              <Icon name={copied ? "check" : "copy"} size={16} />
              {copied ? "Copied" : "Copy key"}
            </button>
          </div>
          <div className="alert alert-info">
            <Icon name="shield" size={16} /> Store this key like a password. It
            grants access to your gateway.
          </div>
          <div className="modal-actions">
            <Button onClick={() => setRevealedToken(null)}>Done</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: string;
  title: string;
  description: string;
  action: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Icon name={icon} size={20} />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}

function ProviderLogo({ provider }: { provider: string }) {
  const initials =
    provider === "openrouter" ? "◈" : provider.slice(0, 1).toUpperCase();
  return (
    <span
      className={`provider-logo logo-${provider.replace(/[^a-z0-9]/g, "")}`}
    >
      {initials}
    </span>
  );
}

function ProviderRow({
  provider,
  onToggle,
}: {
  provider: Provider;
  onToggle: () => void;
}) {
  return (
    <div className="provider-row">
      <ProviderLogo provider={provider.provider} />
      <div className="provider-row-main">
        <strong>{provider.name}</strong>
        <span>
          {provider.provider} ·{" "}
          {provider.supportedModels.length
            ? provider.supportedModels.length + " models"
            : "Any model"}
        </span>
      </div>
      <span className={`health ${provider.health}`}>
        <i />
        {provider.health}
      </span>
      <button
        className={`toggle ${provider.isEnabled ? "on" : ""}`}
        onClick={onToggle}
        aria-label={provider.isEnabled ? "Disable provider" : "Enable provider"}
      >
        <span />
      </button>
    </div>
  );
}
