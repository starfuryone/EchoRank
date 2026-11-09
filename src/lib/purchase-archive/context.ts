// src/lib/purchase-archive/context.ts — who a provider call is for.
//
// The DataForSEO client's single fetch is where every purchase is captured, but
// it is called with a path and a task, not a tenant. The metered entry points
// (meteredCallResult, the AI meter) know the tenant and the purpose, and run
// the call inside runWithPurchaseContext(); AsyncLocalStorage carries it down to
// the capture. A call made outside any context is archived with tenantId null
// (the writer then looks the task id up in the metering tables).

import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";

export interface PurchaseContext {
  tenantId: string | null;
  purpose: string;
}

const store = new AsyncLocalStorage<PurchaseContext>();

export function runWithPurchaseContext<T>(ctx: PurchaseContext, fn: () => T): T {
  return store.run(ctx, fn);
}

export function currentPurchaseContext(): PurchaseContext | undefined {
  return store.getStore();
}
