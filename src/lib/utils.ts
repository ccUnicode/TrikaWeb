// ==========================================
// UTILIDADES PARA TU API
// ==========================================

/**
 * Función: sha256Hash
 * ¿Qué hace?: Convierte texto en un código irreconocible (hash)
 * ¿Para qué?: Proteger IPs de usuarios
 * Ejemplo: "192.168.1.1" → "a3f8b2c9d1e..."
 */
export async function sha256Hash(text: string): Promise<string> {
  // Convierte el texto a bytes
  const data = new TextEncoder().encode(text);
  
  // Crea el hash usando el algoritmo SHA-256
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  
  // Convierte los bytes a texto hexadecimal
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Función: getDeviceId
 * ¿Qué hace?: Extrae el ID del dispositivo desde el cuerpo de la petición
 * ¿Para qué?: Identificar al usuario sin usar cookies
 */
export function getDeviceId(body: any): string | null {
  return body?.device_id || null;
}

/**
 * Función: getClientIP
 * ¿Qué hace?: Obtiene la IP del usuario que hace la petición
 * ¿Para qué?: Para el rate limiting (evitar spam)
 */
export function getClientIP(request: Request): string {
  // Intenta obtener la IP de los headers (si usas Cloudflare o proxy)
  return request.headers.get('cf-connecting-ip') 
    || request.headers.get('x-forwarded-for')?.split(',')[0]
    || request.headers.get('x-real-ip')
    || 'unknown';
}