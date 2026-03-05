import { NextRequest } from "next/server";
import { proxyAuthRequest } from "../_lib/proxy";

export async function POST(request: NextRequest) {
  const body = await request.json();
  return proxyAuthRequest("/auth/register", body);
}
