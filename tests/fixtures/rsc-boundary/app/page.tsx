// Fixture for tests/rsc-client-props.test.ts: a server entry. Three crossings
// must fail (t, onPick, Shared's t); the rest are data or a Server Action.
import { saveFixture } from "../actions";
import { FIXTURE_COPY } from "../copy";
import { FixtureClient } from "../components/client";
import { Shared } from "../components/shared";

export default function Page() {
  return (
    <main>
      <FixtureClient t={FIXTURE_COPY} />
      <FixtureClient onPick={() => undefined} />
      <FixtureClient
        label={FIXTURE_COPY.greet("Ana")}
        items={[{ a: FIXTURE_COPY.title }]}
        when={new Date(0)}
        data={Promise.resolve(1)}
        action={saveFixture}
      />
      <Shared />
    </main>
  );
}
