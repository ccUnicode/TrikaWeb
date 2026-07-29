import type { APIRoute } from 'astro';
import { getFirebaseAdminAuth, hasFirebaseAdminEnv } from '../../../lib/firebase-admin';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const body = await request.json();
    const { idToken } = body;

    if (!idToken) {
      return new Response(JSON.stringify({ error: 'Falta el token de Firebase' }), { status: 400 });
    }

    if (!hasFirebaseAdminEnv()) {
      return new Response(
        JSON.stringify({
          error: 'Faltan las variables de entorno de Firebase Admin en el servidor',
        }),
        { status: 503 }
      );
    }

    const auth = getFirebaseAdminAuth();

    if (!auth) {
      return new Response(
        JSON.stringify({
          error: 'No se pudo inicializar Firebase Admin en el servidor',
        }),
        { status: 503 }
      );
    }

    const decodedToken = await auth.verifyIdToken(idToken);
    const email = decodedToken.email?.toLowerCase();

    if (!email || !email.endsWith('@uni.pe')) {
      return new Response(JSON.stringify({ error: 'Solo se permiten correos @uni.pe' }), { status: 403 });
    }

    // Asegurar que el estudiante tenga un perfil base para no romper las FKs
    const { error: upsertError } = await supabaseAdmin
      .from('student_details')
      .upsert({
        user_id: decodedToken.uid,
        email: email,
        full_name: decodedToken.name || email.split('@')[0] || 'Estudiante'
      }, { onConflict: 'user_id' });

    if (upsertError) {
       console.error('Error creando perfil base del estudiante:', upsertError);
    }

    const expiresIn = 1000 * 60 * 60 * 24 * 5;
    const sessionCookie = await auth.createSessionCookie(idToken, { expiresIn });

    cookies.set('firebase_session', sessionCookie, {
      path: '/',
      secure: true,
      httpOnly: true,
      sameSite: 'lax',
      maxAge: expiresIn / 1000,
    });

    return new Response(JSON.stringify({
      success: true,
      user: {
        uid: decodedToken.uid,
        email,
        name: decodedToken.name ?? null,
      },
    }), { status: 200 });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
};
