import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { proxyAuthRequest } from "../_lib/proxy";

export async function POST() {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get("refreshToken")?.value;

  if (!refreshToken) {
    return NextResponse.json(
      { message: "No refresh token" },
      { status: 401 }
    );
  }

  return proxyAuthRequest("/auth/refresh", { refreshToken });
}
