import { FirestoreAdapter } from "@next-auth/firebase-adapter";
import { cert } from "firebase-admin/app";
import EmailProvider from "next-auth/providers/email";
import GoogleProvider from "next-auth/providers/google";
import type { NextAuthOptions } from "next-auth";
import { firestore } from "@pt/firebase";
import { resolveSiteBuilderRedirectUrl } from "./auth-redirect";

function normalizePrivateKey(value?: string) {
  return value?.replace(/\\n/g, "\n").replace(/^"+|"+$/g, "").trim();
}

const projectId =
  process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_PROJECT_ID;
const clientEmail =
  process.env.FIREBASE_CLIENT_EMAIL || process.env.GOOGLE_CLIENT_EMAIL;
const privateKey = normalizePrivateKey(
  process.env.FIREBASE_PRIVATE_KEY || process.env.GOOGLE_PRIVATE_KEY
);

const adapter =
  projectId && clientEmail && privateKey
    ? FirestoreAdapter({
        credential: cert({ projectId, clientEmail, privateKey }),
      })
    : undefined;

const providers: NextAuthOptions["providers"] = [];
const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

if (googleClientId && googleClientSecret) {
  providers.push(
    GoogleProvider({
      clientId: googleClientId,
      clientSecret: googleClientSecret,
    })
  );
}

const emailHost = process.env.EMAIL_SERVER_HOST;
const emailUser = process.env.EMAIL_SERVER_USER;
const emailPassword = process.env.EMAIL_SERVER_PASSWORD;
const emailFrom = process.env.EMAIL_FROM;
const emailPort = Number(process.env.EMAIL_SERVER_PORT || 465);

if (
  adapter &&
  emailHost &&
  emailUser &&
  emailPassword &&
  emailFrom &&
  Number.isInteger(emailPort) &&
  emailPort > 0 &&
  emailPort <= 65535
) {
  providers.push(
    EmailProvider({
      server: {
        host: emailHost,
        port: emailPort,
        secure: emailPort === 465,
        auth: { user: emailUser, pass: emailPassword },
      },
      from: emailFrom,
    })
  );
}

const secureCookies = process.env.NODE_ENV === "production";
const cookiePrefix = `${secureCookies ? "__Secure-" : ""}sitebuilder.`;
const sharedCookieOptions = {
  sameSite: "lax" as const,
  path: "/",
  secure: secureCookies,
};
const httpOnlyCookieOptions = {
  ...sharedCookieOptions,
  httpOnly: true,
};

const siteBuilderCookies: NonNullable<NextAuthOptions["cookies"]> = {
  sessionToken: {
    name: `${cookiePrefix}session-token`,
    options: httpOnlyCookieOptions,
  },
  callbackUrl: {
    name: `${cookiePrefix}callback-url`,
    options: sharedCookieOptions,
  },
  csrfToken: {
    name: `${cookiePrefix}csrf-token`,
    options: httpOnlyCookieOptions,
  },
  pkceCodeVerifier: {
    name: `${cookiePrefix}pkce.code_verifier`,
    options: { ...httpOnlyCookieOptions, maxAge: 900 },
  },
  state: {
    name: `${cookiePrefix}state`,
    options: { ...httpOnlyCookieOptions, maxAge: 900 },
  },
  nonce: {
    name: `${cookiePrefix}nonce`,
    options: httpOnlyCookieOptions,
  },
};

export const authOptions: NextAuthOptions = {
  secret:
    process.env.SITEBUILDER_NEXTAUTH_SECRET || process.env.NEXTAUTH_SECRET,
  adapter,
  providers,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/register",
    error: "/register",
  },
  cookies: siteBuilderCookies,
  callbacks: {
    async jwt({ token }) {
      return token;
    },
    async session({ session }) {
      const email = session.user?.email?.trim().toLowerCase();
      if (!email || !session.user) return session;

      const userSnapshot = await firestore.collection("users").doc(email).get();
      const userData = userSnapshot.exists ? userSnapshot.data() ?? {} : {};
      const permissions = Array.isArray(userData.permissions)
        ? userData.permissions.filter(
            (permission): permission is string =>
              typeof permission === "string"
          )
        : userData.role === "admin"
          ? ["admin"]
          : [];

      session.user.permissions = permissions;
      return session;
    },
    async redirect({ url, baseUrl }) {
      const siteBuilderUrl =
        process.env.SITEBUILDER_URL ||
        process.env.NEXTAUTH_URL ||
        baseUrl;
      return resolveSiteBuilderRedirectUrl(url, siteBuilderUrl);
    },
  },
};
