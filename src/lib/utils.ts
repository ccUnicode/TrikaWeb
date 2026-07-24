import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * sha256Hash — Genera un hash SHA-256 de un texto.
 * Se usa para ofuscar direcciones IP y preservar privacidad.
 */
export async function sha256Hash(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * getDeviceId — Extrae el device_id del body (usado para identificar voto único).
 */
export function getDeviceId(body: any): string | null {
  return body?.device_id || null;
}

/**
 * getClientIP — Obtiene la IP real del cliente respetando proxies (Cloudflare, x-forwarded-for).
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
 * enforceIpRateLimit — Rate-limiter por IP.
 * Usa la tabla write_limits para contar solicitudes por hora.
 * Si se excede el límite, rechaza con allowed=false reason='rate_limit'.
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
