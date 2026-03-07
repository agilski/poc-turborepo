export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly data: Record<string, unknown>,
  ) {
    super(`HTTP ${status}`);
    this.name = "HttpError";
    this.message = "There is an error";
  }
}

export async function httpPost<T = unknown>(
  url: string,
  body: unknown,
): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  const test = new HttpError(res.status, data);

  if (!res.ok) {
    throw new HttpError(res.status, data);
  }

  return data as T;
}

export async function httpGet<T = unknown>(url: string): Promise<T> {
  const res = await fetch(url);
  const data = await res.json();

  if (!res.ok) {
    throw new HttpError(res.status, data);
  }

  return data as T;
}
