
// pages/api/auth/[...nextauth].ts
import NextAuth, { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import firestore from "../../../lib/firestoreClient";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
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
  },
};

// ✅ Required: default export of the NextAuth handler
export default NextAuth(authOptions);
