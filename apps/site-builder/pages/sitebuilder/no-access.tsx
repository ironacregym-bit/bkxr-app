import Head from "next/head";

export default function SiteBuilderNoAccessPage() {
  return (
    <>
      <Head>
        <title>Access unavailable | SiteBuilder</title>
        <meta name="robots" content="noindex" />
      </Head>
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
        <h1 className="text-2xl font-semibold">SiteBuilder access required</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          Your account does not have permission to manage SiteBuilder sites.
        </p>
      </main>
    </>
  );
}
