/**
 * Issue a partner-API key (scope "partner", /api/partner/v1/*) on the internal
 * tenant "EchoPilot (partner)", creating that tenant on first run.
 *
 * Usage (as echorank or root — it reads the 600 .env):
 *   set -a && . ./.env && set +a
 *   npm run partner:create-key -- "EchoPilot production"
 *
 * Prints the plaintext key ONCE. Only its hash is stored; a lost key is
 * revoked and reissued, never recovered. Existing keys stay valid — revoke the
 * old one (api_keys.revokedAt) once the partner has switched.
 *
 * Runtime strategy for `server-only` (CLAUDE.md): the npm script sets
 * --conditions=react-server, like `npm run workers`.
 */
import { prisma, disconnectPrisma } from "@/lib/prisma";
import { createApiKey } from "@/lib/api-keys";

const TENANT_SLUG = "echopilot-partner";
const TENANT_NAME = "EchoPilot (partner)";

async function main() {
  const label = (process.argv[2] ?? "EchoPilot").trim();
  const tenant = await prisma.tenant.upsert({
    where: { slug: TENANT_SLUG },
    update: {},
    create: { slug: TENANT_SLUG, name: TENANT_NAME },
    select: { id: true, name: true },
  });
  const issued = await createApiKey(tenant.id, label, ["partner"]);
  console.log(`tenant  ${tenant.name} (${tenant.id})`);
  console.log(`key id  ${issued.id} (prefix ${issued.prefix}, label "${label}")`);
  console.log("");
  console.log("ECHORANK_API_KEY=" + issued.key);
  console.log("");
  console.log("Shown once. Put it in /opt/echopilot/.env; never commit it.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => disconnectPrisma());
