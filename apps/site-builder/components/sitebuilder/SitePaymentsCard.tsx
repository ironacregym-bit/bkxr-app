import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, CircleAlert, LoaderCircle, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import CollapsiblePanel from "./CollapsiblePanel";

type PaymentProduct = {
  id: string;
  name: string;
  description: string;
  amountMinor: number;
  currency: "gbp" | "eur" | "usd";
  active: boolean;
};

type StripeStatus = {
  configured: boolean;
  connected: boolean;
  detailsSubmitted: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
};

function messageFor(error: string) {
  const messages: Record<string, string> = {
    FORBIDDEN: "Only the site owner can manage Stripe payments.",
    STRIPE_CONNECT_FAILED: "Could not open Stripe onboarding. Check the Stripe configuration and try again.",
    PAYMENTS_STATUS_FAILED: "Could not check the Stripe account status.",
    PAYMENT_PRODUCTS_FAILED: "Could not save your payment products.",
    STRIPE_ACCOUNT_NOT_CONNECTED: "Connect a Stripe account before enabling payments.",
    STRIPE_ACCOUNT_NOT_READY: "Finish Stripe onboarding and enable card payments before enabling products.",
    INVALID_REQUEST: "Check the product details and try again.",
  };
  return messages[error] || "A payment settings request failed. Please try again.";
}

function newProduct(): PaymentProduct {
  return {
    id: `product_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    name: "",
    description: "",
    amountMinor: 1000,
    currency: "gbp",
    active: true,
  };
}

export default function SitePaymentsCard({ siteId, active }: { siteId: string; active: boolean }) {
  const [status, setStatus] = useState<StripeStatus | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [products, setProducts] = useState<PaymentProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const [statusResponse, productsResponse] = await Promise.all([
        fetch(`/api/sitebuilder/payments/status?siteId=${encodeURIComponent(siteId)}`, { cache: "no-store" }),
        fetch(`/api/sitebuilder/payments/products?siteId=${encodeURIComponent(siteId)}`, { cache: "no-store" }),
      ]);
      const [statusResult, productsResult] = await Promise.all([
        statusResponse.json().catch(() => null),
        productsResponse.json().catch(() => null),
      ]);
      if (!statusResponse.ok || !statusResult?.ok) {
        setMessage(messageFor(String(statusResult?.error || "PAYMENTS_STATUS_FAILED")));
        return;
      }
      if (!productsResponse.ok || !productsResult?.ok) {
        setMessage(messageFor(String(productsResult?.error || "PAYMENT_PRODUCTS_FAILED")));
        return;
      }
      setStatus(statusResult);
      setEnabled(Boolean(productsResult.enabled));
      setProducts(Array.isArray(productsResult.products) ? productsResult.products : []);
      setHasLoaded(true);
    } catch {
      setMessage("Could not load Stripe settings. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [siteId]);

  useEffect(() => {
    setStatus(null);
    setEnabled(false);
    setProducts([]);
    setLoading(true);
    setHasLoaded(false);
  }, [siteId]);

  useEffect(() => {
    if (active && !hasLoaded) void refresh();
  }, [active, hasLoaded, refresh]);

  async function connectStripe() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/sitebuilder/payments/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ siteId }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.ok) {
        setMessage(messageFor(String(result?.error || "STRIPE_CONNECT_FAILED")));
        return;
      }
      if (result.url) {
        window.location.assign(result.url);
        return;
      }
      await refresh();
      setMessage("Your Stripe account is connected and ready to accept payments.");
    } catch {
      setMessage("Could not connect Stripe. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function saveProducts() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/sitebuilder/payments/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ siteId, enabled, products }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.ok) {
        setMessage(messageFor(String(result?.error || "PAYMENT_PRODUCTS_FAILED")));
        return;
      }
      setEnabled(Boolean(result.enabled));
      setProducts(Array.isArray(result.products) ? result.products : []);
      setMessage("Payment products saved.");
    } catch {
      setMessage("Could not save payment products. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function updateProduct(id: string, patch: Partial<PaymentProduct>) {
    setProducts((current) => current.map((product) => product.id === id ? { ...product, ...patch } : product));
  }

  if (active && loading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border p-4 text-sm text-muted-foreground">
        <LoaderCircle className="h-4 w-4 animate-spin" />
        Loading Stripe settings…
      </div>
    );
  }

  if (active && message?.includes("Only the site owner")) {
    return <p role="status" className="rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground">{message}</p>;
  }

  return (
    <div className="space-y-5">
      {message ? (
        <div role="status" className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          {message}
        </div>
      ) : null}

      <CollapsiblePanel
        title="Stripe account"
        description="Connect the business’s Stripe account. Payments go directly to that connected account."
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            {status?.connected ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-500" />
            ) : (
              <CircleAlert className="mt-0.5 h-5 w-5 text-amber-500" />
            )}
            <div>
              <div className="font-medium">
                {status?.connected ? "Connected and ready" : "Stripe setup required"}
              </div>
              <div className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {!status?.configured
                  ? "Payments are not available until Stripe is configured for this SiteBuilder deployment."
                  : status?.connected
                    ? status.payoutsEnabled
                      ? "Charges and payouts are enabled for this account."
                      : "Charges are enabled. Finish payout details in Stripe to receive transfers."
                    : status?.detailsSubmitted
                      ? "Stripe is reviewing or still needs details for this account."
                      : "Complete Stripe’s secure onboarding to accept payments."}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={connectStripe} disabled={busy || !status?.configured}>
              {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
              {status?.connected ? "Manage Stripe" : "Connect Stripe"}
            </Button>
            <Button variant="outline" onClick={refresh} disabled={busy}>
              Refresh status
            </Button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge variant={status?.chargesEnabled ? "default" : "secondary"}>Payments {status?.chargesEnabled ? "enabled" : "not enabled"}</Badge>
          <Badge variant={status?.payoutsEnabled ? "default" : "secondary"}>Payouts {status?.payoutsEnabled ? "enabled" : "pending"}</Badge>
        </div>
      </CollapsiblePanel>

      <CollapsiblePanel
        title="Products and pricing"
        description="Create one-time products or services. Amounts and currency are saved server-side and used to create each checkout."
      >
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/20 p-4">
          <div>
            <div className="font-medium">Accept payments on this site</div>
            <div className="mt-1 text-sm text-muted-foreground">Only active products appear on the published site.</div>
          </div>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              className="h-4 w-4 accent-primary"
              checked={enabled}
              onChange={(event) => setEnabled(event.target.checked)}
            />
            Enabled
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm font-semibold">Sellable products</div>
          <Button type="button" variant="outline" size="sm" onClick={() => setProducts((current) => [...current, newProduct()])}>
            <Plus className="h-4 w-4" />
            Add product
          </Button>
        </div>

        {products.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            No products yet. Add a product or service to start accepting payments.
          </div>
        ) : (
          <div className="space-y-4">
            {products.map((product, index) => (
              <div key={product.id} className="space-y-4 rounded-xl border border-border bg-muted/20 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-semibold">Product {index + 1}</div>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-sm text-muted-foreground">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-primary"
                        checked={product.active}
                        onChange={(event) => updateProduct(product.id, { active: event.target.checked })}
                      />
                      Active
                    </label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove product ${index + 1}`}
                      onClick={() => setProducts((current) => current.filter((item) => item.id !== product.id))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <label className="grid gap-2 text-sm font-medium">
                  Product or service name
                  <Input maxLength={100} value={product.name} onChange={(event) => updateProduct(product.id, { name: event.target.value })} placeholder="e.g. Initial consultation" />
                </label>
                <label className="grid gap-2 text-sm font-medium">
                  Description
                  <Textarea maxLength={500} rows={2} value={product.description} onChange={(event) => updateProduct(product.id, { description: event.target.value })} placeholder="A short description shown during checkout" />
                </label>
                <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_10rem]">
                  <label className="grid gap-2 text-sm font-medium">
                    Price
                    <Input
                      type="number"
                      min="0.50"
                      max="1000000"
                      step="0.01"
                      value={(product.amountMinor / 100).toFixed(2)}
                      onChange={(event) => {
                        const amount = Number(event.target.value);
                        updateProduct(product.id, {
                          amountMinor: Number.isFinite(amount) ? Math.max(0, Math.round(amount * 100)) : 0,
                        });
                      }}
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-medium">
                    Currency
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={product.currency}
                      onChange={(event) => updateProduct(product.id, { currency: event.target.value as PaymentProduct["currency"] })}
                    >
                      <option value="gbp">GBP (£)</option>
                      <option value="eur">EUR (€)</option>
                      <option value="usd">USD ($)</option>
                    </select>
                  </label>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <p className="max-w-xl text-xs leading-relaxed text-muted-foreground">
            Stripe Checkout securely collects payment details. SiteBuilder does not store card numbers or Stripe secret keys.
          </p>
          <Button onClick={saveProducts} disabled={busy}>
            {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
            Save payment settings
          </Button>
        </div>
      </CollapsiblePanel>
    </div>
  );
}
