/**
 * supabaseClient.ts — Cliente Supabase compartilhado
 *
 * Aplicação interna: sem autenticação — usa ANON KEY diretamente.
 * A URL do projeto é derivada do payload do JWT (claim "ref").
 */

import { createClient } from '@supabase/supabase-js';

// Projeto Branco Peres — Supabase
export const SUPABASE_URL = 'https://qcpnnyqzosnomvvytmfi.supabase.co';
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjcG5ueXF6b3Nub212dnl0bWZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU5NjMwMTMsImV4cCI6MjEwMTUzOTAxM30.TtPkAWvyDtpxXKVnxGmK2-1-6zhKZIC7bZApPFg2W70';

// Nome da tabela usada pela seção Lavagem e Lubrificação
export const LAVAGEM_TABLE = 'lavagem_lubrificacao';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
  global: {
    headers: { 'X-Client-Info': 'branco-peres-lavagem' },
  },
});
