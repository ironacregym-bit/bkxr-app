
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

        if (userSnap.exists) {
          const userData = userSnap.data() ?? {}; // ✅ Safe fallback
          token.role = (userData.role as string) || "user";
          token.gym_id = (userData.gym_id as string) || null;
        } else {
          token.role = "user";
          token.gym_id = null;
        }
      }

      return token;
    },

    async session({ session, token }) {
      session.accessToken = token.accessToken as string;
      session.user.role = (token.role as string) || "user";
      session.user.gym_id = (token.gym_id as string) || null;
      return session;
    },
  },
};

export default NextAuth(authOptions);
