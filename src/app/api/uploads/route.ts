import { issueSignedToken } from "@vercel/blob";
import {
  handleUploadPresigned,
  type HandleUploadPresignedBody,
} from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { isMaster, sameOrigin } from "@/lib/auth";
import { getMessage } from "@/lib/messages";
import { jsonError, noStore } from "@/lib/http";

const pathPattern = /^messages\/([0-9a-f-]{36})\/([0-9a-f-]{36})\/([^/]+)$/i;

export async function POST(request: Request) {
  const body = (await request
    .json()
    .catch(() => null)) as HandleUploadPresignedBody | null;
  if (!body) return jsonError("Invalid upload");
  try {
    const result = await handleUploadPresigned({
      request,
      body,
      getSignedToken: async (pathname) => {
        if (!sameOrigin(request) || !(await isMaster()))
          throw new Error("Master access required");
        const match = pathPattern.exec(pathname);
        if (!match || match[3].length > 180)
          throw new Error("Invalid upload path");
        const message = await getMessage(match[1]);
        if (!message || message.status === "revoked")
          throw new Error("Message unavailable");
        const allowedContentTypes = [
          "image/jpeg",
          "image/png",
          "image/webp",
          "image/gif",
          "video/mp4",
          "video/webm",
          "audio/mpeg",
          "audio/mp4",
          "audio/wav",
          "application/pdf",
          "text/plain",
        ];
        const maximumSizeInBytes = 100 * 1024 * 1024;
        const validUntil = Date.now() + 10 * 60 * 1000;
        const token = await issueSignedToken({
          pathname,
          operations: ["put"],
          allowedContentTypes,
          maximumSizeInBytes,
          validUntil,
        });
        return {
          token,
          urlOptions: {
            allowedContentTypes,
            maximumSizeInBytes,
            validUntil,
            addRandomSuffix: false,
          },
        };
      },
      onUploadCompleted: async () => {
        /* Finalized by the signed-in browser so local development works too. */
      },
    });
    return NextResponse.json(result, { headers: noStore });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Upload failed");
  }
}
