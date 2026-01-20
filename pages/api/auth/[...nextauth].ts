
// pages/api/auth/[...nextauth].ts
import NextAuth, { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import EmailProvider from "next-auth/providers/email";
import { FirestoreAdapter } from "@next-auth/firebase-adapter";
import { cert } from "firebase-admin/app";
import firestore from "../../../lib/firestoreClient";

const hasAll = (keys: string[]) =>
  keys.every((k) => process.env[k] && String(process.env[k]).trim() !== "");

const EMAIL_KEYS = [
  "EMAIL_SERVER_HOST",
  "EMAIL_SERVER_PORT",
  "EMAIL_SERVER_USER",
  "EMAIL_SERVER_PASSWORD",
  "EMAIL_FROM",
];
const HAVE_EMAIL = hasAll(EMAIL_KEYS);

const HAVE_SA = hasAll([
  "GOOGLE_PROJECT_ID",
  "GOOGLE_CLIENT_EMAIL",
  "GOOGLE_PRIVATE_KEY",
]);

let adapter: ReturnType<typeof FirestoreAdapter> | undefined;
try {
  if (HAVE_SA) {
    adapter = FirestoreAdapter({
      credential: cert({
        projectId: process.env.GOOGLE_PROJECT_ID,
        clientEmail: process.env.GOOGLE_CLIENT_EMAIL,
        privateKey: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      }),
    });
  } else {
    console.error(
      "[NextAuth] Missing GOOGLE_* service account envs; Email magic links need adapter."
    );
  }
} catch (e) {
  console.error("[NextAuth] Failed to init FirestoreAdapter:", e);
}

export const authOptions: NextAuthOptions = {
  adapter,

  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),

    ...(HAVE_EMAIL
      ? [
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
          }),
        ]
      : []),
  ],

  session: { strategy: "jwt" },

  pages: {
    error: "/auth/error",
  },

  callbacks: {
    // Allow switching between Google + Email without blocking
    async signIn() {
      return true;
    },

    // ✅ Ensure email lives in the JWT (then we can mirror to session)
    async jwt({ token, account, user }) {
      // Keep your access token logic
      if (account) {
        (token as any).accessToken = (account as any).access_token;
      }

      // Ensure email stored on the JWT once we have a user
      if (!token.email && user?.email) {
        token.email = user.email;
      }

      // Enrich from Firestore when we have an email
      if (token.email) {
        const snap = await firestore.collection("users").doc(token.email).get();
        const data = snap.exists ? snap.data() ?? {} : {};
        (token as any).role = (data.role as string) || "user";
        (token as any).gym_id = (data.gym_id as string) || null;
      }

      return token;
    },

    // ✅ Mirror email (and your role/gym fields) onto the session
    async session({ session, token }) {
      if (session.user) {
        // Ensure email is present on session.user
        (session.user as any).email =
          (session.user as any).email || (token.email as string) || null;

        // Keep your enrichment
        (session.user as any).role = ((token as any).role as string) || "user";
        (session.user as any).gym_id =
          ((token as any).gym_id as string) || null;
      }

      // Keep your access token exposure
      (session as any).accessToken = (token as any).accessToken as string;

      return session;
    },

    async redirect({ url, baseUrl }) {
      try {
        const u = new URL(url, baseUrl);
        if (u.origin === baseUrl) return u.href;
      } catch {
        if (url.startsWith("/")) return `${baseUrl}${url}`;
      }
      return `${baseUrl}/`;
    },
  },

  events: {
    async createUser({ user }) {
      try {
        if (!user?.email) return;
        const ref = firestore.collection("users").doc(user.email);
        const snap = await ref.get();
        const nowIso = new Date().toISOString();

        if (!snap.exists) {
          // Initialise a 14-day trial for new users
          const now = new Date();
          const trialDays = 14;
          const trialEnd = new Date(
            now.getTime() + trialDays * 86400000
          ).toISOString();

          await ref.set(
            {
              email: user.email,
              name: user.name || "",
              image: user.image || "",
              created_at: nowIso,
              last_login_at: nowIso,
              role: "user",
              // trial init (only if missing)
              trial_start: now.toISOString(),
              trial_end: trialEnd,
              subscription_status: "trialing",
              is_premium: true, // in-app unlock during trial
            },
            { merge: true }
          );
        } else {
          // One-time safety: add a trial if doc exists but has no status
          const data = snap.data() || {};
          if (!data.trial_end && !data.subscription_status) {
            const now = new Date();
            const trialDays = 14;
            const trialEnd = new Date(
              now.getTime() + trialDays * 86400000
            ).toISOString();
            await ref.set(
              {
                trial_start: now.toISOString(),
                trial_end: trialEnd,
                subscription_status: "trialing",
                is_premium: true,
              },
              { merge: true }
            );
          }
          await ref.set({ last_login_at: nowIso }, { merge: true });
        }
      } catch (e) {
        console.error("[NextAuth events.createUser] sync failed:", e);
      }
    },

    async signIn({ user }) {
      try {
        if (user?.email) {
          await firestore
            .collection("users")
            .doc(user.email)
            .set(
              { last_login_at: new Date().toISOString() },
              { merge: true }
            );
        }
      } catch (e) {
        console.error(
          "[NextAuth events.signIn] update last_login_at failed:",
          e
        );
      }
    },
  },
};

export default NextAuth(authOptions);
