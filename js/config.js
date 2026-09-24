// Site-wide settings.
//
// Supabase powers the Messages and Admin pages. Fill these in from your
// Supabase project (Project Settings → API). The anon/publishable key is meant
// to be public: access is enforced by the database policies in supabase/migrations/.
export const SUPABASE_URL = 'https://tjbtgmcmuhbqhjinzdov.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_sUPX1xb0gsr5KSig-zA-Kw__GNEc7rL';

// Storage bucket for photos attached to messages (created in supabase/migrations/).
export const MESSAGE_PHOTO_BUCKET = 'message-photos';

// Longest message allowed. Keep in sync with supabase/migrations.
export const MESSAGE_MAX_LENGTH = 2000;

// Max size of a stored photo. Keep in sync with supabase/migrations.
export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;

// Photos bigger than this (in pixels or bytes) are resized in the browser
// before uploading, so phone photos "just work". Files larger than
// PHOTO_MAX_INPUT_BYTES are refused outright.
export const PHOTO_MAX_SIDE_PX = 2560;
export const PHOTO_MAX_INPUT_BYTES = 30 * 1024 * 1024;

// Max size for images that are only used inside the browser
// (custom puzzle). They are never uploaded.
export const LOCAL_IMAGE_MAX_BYTES = 15 * 1024 * 1024;
