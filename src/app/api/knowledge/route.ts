import { fileToDocument } from "@/lib/ai/document-loader";
import { getRagPipeline } from "@/lib/ai/rag-pipeline";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { getEnv } from "@/lib/config/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const pipeline = await getRagPipeline();
  return Response.json(await pipeline.getKnowledgeState());
}

export async function POST(request: Request) {
  try {
    const env = getEnv();
    const formData = await request.formData();
    const files = [...formData.getAll("files"), ...formData.getAll("file")].filter(isUploadedFile);

    if (!files.length) {
      throw new ApiError("No files uploaded.", 400);
    }

    const maxBytes = env.maxUploadMb * 1024 * 1024;
    const oversized = files.find((file) => file.size > maxBytes);
    if (oversized) {
      throw new ApiError(`${oversized.name} exceeds the ${env.maxUploadMb}MB upload limit.`, 413);
    }

    const parsed = await Promise.allSettled(files.map(fileToDocument));
    const documents = parsed
      .filter((result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof fileToDocument>>> => result.status === "fulfilled")
      .map((result) => result.value);
    const failed = parsed.flatMap((result, index) => {
      if (result.status === "fulfilled") {
        return [];
      }

      return [
        {
          name: files[index].name,
          error: result.reason instanceof Error ? result.reason.message : "Could not parse this file.",
        },
      ];
    });

    if (!documents.length) {
      throw new ApiError(failed[0]?.error ?? "No uploaded files contained extractable text.", 422);
    }

    const pipeline = await getRagPipeline();
    const ingestion = await pipeline.ingestDocuments(documents);

    return Response.json({
      ...ingestion,
      failed,
      knowledge: await pipeline.getKnowledgeState(),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

function isUploadedFile(value: FormDataEntryValue): value is File {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<File>;
  return (
    typeof candidate.arrayBuffer === "function" &&
    typeof candidate.name === "string" &&
    typeof candidate.size === "number"
  );
}
