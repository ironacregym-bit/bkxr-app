import Head from "next/head";
import { getServerSession } from "next-auth";
import type { GetServerSideProps } from "next";
import { authOptions } from "@/lib/auth";
import BuilderDashboard from "../../components/sitebuilder/BuilderDashboard";

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);

  if (!session) {
    const callbackUrl = encodeURIComponent(
      context.resolvedUrl || "/sitebuilder"
    );

    return {
      redirect: {
        destination: `/register?callbackUrl=${callbackUrl}`,
        permanent: false,
      },
    };
  }

  const permissions =
    ((session.user as any)?.permissions as string[]) || [];

  const hasSiteBuilderAccess =
    permissions.includes("sitebuilder") ||
    permissions.includes("admin");

  if (!hasSiteBuilderAccess) {
    return {
      redirect: {
        destination: "/sitebuilder/no-access",
        permanent: false,
      },
    };
  }

  return {
    props: {},
  };
};

export default function SiteBuilderDashboardPage() {
  return (
    <>
      <Head>
        <title>SiteBuilder</title>
        <meta name="robots" content="noindex" />
      </Head>
      <BuilderDashboard />
    </>
  );
}
