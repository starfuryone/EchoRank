// Nothing a Server Component hands to a Client Component may contain a function.
//
// React serializes the props that cross a "use client" boundary, and a function
// cannot be serialized: the render throws "Functions cannot be passed directly
// to Client Components" and the page is a 500. /plan went down that way on
// 2026-11-15. Its copy object (PLAN_HUB_COPY) has function-valued entries
// (planLine, perMonth, statusTrial, ownerOnly …), and the server-rendered
// <PlanHub> passed the whole object to the client <PlanBillingActions>.
// tsc, eslint and vitest were all green; only a request finds it.
//
// This test finds it at test time, from the types:
//   1. Every module whose directive prologue says "use client" is a client
//      boundary.
//   2. A module is server-rendered when an App Router entry (page, layout,
//      template, loading, not-found, default) reaches it through value imports
//      without passing a boundary. In each such .tsx module, every JSX element
//      whose tag is declared in a "use client" module is a crossing, and every
//      prop on it (spreads included) is checked.
//   3. A prop fails if its TYPE can hold a function anywhere inside: a call
//      signature on the value, or on any property, element or index value of it,
//      to any depth. Builtin methods (on strings, arrays, Date, Promise …) are
//      not props and are skipped. Server Actions ("use server") are allowed.
//
// A copy object for a client component either goes over as data only, or the
// client component imports the catalog itself and is handed the locale.

import { join, relative } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..");
const SRC = join(ROOT, "src");

function directives(sf: ts.SourceFile): string[] {
  const out: string[] = [];
  for (const st of sf.statements) {
    if (ts.isExpressionStatement(st) && ts.isStringLiteral(st.expression)) out.push(st.expression.text);
    else break;
  }
  return out;
}

/** Every .tsx under `dir` as a root, with the app's compiler options (paths, jsx). */
function buildProgram(dir: string): ts.Program {
  const cfgPath = join(ROOT, "tsconfig.json");
  const parsed = ts.getParsedCommandLineOfConfigFile(cfgPath, {}, {
    ...ts.sys,
    onUnRecoverableConfigFileDiagnostic: (d) => {
      throw new Error(ts.flattenDiagnosticMessageText(d.messageText, "\n"));
    },
  });
  if (!parsed) throw new Error("tsconfig.json did not parse");
  const roots = ts.sys.readDirectory(dir, [".tsx"]);
  return ts.createProgram(roots, { ...parsed.options, noEmit: true });
}

/** The module a value import (or re-export) points at, if it is under `dir`. */
function importedModules(sf: ts.SourceFile, checker: ts.TypeChecker, dir: string): ts.SourceFile[] {
  const out: ts.SourceFile[] = [];
  for (const st of sf.statements) {
    let spec: ts.Expression | undefined;
    if (ts.isImportDeclaration(st)) {
      if (st.importClause?.isTypeOnly) continue;
      spec = st.moduleSpecifier;
    } else if (ts.isExportDeclaration(st)) {
      if (st.isTypeOnly || !st.moduleSpecifier) continue;
      spec = st.moduleSpecifier;
    }
    if (!spec) continue;
    const decl = checker.getSymbolAtLocation(spec)?.valueDeclaration;
    if (decl && ts.isSourceFile(decl) && decl.fileName.startsWith(dir)) out.push(decl);
  }
  return out;
}

const PRIMITIVE =
  ts.TypeFlags.StringLike |
  ts.TypeFlags.NumberLike |
  ts.TypeFlags.BigIntLike |
  ts.TypeFlags.BooleanLike |
  ts.TypeFlags.EnumLike |
  ts.TypeFlags.ESSymbolLike |
  ts.TypeFlags.Null |
  ts.TypeFlags.Undefined |
  ts.TypeFlags.Void |
  ts.TypeFlags.Never |
  ts.TypeFlags.Any |
  ts.TypeFlags.Unknown;

/** Serializable by React's Flight protocol as values; never walked into. */
const OPAQUE = new Set(["Date", "Promise", "Map", "Set", "ReadonlyMap", "ReadonlySet", "RegExp", "Uint8Array", "ArrayBuffer", "FormData", "ReadableStream", "Blob"]);
/** React element types: rendered on the server, sent as markup. */
const ELEMENT = new Set(["ReactElement", "ReactPortal", "Element", "ReactNode", "JSX.Element"]);

function findFunction(
  t: ts.Type,
  checker: ts.TypeChecker,
  program: ts.Program,
  path: string,
  depth: number,
  seen: Set<ts.Type>,
): string | null {
  if (depth > 10 || t.flags & PRIMITIVE || seen.has(t)) return null;
  seen.add(t);
  if (t.isUnion() || t.isIntersection()) {
    for (const m of t.types) {
      const hit = findFunction(m, checker, program, path, depth + 1, seen);
      if (hit) return hit;
    }
    return null;
  }
  const name = (t.aliasSymbol ?? t.getSymbol())?.getName() ?? "";
  if (OPAQUE.has(name) || ELEMENT.has(name)) return null;
  if (t.getCallSignatures().length > 0 || t.getConstructSignatures().length > 0) return path;
  if (checker.isArrayType(t) || checker.isTupleType(t)) {
    for (const el of checker.getTypeArguments(t as ts.TypeReference)) {
      const hit = findFunction(el, checker, program, `${path}[]`, depth + 1, seen);
      if (hit) return hit;
    }
    return null;
  }
  for (const idx of [t.getStringIndexType(), t.getNumberIndexType()]) {
    if (!idx) continue;
    const hit = findFunction(idx, checker, program, `${path}[key]`, depth + 1, seen);
    if (hit) return hit;
  }
  for (const prop of t.getProperties()) {
    if (prop.getName().startsWith("__@")) continue; // symbol-keyed (iterators)
    const decl = prop.valueDeclaration ?? prop.declarations?.[0];
    if (decl && program.isSourceFileDefaultLibrary(decl.getSourceFile())) continue;
    const pt = checker.getTypeOfSymbol(prop);
    const hit = findFunction(pt, checker, program, `${path}.${prop.getName()}`, depth + 1, seen);
    if (hit) return hit;
  }
  return null;
}

/** A Server Action: declared in a "use server" module or with the directive in its body. */
function isServerAction(expr: ts.Expression, checker: ts.TypeChecker): boolean {
  let sym = checker.getSymbolAtLocation(expr);
  if (sym && sym.flags & ts.SymbolFlags.Alias) sym = checker.getAliasedSymbol(sym);
  const decl = sym?.valueDeclaration;
  if (!decl) return false;
  if (directives(decl.getSourceFile()).includes("use server")) return true;
  const body = (ts.isFunctionDeclaration(decl) || ts.isFunctionExpression(decl) || ts.isArrowFunction(decl)) && decl.body;
  return !!body && ts.isBlock(body) && directives(body as unknown as ts.SourceFile).includes("use server");
}

interface Crossing {
  file: string;
  line: number;
  component: string;
  prop: string;
  where: string;
}

/** App Router files Next renders as Server Components (relative to src/). */
const ENTRY = /^app\/(?:.*\/)?(?:page|layout|template|loading|not-found|default|global-not-found)\.tsx$/;

function scan(dir: string): { crossings: number; violations: Crossing[]; clientFiles: number; serverFiles: number } {
  const program = buildProgram(dir);
  const checker = program.getTypeChecker();
  const ours = program.getSourceFiles().filter((sf) => sf.fileName.startsWith(dir) && !sf.isDeclarationFile);

  const boundary = new Set(ours.filter((sf) => directives(sf).includes("use client")).map((sf) => sf.fileName));

  // Server-rendered = reachable from an App Router entry without passing
  // through a "use client" module. A shared component imported by both sides
  // is in here: it IS server-rendered on the paths that reach it this way.
  const server = new Set<string>();
  const queue = ours.filter((sf) => ENTRY.test(relative(dir, sf.fileName)) && !boundary.has(sf.fileName));
  for (const sf of queue) server.add(sf.fileName);
  while (queue.length) {
    for (const dep of importedModules(queue.pop()!, checker, dir)) {
      if (!server.has(dep.fileName) && !boundary.has(dep.fileName)) {
        server.add(dep.fileName);
        queue.push(dep);
      }
    }
  }

  const violations: Crossing[] = [];
  let crossings = 0;
  for (const sf of ours) {
    if (!sf.fileName.endsWith(".tsx") || !server.has(sf.fileName)) continue;
    const visit = (node: ts.Node) => {
      if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) {
        let sym = checker.getSymbolAtLocation(node.tagName);
        if (sym && sym.flags & ts.SymbolFlags.Alias) sym = checker.getAliasedSymbol(sym);
        const declFile = (sym?.valueDeclaration ?? sym?.declarations?.[0])?.getSourceFile().fileName;
        if (declFile && boundary.has(declFile)) {
          crossings++;
          for (const attr of node.attributes.properties) {
            let expr: ts.Expression | undefined;
            let prop: string;
            if (ts.isJsxSpreadAttribute(attr)) {
              expr = attr.expression;
              prop = `{...${expr.getText(sf)}}`;
            } else {
              prop = attr.name.getText(sf);
              if (prop === "key" || prop === "children") continue;
              const init = attr.initializer;
              if (!init || !ts.isJsxExpression(init) || !init.expression) continue;
              expr = init.expression;
            }
            if (isServerAction(expr, checker)) continue;
            const where = findFunction(checker.getTypeAtLocation(expr), checker, program, prop, 0, new Set());
            if (where) {
              violations.push({
                file: relative(ROOT, sf.fileName),
                line: sf.getLineAndCharacterOfPosition(attr.getStart(sf)).line + 1,
                component: node.tagName.getText(sf),
                prop,
                where,
              });
            }
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  return { crossings, violations, clientFiles: boundary.size, serverFiles: server.size };
}

describe("the scan itself (tests/fixtures/rsc-boundary)", () => {
  const fixture = join(__dirname, "fixtures", "rsc-boundary");
  const result = scan(fixture);

  it("fails a copy object with a function, a callback, and the same through a shared component; passes data and Server Actions", () => {
    const found = result.violations.map((v) => `${v.file.split("rsc-boundary/")[1]} ${v.prop} ${v.where}`).sort();
    expect(found).toEqual(["app/page.tsx onPick onPick", "app/page.tsx t t.greet", "components/shared.tsx t t.greet"]);
  });
});

describe("props a Server Component passes to a Client Component", () => {
  const result = scan(SRC);

  it("finds the boundary (so an empty result means clean, not broken)", () => {
    expect(result.clientFiles).toBeGreaterThan(100);
    expect(result.serverFiles).toBeGreaterThan(100);
    expect(result.crossings).toBeGreaterThan(100);
  });

  it("never contain a function", () => {
    const lines = result.violations.map((v) => `${v.file}:${v.line} <${v.component} ${v.prop}> holds a function at ${v.where}`);
    expect(lines).toEqual([]);
  });
});
