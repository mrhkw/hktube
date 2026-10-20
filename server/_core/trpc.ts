import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import { canUseAdminProcedures } from "./adminIdentity";
import { isOwnerEmail } from "./env";
import { hasVerifiedSecondFactor, MFA_REQUIRED_MESSAGE } from "./securityAssurance";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

export const mfaProtectedProcedure = t.procedure.use(requireUser).use(
  t.middleware(async opts => {
    const { ctx, next } = opts;
    if (!ctx.user || !hasVerifiedSecondFactor(ctx.user)) {
      throw new TRPCError({ code: "FORBIDDEN", message: MFA_REQUIRED_MESSAGE });
    }
    return next();
  }),
);

export const sessionProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;
    if (!ctx.user) {
      throw new TRPCError({ code: "FORBIDDEN", message: UNAUTHED_ERR_MSG });
    }
    return next({ ctx: { ...ctx, user: ctx.user } });
  }),
);

export const mfaSessionProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;
    if (!ctx.user) throw new TRPCError({ code: "FORBIDDEN", message: UNAUTHED_ERR_MSG });
    if (!hasVerifiedSecondFactor(ctx.user)) throw new TRPCError({ code: "FORBIDDEN", message: MFA_REQUIRED_MESSAGE });
    return next({ ctx: { ...ctx, user: ctx.user } });
  }),
);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    const ownerOpenId = process.env.OWNER_OPEN_ID ?? "";
    if (!ctx.user) {
      throw new TRPCError({ code: "FORBIDDEN", message: UNAUTHED_ERR_MSG });
    }
    if (!hasVerifiedSecondFactor(ctx.user)) {
      throw new TRPCError({ code: "FORBIDDEN", message: MFA_REQUIRED_MESSAGE });
    }
    if (ctx.user.role !== "admin" || (!isOwnerEmail(ctx.user.email) && !(ownerOpenId && ctx.user.openId === ownerOpenId)) || !canUseAdminProcedures(ctx.user)) {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);
