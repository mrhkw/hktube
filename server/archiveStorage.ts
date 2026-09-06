import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";

const ENDPOINT = process.env.ARCHIVE_ENDPOINT || "https://s3.us.archive.org";
const FRONTEND = process.env.ARCHIVE_FRONTEND || "https://archive.org";
const ACCESS_KEY = process.env.ARCHIVE_ACCESS_KEY || "";
const SECRET_KEY = process.env.ARCHIVE_SECRET_KEY || "";

function requireConfig() {
  if (!ACCESS_KEY || !SECRET_KEY) {
    throw new Error("Internet Archive storage is not configured. Set ARCHIVE_ACCESS_KEY and ARCHIVE_SECRET_KEY in Vercel.");
  }
}

function cleanSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-").replace(/^[-.]+|[-.]+$/g, "").slice(0, 100) || "media";
}

function client() {
  requireConfig();
  return new S3Client({
    region: "us-east-1",
    endpoint: ENDPOINT,
    forcePathStyle: true,
    credentials: { accessKeyId: ACCESS_KEY, secretAccessKey: SECRET_KEY },
  });
}

export function archivePublicUrl(identifier: string, key: string) {
  return `${FRONTEND.replace(/\/+$/, "")}/download/${encodeURIComponent(identifier)}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

export function archiveDetailsUrl(identifier: string) {
  return `${FRONTEND.replace(/\/+$/, "")}/details/${encodeURIComponent(identifier)}`;
}

export async function archiveStoragePresignPut(options: {
  userId: number | string;
  kind: "video" | "thumbnail" | "caption";
  filename: string;
  contentType: string;
}) {
  requireConfig();
  const identifier = `hktube-${cleanSegment(String(options.userId))}-${randomUUID().replace(/-/g, "").slice(0, 20)}`;
  const key = `${options.kind}/${cleanSegment(options.filename)}`;
  const command = new GetObjectCommand({ Bucket: identifier, Key: key, ResponseContentType: options.contentType });
  // IA's S3-compatible endpoint accepts AWS-style presigned requests for item files.
  const url = await getSignedUrl(client(), command, { expiresIn: 900 });
  return {
    key,
    identifier,
    url: url.replace("/", "/"),
    publicUrl: archivePublicUrl(identifier, key),
    detailsUrl: archiveDetailsUrl(identifier),
  };
}

export async function archiveStoragePresignUpload(options: {
  userId: number | string;
  kind: "video" | "thumbnail" | "caption";
  filename: string;
  contentType: string;
}) {
  requireConfig();
  const identifier = `hktube-${cleanSegment(String(options.userId))}-${randomUUID().replace(/-/g, "").slice(0, 20)}`;
  const key = `${options.kind}/${cleanSegment(options.filename)}`;
  const s3 = client();
  const { PutObjectCommand } = await import("@aws-sdk/client-s3");
  const url = await getSignedUrl(s3, new PutObjectCommand({ Bucket: identifier, Key: key, ContentType: options.contentType }), { expiresIn: 900 });
  return { key, identifier, url, publicUrl: archivePublicUrl(identifier, key), detailsUrl: archiveDetailsUrl(identifier) };
}

export async function archiveStorageGetSignedUrl(identifier: string, key: string) {
  requireConfig();
  return getSignedUrl(client(), new GetObjectCommand({ Bucket: identifier, Key: key }), { expiresIn: 900 });
}
