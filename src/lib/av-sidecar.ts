const BASE = process.env.AV_SIDECAR_URL || "http://127.0.0.1:4500";
const SECRET = process.env.INTERNAL_API_SECRET || "";

export interface SidecarResult<T = unknown> {
  status: number;
  data: T;
}

export async function sidecarPost<T = unknown>(
  path: string,
  body: unknown,
): Promise<SidecarResult<T>> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Secret": SECRET,
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    return {
      status: 502,
      data: { error: "AI Visibility service is unavailable." } as unknown as T,
    };
  }

  let data: T;
  try {
    data = (await res.json()) as T;
  } catch {
    data = { error: "AI Visibility service returned an invalid response." } as unknown as T;
  }
  return { status: res.status, data };
}
