import { getRagPipeline } from "@/lib/ai/rag-pipeline";
import { ApiError, errorResponse } from "@/lib/api/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { message?: string };
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

  const pipeline = await getRagPipeline();
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of pipeline.answer(message)) {
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

function toServerEvent(event: string, value: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(value)}\n\n`;
}
