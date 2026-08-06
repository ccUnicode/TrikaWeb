// src/pages/api/cursos/index.ts
// Devuelve la lista de todos los cursos (código + nombre) para el autocomplete.

export const prerender = false;

import type { APIRoute } from "astro";
import { supabaseClient } from "../../../lib/supabase.client";

export const GET: APIRoute = async () => {
  try {
    const { data, error } = await supabaseClient
      .from("courses")
      .select("id, code, name")
      .order("code", { ascending: true })
      .limit(500);

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
