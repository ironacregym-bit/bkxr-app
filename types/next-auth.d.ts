import NextAuth, { DefaultSession, DefaultUser } from "next-auth";

declare module "next-auth" {
  interface User extends DefaultUser {
    role?: string;
    gym_id?: string | null;
  }

  interface Session extends DefaultSession {
    accessToken?: string;
    user?: {
      role?: string;
      gym_id?: string | null;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    role?: string;
    gym_id?: string | null;
  }
}