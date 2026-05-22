import { fileToDocument } from "@/lib/ai/document-loader";
import { getRagPipeline } from "@/lib/ai/rag-pipeline";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { getEnv } from "@/lib/config/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const pipeline = await getRagPipeline();
  return Response.json(pipeline.getKnowledgeState());
}

export async function POST(request: Request) {
  try {
    const env = getEnv();
    const formData = await request.formData();
    const files = formData.getAll("files").filter((value): value is File => value instanceof File);

    if (!files.length) {
      throw new ApiError("No files uploaded.", 400);
    }

    const maxBytes = env.maxUploadMb * 1024 * 1024;
    const oversized = files.find((file) => file.size > maxBytes);
    if (oversized) {
      throw new ApiError(`${oversized.name} exceeds the ${env.maxUploadMb}MB upload limit.`, 413);
    }

    const documents = await Promise.all(files.map(fileToDocument));
    const pipeline = await getRagPipeline();
    const ingestion = await pipeline.ingestDocuments(documents);

    return Response.json({
      ...ingestion,
      knowledge: pipeline.getKnowledgeState(),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
