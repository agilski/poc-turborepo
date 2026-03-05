import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:3000";

export async function proxyAuthRequest(
  backendPath: string,
  body: Record<string, unknown>
) {
  let res: Response;
  try {
    res = await fetch(`${BACKEND_URL}${backendPath}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return NextResponse.json(
      { message: "Backend unavailable" },
      { status: 502 }
    );
  }

  const data = await res.json();

  if (!res.ok) {
    return NextResponse.json(data, { status: res.status });
  }

  const { accessToken, refreshToken } = data;
  if (!accessToken || !refreshToken) {
    return NextResponse.json(
      { message: "Unexpected backend response" },
      { status: 502 }
    );
  }

  const cookieStore = await cookies();
  const isProduction = process.env.NODE_ENV === "production";

  cookieStore.set("accessToken", accessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: 900, // 15 minutes
  });

  cookieStore.set("refreshToken", refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/api/auth",
    maxAge: 604800, // 7 days
  });

  return NextResponse.json({ success: true });
}

export async function proxyWithAuth(backendPath: string) {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("accessToken")?.value;

  if (!accessToken) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  let res: Response;
  try {
    res = await fetch(`${BACKEND_URL}${backendPath}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    });
  } catch {
    return NextResponse.json(
      { message: "Backend unavailable" },
      { status: 502 }
    );
  }

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
