import { z } from "zod";
export const uuid = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
export const digest = z.string().regex(/^[A-F0-9]{64}$/);
export const sku = z.string().regex(/^YARIZAN-G[1-6]$/);
export const secret = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
export const password = z.string().min(12).max(128);
export const challengeSchema = z.strictObject({
  fingerprint_version: z.literal(2),
  fingerprint_digest: digest,
  device_public_key: z.string().max(256),
  purpose: z.enum(["PAIR", "AUTH", "CONFIRM"]),
  pairing_id: uuid.optional(),
});
export const proofSchema = z.strictObject({
  fingerprint_version: z.literal(2),
  fingerprint_digest: digest,
  device_public_key: z.string().max(256),
  challenge_id: uuid,
  challenge_signature: z.string().max(128),
});
export type Proof = z.infer<typeof proofSchema>;
export const startSchema = z.strictObject({
  device_id: uuid,
  client_nonce: digest,
  client_process_session_id: uuid,
});
export const redeemSchema = z.strictObject({
  activation_code: z.string().max(64),
  device_id: uuid,
  sku,
  request_id: uuid,
});
export const mutationSchema = z.strictObject({
  request_id: uuid,
  reason: z.string().min(8).max(512),
  expected_revision: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
  evidence_ref: z.string().min(8).max(256).optional(),
});
export type Mutation = z.infer<typeof mutationSchema>;
