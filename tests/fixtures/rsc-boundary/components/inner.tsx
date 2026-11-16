// Fixture for tests/rsc-client-props.test.ts: imported only from the client
// module, so it renders on the client and may pass functions freely.
import { FixtureClient } from "./client";

export function Inner() {
  return <FixtureClient onPick={() => undefined} />;
}
