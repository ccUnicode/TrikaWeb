import cryptoNode from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Convierte de forma determinística un UID de Firebase en un valor compatible
 * con columnas UUID de PostgreSQL.
 *
 * El resultado se utiliza como identificador estable del usuario autenticado
 * en tablas que todavía almacenan la identidad en una columna `device_id`.
 */
export function getUuidFromFirebaseUid(uid: string): string {
  const hash = cryptoNode.createHash("md5").update(uid).digest("hex");

  return [
    hash.substring(0, 8),
    hash.substring(8, 12),
    hash.substring(12, 16),
    hash.substring(16, 20),
    hash.substring(20, 32),
  ].join("-");
}

/**
 * Genera un hash SHA-256 del texto recibido.
 *
 * Se utiliza para ofuscar direcciones IP combinadas con `IP_SALT` antes de
 * almacenarlas.
 */
export async function sha256Hash(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));

  return hashArray
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Extrae el `device_id` enviado en el cuerpo de una solicitud.
 *
 * Se conserva para los flujos anónimos que todavía utilizan un identificador
 * generado en el cliente, como vistas o intereses.
 */
export function getDeviceId(body: unknown): string | null {
  if (
    typeof body !== "object" ||
    body === null ||
    !("device_id" in body)
  ) {
    return null;
  }

  const deviceId = (body as { device_id?: unknown }).device_id;

  return typeof deviceId === "string" && deviceId.trim()
    ? deviceId.trim()
    : null;
}

/**
 * Obtiene la IP real del cliente considerando proxies inversos.
 *
 * Orden de precedencia:
 * 1. Cloudflare (`cf-connecting-ip`)
 * 2. Primer valor de `x-forwarded-for`
 * 3. `x-real-ip`
 */
export function getClientIP(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

const ONE_HOUR_MS = 60 * 60 * 1000;

type RateLimitResult =
  | { allowed: true }
  | {
      allowed: false;
      reason: "rate_limit" | "internal";
      details?: string;
    };

/**
 * Aplica rate limiting por IP hasheada utilizando la tabla `write_limits`.
 *
 * Si no existe un registro para la IP, crea uno. Cuando la última operación
 * ocurrió fuera de la ventana de una hora, reinicia el contador.
 */
export async function enforceIpRateLimit(
  supabase: SupabaseClient,
  ipHash: string,
  limitPerHour = 60,
): Promise<RateLimitResult> {
  const now = new Date();
  const cutoff = now.getTime() - ONE_HOUR_MS;
  const nowIso = now.toISOString();

  const { data, error } = await supabase
    .from("write_limits")
    .select("count_1h, last_at")
    .eq("ip_hash", ipHash)
    .maybeSingle();

  if (error) {
    return {
      allowed: false,
      reason: "internal",
      details: error.message,
    };
  }

  if (!data) {
    const { error: insertError } = await supabase
      .from("write_limits")
      .insert({
        ip_hash: ipHash,
        last_at: nowIso,
        count_1h: 1,
      });

    if (insertError) {
      return {
        allowed: false,
        reason: "internal",
        details: insertError.message,
      };
    }

    return { allowed: true };
  }

  const lastAt = data.last_at ? new Date(data.last_at).getTime() : 0;
  const withinWindow = lastAt >= cutoff;
  const nextCount = withinWindow ? (data.count_1h ?? 0) + 1 : 1;

  if (withinWindow && nextCount > limitPerHour) {
    return {
      allowed: false,
      reason: "rate_limit",
    };
  }

  const { error: updateError } = await supabase
    .from("write_limits")
    .update({
      last_at: nowIso,
      count_1h: nextCount,
    })
    .eq("ip_hash", ipHash);

  if (updateError) {
    return {
      allowed: false,
      reason: "internal",
      details: updateError.message,
    };
  }

  return { allowed: true };
}
