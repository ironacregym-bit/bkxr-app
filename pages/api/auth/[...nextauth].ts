
// pages/api/auth/[...nextauth].ts
import NextAuth, { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import EmailProvider from "next-auth/providers/email";
import { FirestoreAdapter } from "@next-auth/firebase-adapter";
import { cert } from "firebase-admin/app";
import firestore from "../../../lib/firestoreClient";

// Helper: check required envs exist (non-empty)
const hasAll = (keys: string[]) =>
  keys.every((k) => process.env[k] && String(process.env[k]).trim() !== "");

// SMTP envs for Email provider (Gmail or other SMTP)
const EMAIL_KEYS = [
  "EMAIL_SERVER_HOST",
  "EMAIL_SERVER_PORT",
  "EMAIL_SERVER_USER",
  "EMAIL_SERVER_PASSWORD",
  "EMAIL_FROM",
];
const HAVE_EMAIL = hasAll(EMAIL_KEYS);

// Service Account envs for Firestore adapter (required for Email)
const HAVE_SA = hasAll(["GOOGLE_PROJECT_ID", "GOOGLE_CLIENT_EMAIL", "GOOGLE_PRIVATE_KEY"]);

// Initialise adapter only when service account envs are valid
let adapter: ReturnType<typeof FirestoreAdapter> | undefined;
try {
  if (HAVE_SA) {
    adapter = FirestoreAdapter({
      credential: cert({
        projectId: process.env.GOOGLE_PROJECT_ID,
        clientEmail: process.env.GOOGLE_CLIENT_EMAIL,
        // Vercel env must store \n as escaped; we convert to real newlines here
        privateKey: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      }),
      // You can customise collection names if you want:
      // collections: {
      //   users: "auth_users",
      //   accounts: "auth_accounts",
      //   sessions: "auth_sessions",
      //   verificationTokens: "auth_verificationTokens",
      // },
    });
  } else {
    console.error("[NextAuth] Missing GOOGLE_* service account envs; Email magic links need adapter.");
  }
} catch (e) {
  console.error("[NextAuth] Failed to init FirestoreAdapter:", e);
}

export const authOptions: NextAuthOptions = {
  // Email requires an adapter; Google can work without it
  adapter,

  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),

    // Enable Email only if SMTP envs are present
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
              // 465 → SSL (secure), 587 → STARTTLS (not secure flag)
              secure: String(process.env.EMAIL_SERVER_PORT ?? "465") === "465",
            },
            from: process.env.EMAIL_FROM,
            // Optional: customise link lifetime
            // maxAge: 24 * 60 * 60, // default 24h
            //
            // Optional: brand the email with custom content
            // sendVerificationRequest: async ({ identifier, url, provider }) => {
            //   // You can format a branded email here using nodemailer if desired
            // },
          }),
        ]
      : []),
  ],

  session: { strategy: "jwt" },

  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        (token as any).accessToken = (account as any).access_token;
      }

      // Enrich token with role/gym_id from canonical `users`
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

    async redirect({ url, baseUrl }) {
      // Safety: allow same-origin URLs; fallback to "/"
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
    // v4 events receive { user } payload object
    async createUser({ user }) {
      try {
        if (!user?.email) return;
        const ref = firestore.collection("users").doc(user.email);
        const snap = await ref.get();
        const nowIso = new Date().toISOString();

        if (!snap.exists) {
          await ref.set(
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
            .set({ last_login_at: new Date().toISOString() }, { merge: true });
        }
      } catch (e) {
        console.error("[NextAuth events.signIn] update last_login_at failed:", e);
      }
    },
  },
};
