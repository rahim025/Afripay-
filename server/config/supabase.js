const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase = null;

if (!supabaseUrl || !supabaseKey) {
  console.warn('⚠️  SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY non définis — le serveur démarre sans base de données.');
} else {
  // On utilise la clé "service_role" côté serveur : elle contourne le Row Level
  // Security de Supabase, ce qui est nécessaire puisque l'API gère elle-même
  // l'authentification (JWT maison) plutôt que d'utiliser Supabase Auth.
  // Ne JAMAIS exposer cette clé côté client/navigateur.
  supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  console.log('✅ Client Supabase initialisé');
}

// Petit garde-fou : lève une erreur claire (au lieu d'un crash obscur)
// si les variables d'environnement ne sont pas configurées.
function getSupabase() {
  if (!supabase) {
    const err = new Error(
      'Base de données non configurée (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants dans .env)'
    );
    err.status = 500;
    throw err;
  }
  return supabase;
}

module.exports = { supabase, getSupabase };
