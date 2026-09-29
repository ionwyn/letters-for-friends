import { NextResponse } from "next/server";
import { session } from "@/lib/auth";
import { noStore } from "@/lib/http";

export async function GET() {
  const current = await session();
  return NextResponse.json(
    current ? { role: current.role, id: current.id } : { role: null },
    { headers: noStore },
  );
}
