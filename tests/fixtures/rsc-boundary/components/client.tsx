"use client";

// Fixture for tests/rsc-client-props.test.ts: the client boundary.
import type { FixtureCopy } from "../copy";
import { Inner } from "./inner";

export function FixtureClient(props: {
  t?: FixtureCopy;
  label?: string;
  items?: { a: string }[];
  when?: Date;
  data?: Promise<number>;
  onPick?: () => void;
  action?: (form: FormData) => Promise<void>;
}) {
  return (
    <div>
      {props.label}
      <Inner />
    </div>
  );
}
