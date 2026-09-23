// Site-wide settings.
//
// Supabase powers the Photo Album and Admin pages. Fill these in from your
// Supabase project (Project Settings → API). The anon/publishable key is meant
// to be public: access is enforced by the database policies in supabase/migrations/.
export const SUPABASE_URL = '';
export const SUPABASE_ANON_KEY = '';

// Storage bucket for album photos (created by the SQL in supabase/migrations/).
export const PHOTO_BUCKET = 'photos';

// Max size of a stored album photo. Keep in sync with the SQL in supabase/migrations.
export const ALBUM_MAX_BYTES = 5 * 1024 * 1024;

// Album photos bigger than this (in pixels or bytes) are resized in the browser
// before uploading, so phone photos "just work". Files larger than
// ALBUM_MAX_INPUT_BYTES are refused outright.
export const ALBUM_MAX_SIDE_PX = 2560;
export const ALBUM_MAX_INPUT_BYTES = 30 * 1024 * 1024;

// Photos loaded per "page" in the gallery.
export const GALLERY_PAGE_SIZE = 24;

// Max size for images that are only used inside the browser
// (custom puzzle, Sudoku background). They are never uploaded.
export const LOCAL_IMAGE_MAX_BYTES = 15 * 1024 * 1024;
