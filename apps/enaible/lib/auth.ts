import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { createEnaibleAuthAdapter } from "./enaible-auth-adapter";

const enaibleOrigin =
  process.env.ENAIBLE_URL ||
  process.env.NEXTAUTH_URL ||
  (process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : process.env.NODE_ENV === "production"
      ? undefined
      : "http://localhost:3003");

if (enaibleOrigin) {
  process.env.NEXTAUTH_URL = enaibleOrigin;
  process.env.NEXTAUTH_URL_INTERNAL = enaibleOrigin;
}

const providers: NextAuthOptions["providers"] = [];
const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

if (googleClientId && googleClientSecret) {
  providers.push(
    GoogleProvider({
      clientId: googleClientId,
      clientSecret: googleClientSecret,
      // Google verification lets legacy profiles retain their tenant IDs.
      allowDangerousEmailAccountLinking: true,
      authorization: {
        params: { prompt: "select_account" },
      },
    })
  );
}

const secureCookies = process.env.NODE_ENV === "production";
const cookiePrefix = `${secureCookies ? "__Secure-" : ""}enaible.`;
const sharedCookieOptions = {
  sameSite: "lax" as const,
  path: "/",
  secure: secureCookies,
};
const httpOnlyCookieOptions = {
  ...sharedCookieOptions,
  httpOnly: true,
};

const enaibleCookies: NonNullable<NextAuthOptions["cookies"]> = {
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
    process.env.ENAIBLE_NEXTAUTH_SECRET || process.env.NEXTAUTH_SECRET,
  adapter: createEnaibleAuthAdapter(),
  providers,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  cookies: enaibleCookies,
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) session.user.id = token.sub;
      return session;
    },
  },
};
