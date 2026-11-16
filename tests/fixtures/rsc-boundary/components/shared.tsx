// Fixture for tests/rsc-client-props.test.ts: no directive, imported by the
// page, so it is server-rendered there.
import { FIXTURE_COPY } from "../copy";
import { FixtureClient } from "./client";

export function Shared() {
  return <FixtureClient t={FIXTURE_COPY} />;
}
