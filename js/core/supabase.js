// Connection to Supabase (database, photo storage, admin login).
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config.js';

const SUPABASE_JS_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

export const isConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

let clientPromise = null;

/** Returns the Supabase client, or null if js/config.js has not been filled in yet. */
export async function getSupabase() {
  if (!isConfigured) return null;
  clientPromise ??= import(SUPABASE_JS_URL).then(({ createClient }) => createClient(SUPABASE_URL, SUPABASE_ANON_KEY));
  return clientPromise;
}

/**
 * Make sure this browser has a session. Visitors don't create accounts: they get
 * an anonymous session, which lets the database know which photos are "theirs".
 */
export async function ensureVisitorSession(sb) {
  const { data: { session } } = await sb.auth.getSession();
  if (session) return session.user;
  const { data, error } = await sb.auth.signInAnonymously();
  if (error) {
    throw new Error('Could not start a visitor session. (Admin: make sure "Anonymous sign-ins" is enabled in Supabase → Authentication.)');
  }
  return data.user;
}

export async function isAdmin(sb) {
  const { data, error } = await sb.rpc('is_admin');
  return !error && data === true;
}
