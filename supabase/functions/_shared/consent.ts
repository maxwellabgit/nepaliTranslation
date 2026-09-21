import { mapRpcError, statusForError, type ErrorCode } from "./http.ts";

const SERVICE_HEADERS = (service: string) => ({
  authorization: `Bearer ${service}`,
  apikey: service,
  "content-type": "application/json",
});

export async function assertConsentOrError(
  url: string,
  service: string,
  userId: string,
): Promise<ErrorCode | null> {
  const res = await fetch(`${url}/rest/v1/rpc/service_assert_contribution_consent`, {
    method: "POST",
    headers: SERVICE_HEADERS(service),
    body: JSON.stringify({ p_user_id: userId }),
  });
  if (res.ok) return null;
  const text = await res.text();
  return mapRpcError(text) ?? "unavailable";
}

export function rpcErrorResponse(
  errText: string,
  requestId: string,
  fallback: ErrorCode = "unavailable",
): { code: ErrorCode; status: number } {
  const code = mapRpcError(errText) ?? fallback;
  return { code, status: statusForError(code) };
}
