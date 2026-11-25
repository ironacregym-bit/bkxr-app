import type { GetServerSideProps } from "next";
import Head from "next/head";
import Link from "next/link";
import { z } from "zod";
import { firestore } from "@pt/firebase";
import { getSiteBuilderStripe } from "@/lib/sitebuilder/stripe";

type Props = {
  siteName: string;
  paid: boolean;
  siteSlug: string;
};

const sessionIdSchema = z.string().regex(/^cs_(test|live)_[a-zA-Z0-9]+$/);

export const getServerSideProps: GetServerSideProps<Props> = async (context) => {
  const siteSlug = String(context.params?.slug || "").toLowerCase().trim();
  const sessionId = sessionIdSchema.safeParse(context.query.session_id);
  if (!siteSlug || !sessionId.success) return { notFound: true };

  try {
    const slugSnapshot = await firestore.collection("sitebuilder_slugs").doc(siteSlug).get();
    if (!slugSnapshot.exists) return { notFound: true };
    const siteId = String(slugSnapshot.data()?.siteId || "");
    if (!siteId) return { notFound: true };

    const siteSnapshot = await firestore.collection("sitebuilder_sites").doc(siteId).get();
    if (!siteSnapshot.exists) return { notFound: true };
    const site = siteSnapshot.data() || {};
    if (site.tenantId !== siteId) return { notFound: true };
    const accountId = String(site.payments?.stripeAccountId || "");
    if (!accountId) return { notFound: true };

    const checkout = await getSiteBuilderStripe().checkout.sessions.retrieve(
      sessionId.data,
      {},
      { stripeAccount: accountId }
    );
    const paid =
      checkout.payment_status === "paid" &&
      checkout.metadata?.siteId === siteId &&
      checkout.metadata?.siteSlug === siteSlug;

    return {
      props: {
        siteName: String(site.brand?.name || "the site"),
        paid,
        siteSlug,
      },
    };
  } catch (error) {
    console.error("[sitebuilder/payments/success] verification failed:", error);
    return { notFound: true };
  }
};

export default function PaymentSuccessPage({ siteName, paid, siteSlug }: Props) {
  return (
    <>
      <Head>
        <title>{paid ? "Payment confirmed" : "Payment not confirmed"} | {siteName}</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>
      <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12 text-foreground">
        <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-2xl text-primary">
            {paid ? "✓" : "!"}
          </div>
          <h1 className="mt-5 text-2xl font-semibold">
            {paid ? "Payment confirmed" : "Payment not confirmed"}
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {paid
              ? `Your payment to ${siteName} was successful.`
              : "We could not verify this payment. If you completed checkout, contact the site owner before trying again."}
          </p>
          <Link className="mt-6 inline-flex min-h-10 items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground" href={`/p/${encodeURIComponent(siteSlug)}`}>
            Return to site
          </Link>
        </div>
      </main>
    </>
  );
}
