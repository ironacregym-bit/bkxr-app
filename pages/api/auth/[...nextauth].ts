
import NextAuth, { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import EmailProvider from "next-auth/providers/email";
import { FirestoreAdapter } from "@auth/firebase-adapter";
import { cert } from "firebase-admin/app";
import firestore from "../../../lib/firestoreClient";

export const authOptions: NextAuthOptions = {
  /**
   * Adapter for Email magic links: stores users/accounts/sessions/verificationTokens.
   * We place these in separate auth_* collections so your canonical `users` stays untouched.
   */
  adapter: FirestoreAdapter({
    credential: cert({
      projectId: process.env.GOOGLE_PROJECT_ID,
      clientEmail: process.env.GOOGLE_CLIENT_EMAIL,
      privateKey: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
    collections: {
      users: "auth_users",
      accounts: "auth_accounts",
      sessions: "auth_sessions",
      verificationTokens: "auth_verificationTokens",
    },
  }),

  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),

    /**
     * Email provider via SMTP (works great with Resend SMTP, SendGrid SMTP, Postmark SMTP, etc.)
     * Make sure the EMAIL_* env vars are set (see checklist below).
     */
    EmailProvider({
      server: {
        host: process.env.EMAIL_SERVER_HOST,
        port: Number(process.env.EMAIL_SERVER_PORT ?? 465),
        auth: {
          user: process.env.EMAIL_SERVER_USER,
          pass: process.env.EMAIL_SERVER_PASSWORD,
        },
        secure: String(process.env.EMAIL_SERVER_PORT ?? "465") === "465",
      },
      from: process.env.EMAIL_FROM,
      // maxAge: 24 * 60 * 60, // default 24h; adjust if you need shorter magic link lifetime
    }),
  ],

  session: { strategy: "jwt" },

  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        // Keep your previous behaviour for Google OAuth access token
        (token as any).accessToken = (account as any).access_token;
      }

      // Enrich token with role/gym_id from your canonical `users` collection
      if (token.email) {
        const userSnap = await firestore.collection("users").doc(token.email).get();
        const userData = userSnap.exists ? userSnap.data() ?? {} : {};
        (token as any).role = (userData.role as string) || "user";
        (token as any).gym_id = (userData.gym_id as string) || null;
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        (session.user as any).role = ((token as any).role as string) || "user";
        (session.user as any).gym_id = ((token as any).gym_id as string) || null;
      }
      (session as any).accessToken = (token as any).accessToken as string;
      return session;
    },

    /**
     * Optional: ensure we land on "/" unless a valid same-origin callbackUrl is provided.
     * Your UI already passes callbackUrl: "/", so this is mostly a safety net.
     */
    async redirect({ url, baseUrl }) {
      try {
        const u = new URL(url, baseUrl);
        if (u.origin === baseUrl) return u.href;
      } catch {
        // url might be relative like "/"
        if (url.startsWith("/")) return `${baseUrl}${url}`;
      }
      return `${baseUrl}/`;
    },
  },

  /**
   * Keep your canonical `users` in sync on account creation and sign-ins.
   * These events fire when the adapter creates a user (first time) and on every sign-in.
   */
  events: {
    async createUser(user) {
      try {
        if (!user?.email) return;
        const userRef = firestore.collection("users").doc(user.email);
        const snap = await userRef.get();
        const nowIso = new Date().toISOString();

        if (!snap.exists) {
          await userRef.set(
            {
              email: user.email,
              name: user.name || "",
              image: user.image || "",
              created_at: nowIso,
              last_login_at: nowIso,
              role: "user",
            },
            { merge: true }
          );
        } else {
          await userRef.set({ last_login_at: nowIso }, { merge: true });
        }
      } catch (e) {
        console.error("[NextAuth events.createUser] failed to sync canonical users:", e);
      }
    },

    async signIn({ user }) {
      try {
        if (user?.email) {
          await firestore.collection("users").doc(user.email).set(
            { last_login_at: new Date().toISOString() },
            { merge: true }
          );
        }
      } catch (e) {
        console.error("[NextAuth events.signIn] failed to update last_login        console.error("[NextAuth events.signIn] failed to update last_login_at:", e);
      }
    },
  },
};
