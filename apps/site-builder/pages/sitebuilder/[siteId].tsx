import Head from "next/head";
import type { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import SiteEditor from "../../components/sitebuilder/SiteEditor";

export const getServerSideProps: GetServerSideProps = async (
  context
) => {
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
