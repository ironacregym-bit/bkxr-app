
import NextAuth, { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import firestore from "../../../lib/firestoreClient"; // Firestore client for role lookup

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],

  session: { strategy: "jwt" },

  callbacks: {
    // Enrich JWT with role and gym_id from Firestore
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token;
      }

      // Lookup user in Firestore to get role and gym_id
      if (token.email) {
        const userSnap = await firestore.collection("users").doc(token.email).get();
        if (userSnap.exists) {
          const userData = userSnap.data();
          token.role = userData.role || "user";
          token.gym_id = userData.gym_id || null;
        } else {
          // Default role if user not found
          token.role = "user";
          token.gym_id = null;
        }
      }

      return token;
    },

    // Add role and gym_id to session object
    async session({ session, token }) {
      session.accessToken = token.accessToken as string;
      session.user.role = token.role as string;
      session.user.gym_id = token.gym_id as string | null;
      return session;
    },
  },
};

export default NextAuth(authOptions);
