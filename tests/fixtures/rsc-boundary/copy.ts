// Fixture for tests/rsc-client-props.test.ts: a copy catalog with a function entry.
export interface FixtureCopy {
  title: string;
  greet: (name: string) => string;
}

export const FIXTURE_COPY: FixtureCopy = {
  title: "Hello",
  greet: (name) => `Hello, ${name}`,
};
