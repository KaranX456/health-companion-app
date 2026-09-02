import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
// Routed through a Cloudflare Worker proxy instead of hitting Supabase's
// domain directly -- some networks (e.g. university WiFi) filter/block
// less-common backend domains like *.supabase.co while ordinary browsing
// works fine. Cloudflare's own domain is essentially never blocked.
const CONFIRM_PROXY_URL = "https://ai-health-proxy.gnkpkch.workers.dev";

type ConfirmStatus = "confirmed" | "already_confirmed" | "invalid" | "expired" | "error";

type ConfirmResponse = {
  status: ConfirmStatus;
  message: string;
  drugName?: string;
  confirmedAt?: string;
};

export const Route = createFileRoute("/confirm-medication")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search["token"] === "string" ? (search["token"] as string) : "",
  }),
  head: () => ({
    meta: [
      { title: "Confirm your dose — AI Health Companion" },
      { name: "description", content: "One-click confirmation that you took your scheduled medication." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Confirm your dose — AI Health Companion" },
      {
        property: "og:description",
        content: "One-click confirmation that you took your scheduled medication.",
      },
    ],
  }),
  component: ConfirmMedicationPage,
});

function ConfirmMedicationPage() {
  const { token } = Route.useSearch();
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<ConfirmResponse | null>(null);

  const run = useCallback(async () => {
    setLoading(true);
    if (!token) {
      setResult({ status: "invalid", message: "This confirmation link is missing its token." });
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(
        `${CONFIRM_PROXY_URL}/functions/v1/confirm-medication-reminder?token=${encodeURIComponent(token)}`,
      );
      const json = (await res.json()) as ConfirmResponse;
      setResult(json);
    } catch {
      setResult({ status: "error", message: "We couldn't reach the server. Please try again." });
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void run();
  }, [run]);

  if (loading) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-background">
        <Loader2 className="size-8 animate-spin text-muted-foreground" aria-label="Confirming" />
      </main>
    );
  }

  const status = result?.status ?? "error";
  const ok = status === "confirmed" || status === "already_confirmed";

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-3 bg-background px-6 text-center">
      {ok ? (
        <>
          <CheckCircle2 className="size-22 text-primary" strokeWidth={1.5} aria-hidden />
          <h1 className="text-4xl font-semibold tracking-tight">Logged!</h1>
          <p className="text-muted-foreground">
            You&apos;ve confirmed {result?.drugName ?? "your medication"}
          </p>
        </>
      ) : status === "invalid" || status === "expired" ? (
        <>
          <XCircle className="size-22 text-muted-foreground" strokeWidth={1.5} aria-hidden />
          <h1 className="text-3xl font-semibold tracking-tight">
            {status === "expired" ? "Link expired" : "Invalid link"}
          </h1>
          <p className="max-w-sm text-muted-foreground">{result?.message}</p>
        </>
      ) : (
        <>
          <XCircle className="size-22 text-muted-foreground" strokeWidth={1.5} aria-hidden />
          <h1 className="text-3xl font-semibold tracking-tight">Something went wrong</h1>
          <p className="max-w-sm text-muted-foreground">{result?.message}</p>
          <Button className="mt-2 rounded-xl" onClick={() => void run()}>
            Try again
          </Button>
        </>
      )}
    </main>
  );
}
