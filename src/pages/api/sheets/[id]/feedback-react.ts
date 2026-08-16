export const prerender = false;
import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { getUserSession } from '../../../../lib/auth';

const VALID_REACTIONS = ['like', 'love', 'haha', 'wow', 'sad'];

export const POST: APIRoute = async ({ request, cookies }) => {
  const { user } = await getUserSession(cookies);
  if (!user) {
    return new Response(
      JSON.stringify({ error: 'Debes iniciar sesión para reaccionar.' }),
      { status: 401 }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'JSON inválido' }), { status: 400 });
  }

  const { feedback_id, reaction } = body;

  if (!feedback_id || typeof feedback_id !== 'number') {
    return new Response(JSON.stringify({ error: 'feedback_id inválido' }), { status: 400 });
  }

  if (!reaction || !VALID_REACTIONS.includes(reaction)) {
    return new Response(JSON.stringify({ error: 'Reacción inválida' }), { status: 400 });
  }

  const supa = supabaseAdmin;

  // Verify the feedback exists
  const { data: feedback, error: feedbackError } = await supa
    .from('sheet_feedback')
    .select('id')
    .eq('id', feedback_id)
    .single();

  if (feedbackError || !feedback) {
    return new Response(JSON.stringify({ error: 'Comentario no encontrado' }), { status: 404 });
  }

  // Check if user already reacted
  const { data: existingReaction, error: existingError } = await supa
    .from('sheet_feedback_reactions')
    .select('id, reaction')
    .eq('feedback_id', feedback_id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existingError) {
    console.error('Error fetching existing reaction:', existingError);
    return new Response(JSON.stringify({ error: 'Error interno verificando reacción' }), { status: 500 });
  }

  let userReaction = null;

  if (existingReaction) {
    if (existingReaction.reaction === reaction) {
      // Toggle off: user clicked the same reaction they already had
      const { error: deleteError } = await supa
        .from('sheet_feedback_reactions')
        .delete()
        .eq('id', existingReaction.id);

      if (deleteError) {
        return new Response(JSON.stringify({ error: 'Error al quitar reacción' }), { status: 500 });
      }
      userReaction = null; // No reaction anymore
    } else {
      // Update: user changed their reaction
      const { error: updateError } = await supa
        .from('sheet_feedback_reactions')
        .update({ reaction })
        .eq('id', existingReaction.id);

      if (updateError) {
        return new Response(JSON.stringify({ error: 'Error al actualizar reacción' }), { status: 500 });
      }
      userReaction = reaction;
    }
  } else {
    // Insert: new reaction
    const { error: insertError } = await supa
      .from('sheet_feedback_reactions')
      .insert({
        feedback_id,
        user_id: user.id,
        reaction
      });

    if (insertError) {
      return new Response(JSON.stringify({ error: 'Error al guardar reacción' }), { status: 500 });
    }
    userReaction = reaction;
  }

  // Fetch updated counts
  const { data: allReactions, error: countError } = await supa
    .from('sheet_feedback_reactions')
    .select('reaction')
    .eq('feedback_id', feedback_id);

  const counts: Record<string, number> = { like: 0, love: 0, haha: 0, wow: 0, sad: 0 };
  
  if (allReactions) {
    allReactions.forEach(r => {
      if (counts[r.reaction] !== undefined) counts[r.reaction]++;
    });
  }

  return new Response(
    JSON.stringify({
      success: true,
      userReaction,
      reactions: counts,
      totalReactions: allReactions?.length || 0
    }),
    { status: 200 }
  );
};
