
import NextAuth, { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import EmailProvider from "next-auth/providers/email";
import { FirestoreAdapter } from "@next-auth/firebase-adapter"; // <- v4 adapter
import { cert } from "firebase-admin/app";
import firestore from "../../../lib/firestoreClient";

export const authOptions: NextAuthOptions = {
  // NextAuth v4 + Firestore adapter (stores users/accounts/sessions/verificationTokens for Email magic links)
  adapter: FirestoreAdapter({
    credential: cert({
      projectId: process.env.GOOGLE_PROJECT_ID,
      clientEmail: process.env.GOOGLE_CLIENT_EMAIL,
      privateKey: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
    // You can leave default collection names or customise via `collections: {...}`
  }),

  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),

    // Email magic links via Gmail SMTP (requires Gmail App Password)
    EmailProvider({
      server: {
        host: process.env.EMAIL_SERVER_HOST,
        port: Number(process.env.EMAIL_SERVER_PORT ?? 465),
        auth: {
          user: process.env.EMAIL_SERVER_USER,
          pass: process.env.EMAIL_SERVER_PASSWORD,
        },
        secure: String(process.env.EMAIL_SERVER_PORT ?? "465") === "465", // 465 = SSL
      },
      from: process.env.EMAIL_FROM,
      // maxAge: 24 * 60 * 60, // default 24h
    }),
  ],

  session: { strategy: "jwt" },

  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        (token as any).accessToken = (account as any).access_token;
      }
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
    async createUser(user) {
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
            .set({ last_login_at: new Date().toISOString()            .set({ last_login_at: new Date().toISOString() }, { merge: true });
        }
      } catch (e) {
        console.error("[NextAuth events.signIn] update last_login_at failed:", e);
      }
    },
  },
};

