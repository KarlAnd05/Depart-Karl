// Site-wide settings.
//
// Supabase powers the Photo Album and Admin pages. Fill these in from your
// Supabase project (Project Settings → API). The anon/publishable key is meant
// to be public: access is enforced by the database policies in supabase/setup.sql.
export const SUPABASE_URL = '';
export const SUPABASE_ANON_KEY = '';

// Storage bucket for album photos (created by supabase/setup.sql).
export const PHOTO_BUCKET = 'photos';

// Max size for album uploads. Keep in sync with supabase/setup.sql.
export const ALBUM_MAX_BYTES = 5 * 1024 * 1024;

// Max size for images that are only used inside the browser
// (custom puzzle, Sudoku background). They are never uploaded.
export const LOCAL_IMAGE_MAX_BYTES = 15 * 1024 * 1024;
