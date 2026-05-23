import { getRagPipeline } from "@/lib/ai/rag-pipeline";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { withApiRoute } from "@/lib/api/route";
import { getEnv } from "@/lib/config/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return withApiRoute(
    request,
    {
      name: "chat.post",
      rateLimit: {
        scope: "chat",
        limit: getEnv().rateLimitChatRequests,
      },
    },
    () => handlePost(request),
  );
}

async function handlePost(request: Request) {
  let body: { message?: string; history?: Array<{ role?: string; content?: string }> };
  try {
    body = (await request.json()) as { message?: string };
  } catch (error) {
    return errorResponse(error);
  }

  const message = body.message?.trim();
  if (!message) {
    return errorResponse(new ApiError("Message is required.", 400));
  }

  if (message.length > 4_000) {
    return errorResponse(new ApiError("Message is too long for this console session.", 413));
  }

  const history = normalizeHistory(body.history);
  const pipeline = await getRagPipeline();
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of pipeline.answer(message, history)) {
          controller.enqueue(encoder.encode(toServerEvent(event.type, event.value)));
        }

        controller.enqueue(encoder.encode(toServerEvent("done", true)));
      } catch (error) {
        controller.enqueue(
          encoder.encode(
            toServerEvent("error", {
              message: error instanceof Error ? error.message : "The AI stream failed.",
            }),
          ),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

function normalizeHistory(history: Array<{ role?: string; content?: string }> | undefined) {
  return (history ?? [])
    .filter(
      (turn): turn is { role: "user" | "assistant"; content: string } =>
        (turn.role === "user" || turn.role === "assistant") && typeof turn.content === "string" && Boolean(turn.content.trim()),
    )
    .slice(-8)
    .map((turn) => ({
      role: turn.role,
      content: turn.content.trim().slice(0, 1_500),
    }));
}

function toServerEvent(event: string, value: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(value)}\n\n`;
}
