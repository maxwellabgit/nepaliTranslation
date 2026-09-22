import { assertEquals } from "jsr:@std/assert@1";
import { z } from "npm:zod@3.24.2";
import { mapRpcError, statusForError } from "../_shared/http.ts";

const createMediaSchema = z.object({
  kind: z.enum(["speech", "photo"]),
  idempotency_key: z.string().min(8).max(128),
  content_type: z.string().min(3).max(120),
  byte_size: z.number().int().positive().max(26_214_400),
  metadata: z.record(z.unknown()).optional(),
});

const completeMediaSchema = z.object({
  media_id: z.string().uuid(),
  sha256: z.string().min(8).max(128).optional().nullable(),
});

Deno.test("create-media-upload schema accepts speech and photo", () => {
  const speech = createMediaSchema.safeParse({
    kind: "speech",
    idempotency_key: "idemp-speech-1",
    content_type: "audio/mp4",
    byte_size: 1024,
  });
  assertEquals(speech.success, true);

  const photo = createMediaSchema.safeParse({
    kind: "photo",
    idempotency_key: "idemp-photo-1",
    content_type: "image/jpeg",
    byte_size: 2048,
  });
  assertEquals(photo.success, true);
});

Deno.test("create-media-upload schema rejects guests-style empty keys", () => {
  const bad = createMediaSchema.safeParse({
    kind: "photo",
    idempotency_key: "short",
    content_type: "image/jpeg",
    byte_size: 100,
  });
  assertEquals(bad.success, false);
});

Deno.test("complete-media-upload schema requires uuid media_id", () => {
  const ok = completeMediaSchema.safeParse({
    media_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    sha256: "abc12345deadbeef",
  });
  assertEquals(ok.success, true);

  const bad = completeMediaSchema.safeParse({ media_id: "not-a-uuid" });
  assertEquals(bad.success, false);
});

Deno.test("flag_disabled maps to 403", () => {
  assertEquals(mapRpcError("ERROR: flag_disabled"), "flag_disabled");
  assertEquals(statusForError("flag_disabled"), 403);
});
