
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
        token.accessToken = account.access_token;
      }

      if (token.email) {
        const userSnap = await firestore.collection("users").doc(token.email).get();
        const userData = userSnap.exists ? userSnap.data() ?? {} : {};
        token.role = (userData.role as string) || "user";
        token.gym_id = (userData.gym_id as string) || null;
      }

      return token;
    },

    async session({ session, token }) {
      // Ensure session.user exists before assigning
      if (session.user) {
        (session.user as any).role = (token.role as string) || "user";
        (session.user as any).gym_id = (token.gym_id as string) || null;
      }
      (session as any).accessToken = token.accessToken as string;
      return session;
    },
  },
};

export default NextAuth(authOptions);
