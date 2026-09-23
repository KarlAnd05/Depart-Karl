# Depart Karl

A small website with games and a photo album:

| Page | File | What it does |
|---|---|---|
| Puzzle | `index.html` | Picks a random photo from `puzzle-photos/`, cuts it into pieces and shuffles them. |
| Custom Puzzle | `custom-puzzle.html` | Same puzzle, using a photo from the visitor's device (never uploaded). |
| Sudoku | `sudoku.html` | Playable Sudoku (Easy/Medium/Hard) with an optional background photo. |
| Photo Album | `album.html` | Upload photos as **public** (everyone) or **private** (admin only). |
| Admin | `admin.html` | Admin login; see every photo, switch public/private, delete. Linked in the footer. |

It is a plain HTML/CSS/JavaScript site (no build step), hosted on **GitHub Pages**.
The Photo Album uses **Supabase** (free) for the database, file storage and admin login.

Live site: **https://karland05.github.io/Depart-Karl/**

---

## 1. Turn on GitHub Pages (once)

Repo → **Settings → Pages → Build and deployment → Source: GitHub Actions**.

Every push to `main` then deploys the site automatically (see the **Actions** tab).

## 2. Add your own puzzle photos

Upload images (JPG, PNG, WebP, GIF or SVG) into the **`puzzle-photos/`** folder,
straight from github.com: open the folder → **Add file → Upload files** → Commit.
The list of photos (`manifest.json`) is rebuilt automatically when the site deploys.
Delete the sample `.svg` images whenever you like.

## 3. Set up the Photo Album (Supabase, once)

1. Create a free account and project at <https://supabase.com>.
2. **SQL Editor → New query**: paste all of [`supabase/setup.sql`](supabase/setup.sql) and click **Run**.
3. **Authentication → Sign In / Providers**: turn on **Allow anonymous sign-ins**.
   (Visitors don't create accounts; the site gives each browser an anonymous session so it knows which uploads are theirs.)
4. **Authentication → Users → Add user**: create *your* admin email + password (tick *Auto Confirm User*).
5. Back in the SQL Editor, make that user the admin:
   ```sql
   insert into public.admins (user_id)
   select id from auth.users where email = 'YOUR-EMAIL@example.com';
   ```
6. **Project Settings → API**: copy the **Project URL** and the **anon / publishable key** into
   [`js/config.js`](js/config.js) and commit. (The anon key is meant to be public; the
   database rules in `setup.sql` are what protect private photos.)

Then open `admin.html` on the live site and log in.

### How privacy works

- Photo files are in a **private** storage bucket. Each image is shown through a short-lived signed link.
- The database only hands out links for **public** photos, or for **any** photo when the admin is logged in.
  Private photos can't be viewed by anyone else, including the person who uploaded them.
- File type (JPEG/PNG/WebP/GIF) and size (≤ 5 MB) are checked in the browser **and** enforced by Supabase.

## Project structure

```
index.html, custom-puzzle.html, sudoku.html, album.html, admin.html   pages
css/styles.css                shared styles (mobile-first)
js/config.js                  settings (Supabase keys, upload limits)
js/core/site.js               navigation menu + footer (page list lives here)
js/core/image-utils.js        image validation / resizing
js/core/supabase.js           Supabase connection helpers
js/puzzle/puzzle-game.js      reusable puzzle engine
js/sudoku/                    Sudoku generator + board
js/album/photos.js            gallery helpers (signed links, lightbox, delete)
js/pages/*.js                 one small script per page
puzzle-photos/                photos for the Puzzle page
supabase/setup.sql            database + storage + security rules
.github/workflows/deploy.yml  automatic deploy to GitHub Pages
```

## Adding a new page

1. Copy an existing page, e.g. `sudoku.html` → `my-game.html`, and set `<body data-page="my-game">`.
2. Create `js/pages/my-game.js` (start it with `import '../core/site.js';`) and point the page's `<script>` at it.
3. Add `{ id: 'my-game', label: 'My Game', href: 'my-game.html' }` to `PAGES` in `js/core/site.js`.

## Running it locally (optional)

Any static web server works, e.g. `npx serve .` or `python -m http.server`, then open http://localhost:3000 (or :8000).
Opening the HTML files directly (`file://`) won't work because the pages use JavaScript modules.
