//Hashing functions
import type { SupabaseClient } from '@supabase/supabase-js';

export async function sha256Hash(text: string): Promise<string> {
  // Convierte el texto a bytes
  const data = new TextEncoder().encode(text);
  
  // Crea el hash usando el algoritmo SHA-256
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  
  // Convierte los bytes a texto hexadecimal
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

//Se obtiene la id del dispositivo
export function getDeviceId(body: any): string | null {
  return body?.device_id || null;
}

//Se obtiene la ip del cliente
export function getClientIP(request: Request): string {
  // Intenta obtener la IP de los headers (si usas Cloudflare o proxy)
  return request.headers.get('cf-connecting-ip') 
    || request.headers.get('x-forwarded-for')?.split(',')[0]
    || request.headers.get('x-real-ip')
    || 'unknown';
}

const ONE_HOUR_MS = 60 * 60 * 1000;

type RateLimitResult =
  | { allowed: true }
  | { allowed: false; reason: 'rate_limit' | 'internal'; details?: string };

  // Función para aplicar limitar la escritura por IP
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
