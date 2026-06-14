// src/pages/api/cursos/index.ts
// Devuelve cursos filtrados por query para el autocomplete.
// Acepta ?q= para filtrar por código o nombre usando ilike en BD.
// Sin query, devuelve los primeros 30 cursos ordenados por código.

export const prerender = false;

import type { APIRoute } from "astro";
import { supabaseClient } from "../../../lib/supabase.client";

export const GET: APIRoute = async ({ url }) => {
  try {
    const q = (url.searchParams.get("q") ?? "").trim();

    let query = supabaseClient
      .from("courses")
      .select("id, code, name")
      .order("code", { ascending: true })
      .limit(30);

    if (q) {
      // Filtrar por código o nombre en la BD (accent-insensitive gracias a ilike)
      query = query.or(`code.ilike.%${q}%,name.ilike.%${q}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error obteniendo cursos:", error);
      return new Response(
        JSON.stringify({ ok: false, error: "Error al obtener cursos" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ ok: true, cursos: data || [] }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error inesperado en /api/cursos:", err);
    return new Response(
      JSON.stringify({ ok: false, error: "Error interno del servidor" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
