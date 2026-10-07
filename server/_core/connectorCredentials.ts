import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import type { Express, Request, Response } from "express";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { getCredentialFields, type CredentialMode } from "@shared/connectorCredentials";
import { getDb } from "../db";
import { verifiedAdmin } from "./aiAdminRoute";

const connectorIdSchema = z.string().trim().regex(/^[a-z0-9][a-z0-9-]{1,119}$/);
const modeSchema = z.enum(["api-key", "oauth", "mcp", "webhook"]);
const credentialsSchema = z.record(z.string().trim().max(4096), z.string().max(20000)).refine(value => Object.keys(value).length <= 8, "Too many credential fields.");

const TABLE_SQL = `
CREATE TABLE IF NOT EXISTS ai_connector_credentials (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  owner_id VARCHAR(128) NOT NULL,
  connector_id VARCHAR(120) NOT NULL,
  auth_mode VARCHAR(32) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'connected',
  encrypted_payload LONGTEXT NOT NULL,
  iv VARBINARY(16) NOT NULL,
  auth_tag VARBINARY(16) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY ai_connector_owner_connector_unique (owner_id, connector_id),
  KEY ai_connector_owner_idx (owner_id),
  KEY ai_connector_status_idx (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`;

function encryptionKey() {
  const raw = process.env.CONNECTOR_CREDENTIALS_ENCRYPTION_KEY?.trim() || "";
  if (!raw) throw new Error("CONNECTOR_CREDENTIALS_ENCRYPTION_KEY is not configured.");
  return createHash("sha256").update(raw, "utf8").digest();
}

function encrypt(value: Record<string, string>) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return { encrypted: encrypted.toString("base64"), iv: iv.toString("base64"), authTag: cipher.getAuthTag().toString("base64") };
}

function decrypt(row: { encrypted_payload: string; iv: Buffer | string; auth_tag: Buffer | string }): Record<string, string> {
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(row.iv));
  decipher.setAuthTag(Buffer.from(row.auth_tag));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(row.encrypted_payload, "base64")), decipher.final()]).toString("utf8");
  const parsed: unknown = JSON.parse(plaintext);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Stored connector credentials are invalid.");
  return parsed as Record<string, string>;
}

async function ensureTable() {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  await db.execute(sql.raw(TABLE_SQL));
  return db;
}

function safeConnectorError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (/CONNECTOR_CREDENTIALS_ENCRYPTION_KEY/i.test(message)) return "Secure credential storage is not configured on the server yet.";
  if (/database/i.test(message)) return "Credential storage database is unavailable.";
  return "The connector credentials could not be saved securely.";
}

export async function listConnectorCredentialStatus(ownerId: string) {
  const db = await ensureTable();
  const result = await db.execute(sql`
    SELECT connector_id AS connectorId, auth_mode AS authMode, status, updated_at AS updatedAt
    FROM ai_connector_credentials
    WHERE owner_id = ${ownerId}
    ORDER BY updated_at DESC
  `);
  const rows = result[0] as Array<Record<string, unknown>>;
  return rows.map(row => ({
    connectorId: String(row.connectorId),
    authMode: String(row.authMode),
    status: String(row.status),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt ?? ""),
  }));
}

export async function getConnectorCredentials(ownerId: string, connectorId: string) {
  const db = await ensureTable();
  const result = await db.execute(sql`
    SELECT encrypted_payload, iv, auth_tag, auth_mode AS authMode, status
    FROM ai_connector_credentials
    WHERE owner_id = ${ownerId} AND connector_id = ${connectorId}
    LIMIT 1
  `);
  const rows = result[0] as Array<{ encrypted_payload: string; iv: Buffer | string; auth_tag: Buffer | string; authMode: string; status: string }>;
  const row = rows[0];
  if (!row) return null;
  return { credentials: decrypt(row), authMode: row.authMode, status: row.status };
}

async function upsertConnectorCredentials(ownerId: string, connectorId: string, authMode: CredentialMode, credentials: Record<string, string>) {
  const db = await ensureTable();
  const encrypted = encrypt(credentials);
  await db.execute(sql`
    INSERT INTO ai_connector_credentials
      (owner_id, connector_id, auth_mode, status, encrypted_payload, iv, auth_tag)
    VALUES
      (${ownerId}, ${connectorId}, ${authMode}, 'connected', ${encrypted.encrypted}, FROM_BASE64(${encrypted.iv}), FROM_BASE64(${encrypted.authTag}))
    ON DUPLICATE KEY UPDATE
      auth_mode = VALUES(auth_mode),
      status = 'connected',
      encrypted_payload = VALUES(encrypted_payload),
      iv = VALUES(iv),
      auth_tag = VALUES(auth_tag),
      updated_at = CURRENT_TIMESTAMP
  `);
}

async function disconnectConnector(ownerId: string, connectorId: string) {
  const db = await ensureTable();
  await db.execute(sql`
    DELETE FROM ai_connector_credentials
    WHERE owner_id = ${ownerId} AND connector_id = ${connectorId}
  `);
}

export function registerConnectorCredentialRoutes(app: Express) {
  app.get("/api/ai/connectors/status", async (req: Request, res: Response) => {
    const controller = new AbortController();
    try {
      const verification = await verifiedAdmin(req, controller.signal);
      if (!verification.ok) {
        res.status(401).json({ error: { message: "Admin session is required." } });
        return;
      }
      const ownerId = typeof verification.user.id === "string" ? verification.user.id : "";
      if (!ownerId) {
        res.status(401).json({ error: { message: "Admin session is invalid." } });
        return;
      }
      res.status(200).json({ connectors: await listConnectorCredentialStatus(ownerId) });
    } catch (error) {
      console.error("[AI Connectors] status failed", safeConnectorError(error));
      res.status(503).json({ error: { message: safeConnectorError(error) } });
    }
  });

  app.post("/api/ai/connectors/:connectorId", async (req: Request, res: Response) => {
    const controller = new AbortController();
    try {
      const verification = await verifiedAdmin(req, controller.signal);
      if (!verification.ok) {
        res.status(401).json({ error: { message: "Admin session is required." } });
        return;
      }
      const ownerId = typeof verification.user.id === "string" ? verification.user.id : "";
      if (!ownerId) {
        res.status(401).json({ error: { message: "Admin session is invalid." } });
        return;
      }

      const connector = connectorIdSchema.safeParse(req.params.connectorId);
      if (!connector.success) {
        res.status(400).json({ error: { message: "Invalid connector id." } });
        return;
      }
      const bodySchema = z.object({
        authMode: modeSchema,
        credentials: credentialsSchema,
      });
      const parsed = bodySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: { message: parsed.error.issues[0]?.message ?? "Invalid connector credentials." } });
        return;
      }

      const fields = getCredentialFields(connector.data, parsed.data.authMode === "api-key" ? "API Key" : parsed.data.authMode === "oauth" ? "OAuth" : parsed.data.authMode === "mcp" ? "MCP" : "Webhook", parsed.data.authMode);
      const allowed = new Map(fields.map(field => [field.key, field]));
      const sanitized: Record<string, string> = {};
      for (const [key, value] of Object.entries(parsed.data.credentials)) {
        const definition = allowed.get(key);
        if (!definition) continue;
        const clean = value.trim();
        if (clean) sanitized[key] = clean;
      }
      for (const field of fields) {
        if (field.required && !sanitized[field.key]) {
          res.status(400).json({ error: { message: `${field.label} is required.` } });
          return;
        }
      }
      if (!Object.keys(sanitized).length) {
        res.status(400).json({ error: { message: "Enter at least one valid credential value." } });
        return;
      }

      await upsertConnectorCredentials(ownerId, connector.data, parsed.data.authMode, sanitized);
      res.status(200).json({ connectorId: connector.data, status: "connected", saved: true });
    } catch (error) {
      console.error("[AI Connectors] save failed", safeConnectorError(error));
      res.status(503).json({ error: { message: safeConnectorError(error) } });
    }
  });

  app.delete("/api/ai/connectors/:connectorId", async (req: Request, res: Response) => {
    const controller = new AbortController();
    try {
      const verification = await verifiedAdmin(req, controller.signal);
      if (!verification.ok) {
        res.status(401).json({ error: { message: "Admin session is required." } });
        return;
      }
      const ownerId = typeof verification.user.id === "string" ? verification.user.id : "";
      const connector = connectorIdSchema.safeParse(req.params.connectorId);
      if (!ownerId || !connector.success) {
        res.status(400).json({ error: { message: "Invalid connector request." } });
        return;
      }
      await disconnectConnector(ownerId, connector.data);
      res.status(200).json({ connectorId: connector.data, status: "disconnected" });
    } catch (error) {
      console.error("[AI Connectors] disconnect failed", safeConnectorError(error));
      res.status(503).json({ error: { message: safeConnectorError(error) } });
    }
  });
}
