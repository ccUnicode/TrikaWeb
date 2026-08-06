import type { Session } from '@supabase/supabase-js';

type CookieStore = {
  set: (name: string, value: string, options: Record<string, unknown>) => void;
  delete: (name: string, options: { path: string }) => void;
};

export function setAuthSessionCookies(cookies: CookieStore, session: Session) {
  cookies.set('sb-access-token', session.access_token, {
    path: '/',
    secure: import.meta.env.PROD,
    httpOnly: true,
    sameSite: 'lax',
    maxAge: session.expires_in,
  });
  cookies.set('sb-refresh-token', session.refresh_token, {
    path: '/',
    secure: import.meta.env.PROD,
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60,
  });
}

export function clearAuthSessionCookies(cookies: CookieStore) {
  cookies.delete('sb-access-token', { path: '/' });
  cookies.delete('sb-refresh-token', { path: '/' });
}
