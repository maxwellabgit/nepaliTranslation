import { assertEquals } from "jsr:@std/assert@1";
import { purgeUserStorageObjects } from "../_shared/storagePurge.ts";

Deno.test("purgeUserStorageObjects deletes listed objects", async () => {
  const calls: string[] = [];
  const fetchImpl = async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("service_list_user_media_objects")) {
      return new Response(JSON.stringify([
        { bucket_id: "contribution-photos", object_path: "user/photo.jpg" },
      ]), { status: 200 });
    }
    if (url.includes("/storage/v1/object/")) {
      calls.push(url);
      return new Response(null, { status: 200 });
    }
    return new Response("unexpected", { status: 500 });
  };

  const removed = await purgeUserStorageObjects("11111111-1111-4111-8111-111111111111", {
    url: "https://example.supabase.co",
    service: "service-key",
    fetchImpl,
  });

  assertEquals(removed.ok, true);
  assertEquals(removed.removed, 1);
  assertEquals(calls.length, 1);
  assertEquals(calls[0]?.includes("contribution-photos/user/photo.jpg"), true);
});
