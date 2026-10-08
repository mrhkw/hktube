import { supabase } from "./supabase";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (options: {
            client_id: string;
            callback: (response: { credential: string }) => void | Promise<void>;
            nonce?: string;
            use_fedcm_for_prompt?: boolean;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              type?: "standard" | "icon";
              theme?: "outline" | "filled_blue" | "filled_black";
              size?: "large" | "medium" | "small";
              text?: "signin_with" | "signup_with" | "continue_with" | "signin";
              shape?: "rectangular" | "pill" | "circle" | "square";
              logo_alignment?: "left" | "center";
              width?: number;
        }) => void;
        };
      };
    };
  }
}

let googleScriptPromise: Promise<void> | null = null;
let clientIdPromise: Promise<string> | null = null;

async function getGoogleClientId(): Promise<string> {
  if (!clientIdPromise) {
    clientIdPromise = fetch("/api/auth/google/client-id", {
      method: "GET",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    }).then(async response => {
      const payload = await response.json().catch(() => null) as { clientId?: unknown; error?: { message?: unknown } } | null;
      if (!response.ok || typeof payload?.clientId !== "string" || !payload.clientId.trim()) {
        throw new Error(typeof payload?.error?.message === "string" ? payload.error.message : "Google sign-in is not configured.");
      }
      return payload.clientId.trim();
    }).catch(error => {
      clientIdPromise = null;
      throw error;
    });
  }
  return clientIdPromise;
}

function loadGoogleIdentityServices(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (googleScriptPromise) return googleScriptPromise;

  googleScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-google-identity-services="true"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Google sign-in library could not load.")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.dataset.googleIdentityServices = "true";
    script.onload = () => resolve();
    script.onerror = () => {
      googleScriptPromise = null;
      reject(new Error("Google sign-in library could not load."));
    };
    document.head.appendChild(script);
  });

  return googleScriptPromise;
}

async function generateNonce(): Promise<{ raw: string; hashed: string }> {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const raw = btoa(String.fromCharCode(...bytes));
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  const hashed = Array.from(new Uint8Array(digest))
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
  return { raw, hashed };
}

export async function renderHkTubeGoogleButton(
  container: HTMLElement,
  onBusyChange?: (busy: boolean) => void,
): Promise<() => void> {
  container.replaceChildren();
  onBusyChange?.(true);

  const [clientId, nonce] = await Promise.all([getGoogleClientId(), generateNonce()]);
  await loadGoogleIdentityServices();

  const google = window.google;
  if (!google?.accounts?.id) throw new Error("Google sign-in is unavailable right now.");

  let disposed = false;
  google.accounts.id.initialize({
    client_id: clientId,
    nonce: nonce.hashed,
    use_fedcm_for_prompt: true,
    auto_select: false,
    cancel_on_tap_outside: true,
    callback: async response => {
      if (disposed || !response.credential) return;
      onBusyChange?.(true);
      try {
        const { error } = await supabase.auth.signInWithIdToken({
          provider: "google",
          token: response.credential,
          nonce: nonce.raw,
        });
        if (error) throw error;
      } finally {
        onBusyChange?.(false);
      }
    },
  });

  google.accounts.id.renderButton(container, {
    type: "standard",
    theme: "outline",
    size: "large",
    text: "continue_with",
    shape: "pill",
    logo_alignment: "left",
    width: Math.min(400, Math.max(280, container.clientWidth || 400)),
  });

  onBusyChange?.(false);
  return () => {
    disposed = true;
    container.replaceChildren();
  };
}
