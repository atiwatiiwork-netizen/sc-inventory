import "server-only";

export type PushResult = { ok: boolean; error?: string };

/** Push a single text message to a LINE user/group via the Messaging API. */
export async function pushText(token: string, to: string, text: string): Promise<PushResult> {
  if (!token) return { ok: false, error: "ไม่มี Channel Access Token" };
  if (!to) return { ok: false, error: "ไม่มีผู้รับ (group/user id)" };
  try {
    const res = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ to, messages: [{ type: "text", text }] }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `LINE ${res.status}: ${body.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
