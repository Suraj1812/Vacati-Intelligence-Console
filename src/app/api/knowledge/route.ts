import { fileToDocument } from "@/lib/ai/document-loader";
import { getRagPipeline } from "@/lib/ai/rag-pipeline";
import { ApiError } from "@/lib/api/errors";
import { withApiRoute } from "@/lib/api/route";
import { getEnv } from "@/lib/config/env";
import { logger } from "@/lib/observability/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withApiRoute(request, { name: "knowledge.get" }, async () => {
    const pipeline = await getRagPipeline();
    return Response.json(await pipeline.getKnowledgeState());
  });
}

export async function POST(request: Request) {
  return withApiRoute(
    request,
    {
      name: "knowledge.post",
      rateLimit: {
        scope: "upload",
        limit: getEnv().rateLimitUploadRequests,
      },
    },
    async () => {
    const env = getEnv();
    const formData = await request.formData();
    const files = [...formData.getAll("files"), ...formData.getAll("file")].filter(isUploadedFile);

    if (!files.length) {
      throw new ApiError("No files uploaded.", 400);
    }

    if (files.length > env.maxFilesPerUpload) {
      throw new ApiError(`Upload up to ${env.maxFilesPerUpload} files at a time.`, 413);
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
    logger.info("knowledge_ingested", {
      files: files.length,
      failed: failed.length,
      chunksIndexed: ingestion.chunksIndexed,
      documents: ingestion.documents.map((document) => document.name),
    });

    return Response.json({
      ...ingestion,
      failed,
      knowledge: await pipeline.getKnowledgeState(),
    });
    },
  );
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
