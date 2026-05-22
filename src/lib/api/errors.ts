export class ApiError extends Error {
  constructor(
    message: string,
    readonly status = 500,
  ) {
    super(message);
  }
}

export function errorResponse(error: unknown) {
  if (error instanceof ApiError) {
    return Response.json({ error: error.message }, { status: error.status });
  }

  return Response.json(
    { error: error instanceof Error ? error.message : "Unexpected server error." },
    { status: 500 },
  );
}
