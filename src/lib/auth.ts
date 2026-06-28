import { getFirebaseAdminAuth } from './firebase-admin';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: 'student' | 'admin';
}

export async function getUserSession(cookies: any): Promise<{ user: any, profile: UserProfile | null }> {
  const firebaseSession = cookies.get('firebase_session');

  if (!firebaseSession?.value) {
    return { user: null, profile: null };
  }

  try {
    const auth = getFirebaseAdminAuth();

    if (!auth) {
      return { user: null, profile: null };
    }

    const decoded = await auth.verifySessionCookie(firebaseSession.value, true);
    const email = decoded.email?.toLowerCase();

    if (!email || !email.endsWith('@uni.pe')) {
      return { user: null, profile: null };
    }

    const profile: UserProfile = {
      id: decoded.uid,
      email,
      full_name: decoded.name || email.split('@')[0] || 'Estudiante',
      role: 'student',
    };

    return { 
      user: decoded, 
      profile 
    };
  } catch (err) {
    console.error('Unexpected error in getUserSession:', err);
    return { user: null, profile: null };
  }
}
