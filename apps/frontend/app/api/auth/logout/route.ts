import { cookies } from "next/headers";
import { proxyWithAuth } from "../_lib/proxy";

export async function POST() {
  const response = await proxyWithAuth("/auth/logout");

  const cookieStore = await cookies();
  cookieStore.delete("accessToken");
  cookieStore.delete("refreshToken");

  return response;
}
