import NextAuth, { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import EmailProvider from "next-auth/providers/email";

export const authOptions: NextAuthOptions = {
  providers: [
    // Google sign-in (already working in your app)
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),

    // Email (magic link) via Gmail SMTP
    EmailProvider({
      server: {
        host: process.env.EMAIL_SERVER_HOST,            // smtp.gmail.com
        port: Number(process.env.EMAIL_SERVER_PORT),    // 587
        auth: {
          user: process.env.EMAIL_SERVER_USER,          // yourgmail@gmail.com
          pass: process.env.EMAIL_SERVER_PASSWORD,      // Gmail App Password (not your normal password)
        },
      },
      from: process.env.EMAIL_FROM,                     // yourgmail@gmail.com or a branded address
      // Optional: customise email subject and text
      // async sendVerificationRequest({ identifier, url, provider }) { ... }
    }),
  ],

  // Optional: session/jwt settings (defaults are fine for MVP)
  session: { strategy: "jwt" },

  // Optional: pages override if you create a custom sign-in page
  // pages: { signIn: "/auth/signin" },

  // Optional: callbacks (e.g., enrich token/session)
  // callbacks: {
  //   async session({ session, token }) {
  //     // Example: attach token sub to session
  //     return session;
  //   },
  // },
};

export default NextAuth(authOptions);
