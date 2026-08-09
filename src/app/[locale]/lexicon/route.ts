import { permanentRedirect } from "next/navigation";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ locale: string }> }
) {
  const { locale } = await ctx.params;
  permanentRedirect(`/${locale}/glossary`);
}
