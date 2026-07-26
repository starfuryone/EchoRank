/**
 * Set a user's password from the CLI, using the same hashing path as
 * registration (`hashPassword` → bcrypt, cost {BCRYPT_COST}).
 *
 * Usage:
 *   set -a && . ./.env && set +a
 *   npx tsx scripts/set-password.ts <email> <newPassword>
 *
 * The password is read from argv, so prefix the command with a space (or use
 * HISTCONTROL=ignorespace) if you care about shell history.
 */
import { prisma, disconnectPrisma } from "@/lib/prisma";
import { hashPassword, verifyPassword, BCRYPT_COST } from "@/lib/password";

async function main() {
  const [emailArg, password] = process.argv.slice(2);

  if (!emailArg || !password) {
    console.error("usage: npx tsx scripts/set-password.ts <email> <newPassword>");
    process.exit(2);
  }

  // authorize() looks the user up by the normalized email, so normalize here
  // too — otherwise we could update a row that login can never reach.
  const email = emailArg.toLowerCase().trim();

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true },
  });

  if (!user) {
    console.error(`No user with email ${email}`);
    process.exit(1);
  }

  const passwordHash = await hashPassword(password);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

  // Read the stored hash back and verify through the same comparison the
  // login route uses, so a success message means login will actually work.
  const stored = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true },
  });
  const ok = stored?.passwordHash
    ? await verifyPassword(password, stored.passwordHash)
    : false;

  console.log(`user:        ${user.email} (${user.id})`);
  console.log(`algorithm:   bcrypt cost ${BCRYPT_COST} (${stored?.passwordHash?.slice(0, 4)})`);
  console.log(`round-trip:  ${ok ? "VERIFIED" : "FAILED"}`);

  if (!ok) process.exit(1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => disconnectPrisma());
