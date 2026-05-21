// File: pages/sitebuilder/[siteId].tsx
import Head from "next/head";
import type { GetServerSideProps } from "next";
import { getSession } from "next-auth/react";
import SiteEditor from "../../SiteBuilder/components/SiteEditor";

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getSession(context);
  if (!session) {
    const callbackUrl = encodeURIComponent(context.resolvedUrl || "/sitebuilder");
    return {
      redirect: { destination: `/register?callbackUrl=${callbackUrl}`, permanent: false },
    };
  }
  return { props: {} };
};

export default function SiteBuilderSitePage() {
  return (
    <>
      <Head>
        <title>SiteBuilder | Edit</title>
        <meta name="robots" content="noindex" />
      </Head>
      <SiteEditor />
    </>
  );
}
