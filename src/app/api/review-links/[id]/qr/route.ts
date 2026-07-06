import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { resolveTenant } from "@/lib/signals/auth-adapter";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await resolveTenant(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const link = await prisma.reviewLink.findFirst({
    where: { id, tenantId: auth.tenantId },
  });
  if (!link) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const png = await QRCode.toBuffer(link.url, {
    type: "png",
    width: 512,
    margin: 2,
    errorCorrectionLevel: "M",
  });

  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `inline; filename="review-link-${id}.png"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
