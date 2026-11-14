import { env } from "~/env";

/** Notification push via ntfy.sh (no-op si NTFY_TOPIC n'est pas défini). */
export async function notify(title: string, body: string) {
  if (!env.NTFY_TOPIC) return;
  try {
    await fetch(`https://ntfy.sh/${encodeURIComponent(env.NTFY_TOPIC)}`, {
      method: "POST",
      headers: { Title: title },
      body,
    });
  } catch (e) {
    console.error("ntfy:", e);
  }
}
