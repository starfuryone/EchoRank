import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "unknown";
    const rl = rateLimit(`webhook:${ip}`, 100, 60_000);
    if (!rl.success) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { event, data } = body;

    if (!event || typeof event !== "string") {
      return NextResponse.json(
        { error: "Event type is required" },
        { status: 400 }
      );
    }

    if (data === undefined || data === null) {
      return NextResponse.json(
        { error: "Event data is required" },
        { status: 400 }
      );
    }

    console.log(`[Webhook] Received event: ${event}`, {
      event,
      data,
      receivedAt: new Date().toISOString(),
      ip,
    });

    return NextResponse.json({
      received: true,
      event,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Webhook processing error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
