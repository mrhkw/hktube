import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    // The browser sends the current Supabase access token as a Bearer token.
    // If an older HkTube HttpOnly cookie is also present, it must not shadow
    // the fresh bearer session (otherwise an expired cookie can make a valid
    // Supabase session look logged out).
    const authHeader = opts.req.headers.authorization;
    const hasBearer = typeof authHeader === "string" && authHeader.startsWith("Bearer ");
    if (hasBearer) {
      const cookie = opts.req.headers.cookie;
      opts.req.headers.cookie = undefined;
      try {
        user = await sdk.authenticateRequest(opts.req);
      } finally {
        opts.req.headers.cookie = cookie;
      }
    } else {
      user = await sdk.authenticateRequest(opts.req);
    }
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
