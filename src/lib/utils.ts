import cryptoNode from 'node:crypto';
//Hashing functions
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Genera un hash SHA-256 del texto de entrada.
 * Se usa para ofuscar direcciones IP (combinadas con IP_SALT)
 * antes de almacenarlas, como medida de privacidad.
 */

export function getUuidFromFirebaseUid(uid: string): string {
  const hash = cryptoNode.createHash('md5').update(uid).digest('hex');
  return [
    hash.substring(0, 8),
    hash.substring(8, 12),
    hash.substring(12, 16),
    hash.substring(16, 20),
    hash.substring(20, 32)
  ].join('-');
}


/**
 * Genera un hash SHA-256 del texto de entrada.
 * Se usa para ofuscar direcciones IP (combinadas con IP_SALT)
 * antes de almacenarlas, como medida de privacidad.
 */
export async function sha256Hash(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

//Se obtiene la id del dispositivo
export function getDeviceId(body: any): string | null {
  return body?.device_id || null;
}

/**
 * Obtiene la IP real del cliente considerando proxies inversos.
 * El orden de precedencia: Cloudflare, X-Forwarded-For, X-Real-IP.
 * Se hashea antes de almacenar por privacidad (ver sha256Hash).
 */
export function getClientIP(request: Request): string {
  return request.headers.get('cf-connecting-ip')
    || request.headers.get('x-forwarded-for')?.split(',')[0]
    || request.headers.get('x-real-ip')
    || 'unknown';
}

const ONE_HOUR_MS = 60 * 60 * 1000;

type RateLimitResult =
  | { allowed: true }
  | { allowed: false; reason: 'rate_limit' | 'internal'; details?: string };

  /**
   * Rate limiter por IP hasheada usando la tabla write_limits.
   * Si la IP excede el límite de operaciones en la última hora,
   * rechaza la solicitud. Crea el registro si no existe.
   */
export async function enforceIpRateLimit(
  supa: SupabaseClient,
  ipHash: string,
  limitPerHour = 60
): Promise<RateLimitResult> {
  const now = new Date();
  const cutoff = now.getTime() - ONE_HOUR_MS;
  const nowIso = now.toISOString();

  const { data, error } = await supa
    .from('write_limits')
    .select('count_1h, last_at')
    .eq('ip_hash', ipHash)
    .maybeSingle();

  if (error) {
    return { allowed: false, reason: 'internal', details: error.message };
  }

  if (!data) {
    const { error: insertError } = await supa
      .from('write_limits')
      .insert({ ip_hash: ipHash, last_at: nowIso, count_1h: 1 });
    if (insertError) {
      return { allowed: false, reason: 'internal', details: insertError.message };
    }
    return { allowed: true };
  }

  const lastAt = data.last_at ? new Date(data.last_at).getTime() : 0;
  const withinWindow = lastAt >= cutoff;
  const nextCount = withinWindow ? (data.count_1h ?? 0) + 1 : 1;

  if (withinWindow && nextCount > limitPerHour) {
    return { allowed: false, reason: 'rate_limit' };
  }

  const { error: updateError } = await supa
    .from('write_limits')
    .update({ last_at: nowIso, count_1h: nextCount })
    .eq('ip_hash', ipHash);

  if (updateError) {
    return { allowed: false, reason: 'internal', details: updateError.message };
  }

  return { allowed: true };
}
