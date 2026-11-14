import { NextResponse, type NextRequest } from "next/server";

/**
 * Appli mono-utilisateur : Basic Auth (utilisateur "admin", mot de passe APP_PASSWORD).
 * /api/cron/* a sa propre protection (Bearer CRON_SECRET) pour être appelé par le planificateur.
 * En production, l'appli refuse de démarrer sans mot de passe plutôt que d'être ouverte.
 */
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|api/cron).*)"] };

function safeEqual(a: string, b: string) {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

export function middleware(req: NextRequest) {
  const password = process.env.APP_PASSWORD;
  if (!password) {
    if (process.env.NODE_ENV === "production") {
      return new NextResponse("APP_PASSWORD manquant : appli verrouillée.", { status: 503 });
    }
    return NextResponse.next();
  }
  const header = req.headers.get("authorization") ?? "";
  const [scheme, encoded] = header.split(" ");
  if (scheme === "Basic" && encoded) {
    let decoded = "";
    try {
      decoded = atob(encoded);
    } catch {
      // en-tête mal formé : traité comme un échec d'authentification
    }
    const [user, ...rest] = decoded.split(":");
    if (user === "admin" && safeEqual(rest.join(":"), password)) return NextResponse.next();
  }
  return new NextResponse("Authentification requise", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="JobHunt", charset="UTF-8"' },
  });
}
