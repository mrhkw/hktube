// HkTube storage is backed by Internet Archive. Heavy media is never proxied through Vercel.
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";

const ENDPOINT = process.env.ARCHIVE_ENDPOINT || "https://s3.us.archive.org";
const FRONTEND = process.env.ARCHIVE_FRONTEND || "https://archive.org";
const ACCESS_KEY = process.env.ARCHIVE_ACCESS_KEY || "";
const SECRET_KEY = process.env.ARCHIVE_SECRET_KEY || "";

function requireConfig() {
  if (!ACCESS_KEY || !SECRET_KEY) throw new Error("Internet Archive storage is not configured. Set ARCHIVE_ACCESS_KEY and ARCHIVE_SECRET_KEY in Vercel.");
}
function client() {
  requireConfig();
  return new S3Client({ region: "us-east-1", endpoint: ENDPOINT, forcePathStyle: true, credentials: { accessKeyId: ACCESS_KEY, secretAccessKey: SECRET_KEY } });
}
function normalizeKey(value: string) { return value.replace(/^\/+/, "").replace(/[^a-zA-Z0-9._\/-]/g, "-"); }
function publicUrl(identifier: string, key: string) { return `${FRONTEND.replace(/\/+$/, "")}/download/${encodeURIComponent(identifier)}/${key.split("/").map(encodeURIComponent).join("/")}`; }

export async function storagePresignPut(relKey: string, contentType = "application/octet-stream") {
  const identifier = `hktube-${randomUUID().replace(/-/g, "").slice(0, 24)}`;
  const key = normalizeKey(relKey);
  const url = await getSignedUrl(client(), new PutObjectCommand({ Bucket: identifier, Key: key, ContentType: contentType }), { expiresIn: 900 });
  return { key, identifier, url, publicUrl: publicUrl(identifier, key) };
}

export async function storagePut(relKey: string, data: Buffer | Uint8Array | string, contentType = "application/octet-stream") {
  const { url, key, identifier, publicUrl: urlOut } = await storagePresignPut(relKey, contentType);
  const blob = typeof data === "string" ? new Blob([data], { type: contentType }) : new Blob([data as any], { type: contentType });
  const response = await fetch(url, { method: "PUT", headers: { "Content-Type": contentType }, body: blob });
  if (!response.ok) throw new Error(`Archive.org upload failed (${response.status}): ${await response.text().catch(() => response.statusText)}`);
  return { key, identifier, url: urlOut };
}

export async function storageGet(relKey: string) {
  return { key: normalizeKey(relKey), url: `${FRONTEND.replace(/\/+$/, "")}/download/${normalizeKey(relKey)}` };
}

export async function storageGetSignedUrl(relKey: string) {
  const key = normalizeKey(relKey);
  const { url } = await storagePresignPut(key);
  return url;
}
