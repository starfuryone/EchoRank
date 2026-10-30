// scripts/deploy.sh (installed as /usr/local/sbin/echorank360-deploy) against a scratch git
// tree. Everything that needs root or the real box — sudo, pm2, curl, ss, install, chown,
// npm, npx, id — is a stub on PATH that logs its call; git, flock, python3 (the renameat2
// swap), mv and rm are real. What is asserted is the order of side effects: a build that fails
// never reaches pm2, and the live .next only changes by an exchange.
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const SCRIPT = join(__dirname, "..", "scripts", "deploy.sh");

const STUBS: Record<string, string> = {
  id: `echo "\${STUB_UID:-0}"`,
  // sudo -u <user> -H env K=V… bash -c … → run it, logging who it ran as.
  sudo: `echo "as $2: \${@: -2}" >>"$STUB_STATE/log"; while [ "$1" != env ]; do shift; done; exec "$@"`,
  install: `mkdir -p "\${@: -1}"`,
  chown: `true`,
  npm: `echo "build NEXT_DIST_DIR=$NEXT_DIST_DIR" >>"$STUB_STATE/log"
[ -e "$STUB_STATE/fail_build" ] && exit 1
mkdir -p "$NEXT_DIST_DIR" && cat "$STUB_STATE/next_id" >"$NEXT_DIST_DIR/BUILD_ID"`,
  npx: `echo "npx $*" >>"$STUB_STATE/log"
[ "$*" = "prisma migrate status" ] && echo "Database schema is up to date!"
true`,
  pm2: `echo "pm2 $*" >>"$STUB_STATE/log"
if [ "$1 $2" = "restart echorank360-web" ]; then
  n=$(cat "$STUB_STATE/restarts" 2>/dev/null || echo 0); echo $((n + 1)) >"$STUB_STATE/restarts"
fi
true`,
  // The /en code comes from code_<restarts so far>, default 200; stylesheets always 200.
  curl: `url="\${@: -1}"; n=$(cat "$STUB_STATE/restarts" 2>/dev/null || echo 0)
echo "curl $url" >>"$STUB_STATE/log"
case "$*" in
  *http_code*) case "$url" in *.css) printf 200 ;; *) printf '%s' "$(cat "$STUB_STATE/code_$n" 2>/dev/null || echo 200)" ;; esac ;;
  *) printf '<link rel="stylesheet" href="/_next/static/chunks/a.css"/>' ;;
esac`,
  ss: `cat "$STUB_STATE/listeners" 2>/dev/null || echo 'LISTEN 0 511 127.0.0.1:4400 0.0.0.0:* users:(("next-server",pid=1,fd=18))'`,
};

let root: string, app: string, state: string, bin: string;

function sh(cmd: string, cwd = app) {
  const r = spawnSync("bash", ["-c", cmd], { cwd, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`${cmd}: ${r.stderr}`);
  return r.stdout.trim();
}

function deploy(...args: string[]) {
  const r = spawnSync("bash", [SCRIPT, ...args], {
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${bin}:${process.env.PATH}`,
      ECHORANK_APP: app,
      ECHORANK_DEPLOY_LOCK: join(state, "lock"),
      ECHORANK_HEALTH_TIMEOUT: "2",
      STUB_STATE: state,
    },
  });
  const log = existsSync(join(state, "log")) ? readFileSync(join(state, "log"), "utf8").split("\n") : [];
  return { status: r.status, out: r.stdout, err: r.stderr, log };
}

const buildId = (dir: string) => readFileSync(join(app, dir, "BUILD_ID"), "utf8").trim();
const set = (name: string, value: string) => writeFileSync(join(state, name), value);
const resetLog = () => rmSync(join(state, "log"), { force: true });
const indexOf = (log: string[], prefix: string) => log.findIndex((l) => l.startsWith(prefix));
const lastIndexOf = (log: string[], prefix: string) =>
  log.length - 1 - [...log].reverse().findIndex((l) => l.startsWith(prefix));

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "er-deploy-"));
  app = join(root, "app");
  state = join(root, "state");
  bin = join(root, "bin");
  for (const d of [app, state, bin, join(app, "scripts"), join(app, "src/app"), join(app, ".next")]) {
    mkdirSync(d, { recursive: true });
  }
  for (const [name, body] of Object.entries(STUBS)) {
    writeFileSync(join(bin, name), `#!/usr/bin/env bash\n${body}\n`);
    chmodSync(join(bin, name), 0o755);
  }
  writeFileSync(join(app, ".gitignore"), ".env\n.next*\n");
  writeFileSync(join(app, ".env"), "SECRET=1\n");
  writeFileSync(join(app, "scripts/deploy.sh"), readFileSync(SCRIPT));
  writeFileSync(join(app, "src/app/page.tsx"), "export default 1;\n");
  writeFileSync(join(app, ".next/BUILD_ID"), "old");
  sh("git init -q && git add -A && git -c user.email=t@t -c user.name=t commit -qm init");
  set("next_id", "new");
});

afterEach(() => rmSync(root, { recursive: true, force: true }));

describe("echorank360-deploy", () => {
  it("swaps a finished build in, keeps the old one as .next-prev, and restarts after the swap", () => {
    const r = deploy();
    expect(r.status, r.err).toBe(0);
    expect(buildId(".next")).toBe("new");
    expect(buildId(".next-prev")).toBe("old");
    expect(existsSync(join(app, ".next-build"))).toBe(false);
    expect(readFileSync(join(app, ".next/DEPLOYED_COMMIT"), "utf8").trim()).toBe(sh("git rev-parse HEAD"));

    // Built into .next-build, never into the live directory, as the env-holding user.
    expect(r.log).toContain("build NEXT_DIST_DIR=.next-build");
    expect(r.log).toContain("as echorank: run build");
    expect(r.log).toContain("as deploy: prisma generate");

    // health before → build → restart → health after
    const firstCurl = indexOf(r.log, "curl http://127.0.0.1:4400/en");
    const build = indexOf(r.log, "build ");
    const restart = indexOf(r.log, "pm2 restart echorank360-web");
    expect(firstCurl).toBeGreaterThanOrEqual(0);
    expect(firstCurl).toBeLessThan(build);
    expect(build).toBeLessThan(restart);
    expect(lastIndexOf(r.log, "curl http://127.0.0.1:4400/en")).toBeGreaterThan(restart);

    // No record of the previous deploy → workers restart too.
    expect(r.log).toContain("pm2 restart echorank360-workers");
    expect(r.out).toContain("Purge Everything");
  });

  it("refuses a dirty tree before building or restarting anything", () => {
    writeFileSync(join(app, "src/app/new.tsx"), "x");
    const r = deploy();
    expect(r.status).toBe(1);
    expect(r.err).toContain("working tree not clean");
    expect(r.err).toContain("src/app/new.tsx");
    expect(r.log.some((l) => l.startsWith("build") || l.startsWith("pm2"))).toBe(false);
    expect(buildId(".next")).toBe("old");
  });

  it("never restarts on a failed build, and leaves .next alone", () => {
    set("fail_build", "");
    const r = deploy();
    expect(r.status).toBe(1);
    expect(r.err).toContain("next build exited non-zero");
    expect(r.log.some((l) => l.startsWith("pm2"))).toBe(false);
    expect(buildId(".next")).toBe("old");
    expect(existsSync(join(app, ".next-prev"))).toBe(false);
  });

  it("rolls back automatically when the new build fails its health check", () => {
    set("code_1", "500"); // after the first restart
    set("code_2", "200"); // after the rollback restart
    const r = deploy();
    expect(r.status).toBe(1);
    expect(r.err).toContain("rolled back to old, which is healthy");
    expect(buildId(".next")).toBe("old");
    expect(buildId(".next-prev")).toBe("new");
    expect(r.log.filter((l) => l === "pm2 restart echorank360-web")).toHaveLength(2);
  });

  it("does not roll back onto a build that was already failing", () => {
    set("code_0", "502");
    set("code_1", "500");
    const r = deploy();
    expect(r.status).toBe(1);
    expect(r.err).toContain("WARNING");
    expect(r.err).toContain("not rolled back");
    expect(buildId(".next")).toBe("new");
  });

  it("treats a second listener on 4400 as a failed deploy", () => {
    set("listeners", "LISTEN a\nLISTEN b\n");
    set("code_2", "200");
    const r = deploy();
    expect(r.status).toBe(1);
    expect(r.err).toContain("expected exactly one listener on 4400");
  });

  it("--rollback swaps .next-prev back in and restarts only the web process", () => {
    expect(deploy().status).toBe(0);
    resetLog();
    const r = deploy("--rollback");
    expect(r.status, r.err).toBe(0);
    expect(buildId(".next")).toBe("old");
    expect(buildId(".next-prev")).toBe("new");
    expect(r.log).toContain("pm2 restart echorank360-web");
    expect(r.log).not.toContain("pm2 restart echorank360-workers");
    expect(r.log.some((l) => l.startsWith("build"))).toBe(false);
  });

  it("skips the workers restart when only web-only paths changed since the last deploy", () => {
    expect(deploy().status).toBe(0);
    writeFileSync(join(app, "src/app/page.tsx"), "export default 2;\n");
    sh("git -c user.email=t@t -c user.name=t commit -qam web-only");
    set("next_id", "newer");
    resetLog();
    const r = deploy();
    expect(r.status, r.err).toBe(0);
    expect(r.log).toContain("pm2 restart echorank360-web");
    expect(r.log).not.toContain("pm2 restart echorank360-workers");

    writeFileSync(join(app, "src/lib.ts"), "export {};\n");
    sh("git add -A && git -c user.email=t@t -c user.name=t commit -qm lib");
    set("next_id", "newest");
    resetLog();
    expect(deploy().log).toContain("pm2 restart echorank360-workers");
  });

  it("the real repo ignores what the script leaves behind, or the next deploy refuses a dirty tree", () => {
    const repo = join(__dirname, "..");
    for (const dir of [".next-build", ".next-prev", ".next"]) {
      const r = spawnSync("git", ["check-ignore", "-q", `${dir}/BUILD_ID`], { cwd: repo });
      expect(r.status, `${dir} is not gitignored`).toBe(0);
    }
  });

  it("refuses to run as anyone but root", () => {
    const r = spawnSync("bash", [SCRIPT], {
      encoding: "utf8",
      env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, ECHORANK_APP: app, STUB_UID: "1002", STUB_STATE: state },
    });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("run as root");
  });
});
