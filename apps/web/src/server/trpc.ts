import "server-only";
import { appRouter } from "@heatflow/api";
import { createContext } from "@heatflow/api/context";
import { cache } from "react";

/** Server-side tRPC caller for use in React Server Components. */
export const getTrpcCaller = cache(async () => {
  const ctx = await createContext({ req: null });
  return appRouter.createCaller(ctx);
});

export type TrpcCaller = Awaited<ReturnType<typeof getTrpcCaller>>;
