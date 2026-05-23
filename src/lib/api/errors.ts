export class ApiError extends Error {
  headers?: Record<string, string>;

  constructor(
    message: string,
    readonly status = 500,
  ) {
    super(message);
  }
}

export function errorResponse(error: unknown) {
  if (error instanceof ApiError) {
    return Response.json({ error: error.message }, { status: error.status, headers: error.headers });
  }

  return Response.json(
    { error: error instanceof Error ? error.message : "Unexpected server error." },
    { status: 500 },
  );
}
