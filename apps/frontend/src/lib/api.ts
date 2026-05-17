const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

type ApiErrorBody = {
  error?: string;
  code?: string;
};

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code?: string,
  ) {
    super(message);
  }
}

export async function postJson<TResponse>(
  path: string,
  body: Record<string, unknown>,
  token?: string,
): Promise<TResponse> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  const payload = (await response.json().catch(() => ({}))) as ApiErrorBody;

  if (!response.ok) {
    throw new ApiError(
      payload.error ?? "Something went wrong. Please try again.",
      response.status,
      payload.code,
    );
  }

  return payload as TResponse;
}

export async function patchJson<TResponse>(
  path: string,
  body: Record<string, unknown>,
  token?: string,
): Promise<TResponse> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  const payload = (await response.json().catch(() => ({}))) as ApiErrorBody;

  if (!response.ok) {
    throw new ApiError(
      payload.error ?? "Something went wrong. Please try again.",
      response.status,
      payload.code,
    );
  }

  return payload as TResponse;
}

export async function getJson<TResponse>(
  path: string,
  token?: string,
): Promise<TResponse> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "GET",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  const payload = (await response.json().catch(() => ({}))) as ApiErrorBody;

  if (!response.ok) {
    throw new ApiError(
      payload.error ?? "Something went wrong. Please try again.",
      response.status,
      payload.code,
    );
  }

  return payload as TResponse;
}

export async function deleteJson<TResponse>(
  path: string,
  token?: string,
): Promise<TResponse> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "DELETE",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  const payload = (await response.json().catch(() => ({}))) as ApiErrorBody;

  if (!response.ok) {
    throw new ApiError(
      payload.error ?? "Something went wrong. Please try again.",
      response.status,
      payload.code,
    );
  }

  return payload as TResponse;
}
