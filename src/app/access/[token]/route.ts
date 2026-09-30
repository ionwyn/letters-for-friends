import { NextResponse } from "next/server";
import { setSession } from "@/lib/auth";
import { getMessageByNfcToken } from "@/lib/messages";

type Context = { params: Promise<{ token: string }> };

export async function GET(request: Request, context: Context) {
  const { token } = await context.params;
  const row = await getMessageByNfcToken(token);
  if (!row) {
    return NextResponse.redirect(new URL("/?access=unavailable", request.url), {
      status: 303,
      headers: {
        "Cache-Control": "private, no-store",
        "Referrer-Policy": "no-referrer",
      },
    });
  }

  await setSession({ role: "reader", id: row.id, version: row.access_version });
  return NextResponse.redirect(new URL("/letter", request.url), {
    status: 303,
    headers: {
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}
