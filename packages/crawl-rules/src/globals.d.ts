// The package compiles with `lib: ["ES2020"]` and no ambient types, so it cannot
// lean on Node or DOM globals by accident. WHATWG URL is the one exception: it
// exists in every runtime this package targets (Node, browsers, workers, Deno),
// so it is declared here — the minimum surface the rules use, nothing more.

declare class URLSearchParams {
  keys(): IterableIterator<string>;
  has(name: string): boolean;
}

declare class URL {
  constructor(input: string, base?: string);
  href: string;
  protocol: string;
  hostname: string;
  host: string;
  port: string;
  pathname: string;
  search: string;
  hash: string;
  readonly searchParams: URLSearchParams;
  toString(): string;
}
