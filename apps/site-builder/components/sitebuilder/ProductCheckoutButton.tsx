import { useState } from "react";
import { Button } from "@/components/ui/button";

export default function ProductCheckoutButton({
  slug,
  productId,
}: {
  slug: string;
  productId: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function checkout() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/sitebuilder/payments/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ slug, productId }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.ok || typeof result.url !== "string") {
        setError("Checkout is temporarily unavailable. Please try again later.");
        return;
      }
      window.location.assign(result.url);
    } catch {
      setError("Could not start checkout. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button type="button" className="w-full" onClick={checkout} disabled={busy}>
        {busy ? "Opening secure checkout…" : "Buy now"}
      </Button>
      {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
