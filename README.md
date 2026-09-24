# Depart Karl

A small website with games and an anonymous message box:

| Page | File | What it does |
|---|---|---|
| Puzzle | `index.html` | Picks a random photo from `puzzle-photos/`, cuts it into pieces and shuffles them. |
| Custom Puzzle | `custom-puzzle.html` | Same puzzle, using a photo from the visitor's device (never uploaded). |
| Sudoku | `sudoku.html` | Playable Sudoku (Easy/Medium/Hard) with a timer, undo and mistake checking. |
| Messages | `messages.html` | Visitors send Karl an **anonymous** message, with a photo if they want. |
| Admin | `admin.html` | Admin login; read messages and their photos, mark read/unread, delete. Linked in the footer. |

It is a plain HTML/CSS/JavaScript site (no build step), hosted on **GitHub Pages**.
Messages use **Supabase** (free) for the database, photo storage and admin login.

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

## 3. Set up Messages (Supabase, once)

1. Create a free account and project at <https://supabase.com>.
2. Create the database tables, photo storage and security rules from
   [`supabase/migrations/`](supabase/migrations), in one of two ways:
   - **With the Supabase GitHub integration:** connect this repo in Supabase (Project Settings → Integrations → GitHub),
     keep the Supabase directory as `supabase`, and turn on **Deploy to production** for the `main` branch.
     The SQL is applied automatically on every push to `main`.
   - **Manually:** open **SQL Editor → New query**, paste each migration file (oldest first), and click **Run**.
3. **Authentication → Sign In / Providers**: turn on **Allow anonymous sign-ins**.
   (Visitors don't create accounts; the site gives each sender an anonymous session so uploads and spam limits work.)
4. **Authentication → Users → Add user**: create *your* admin email + password (tick *Auto Confirm User*),
   then copy the new user's **User UID**.
5. **Table Editor → admins → Insert row**: paste the UID into `user_id` and save. That account is now the admin.
6. **Project Settings → API**: copy the **Project URL** and the **anon / publishable key** into
   [`js/config.js`](js/config.js) and commit. (The anon key is meant to be public; the
   database rules in the migrations are what keep messages private.)

Then open `admin.html` on the live site and log in to read messages.

### How privacy works

- Senders are anonymous: the site never asks for a name or email, and the admin page doesn't show who sent what.
- Only the admin can read messages. Attached photos are in a **private** storage bucket and are shown to the
  admin through short-lived signed links.
- Each visitor can send at most 10 messages per hour (enforced by the database).
- Photo type (JPEG/PNG/WebP/GIF) and size (≤ 5 MB) are checked in the browser **and** enforced by Supabase.
  Larger photos (e.g. from phones) are resized in the browser before uploading.

## Changing the look

All colors, fonts, radii and shadows are defined as variables in [`css/tokens.css`](css/tokens.css).
Change them there to restyle the whole site; [`css/styles.css`](css/styles.css) holds the layout and components.

## Project structure

```
index.html, custom-puzzle.html, sudoku.html, messages.html, admin.html, 404.html   pages
favicon.svg                   site icon
css/tokens.css                design variables (colors, fonts, sizes)
css/styles.css                layout + components (mobile-first)
js/config.js                  settings (Supabase keys, limits)
js/core/site.js               navigation menu + footer (page list lives here)
js/core/ui.js                 toast messages, confirm dialog, loading indicator
js/core/icons.js              inline SVG icons
js/core/format.js             text/date formatting
js/core/image-utils.js        image validation / resizing
js/core/photos.js             photo upload preparation, signed links
js/core/lightbox.js           full-screen photo viewer
js/core/supabase.js           Supabase connection helpers
js/puzzle/puzzle-game.js      reusable puzzle engine
js/sudoku/                    Sudoku generator + board (timer, undo)
js/pages/*.js                 one small script per page
puzzle-photos/                photos for the Puzzle page
supabase/migrations/          database + storage + security rules
.github/workflows/deploy.yml  automatic deploy to GitHub Pages
```
## Adding a new page

1. Copy an existing page, e.g. `sudoku.html` → `my-game.html`, and set `<body data-page="my-game">`.
2. Create `js/pages/my-game.js` (start it with `import '../core/site.js';`) and point the page's `<script>` at it.
3. Add `{ id: 'my-game', label: 'My Game', href: 'my-game.html' }` to `PAGES` in `js/core/site.js`.

## Running it locally (optional)

Any static web server works, e.g. `npx serve .` or `python -m http.server`, then open http://localhost:3000 (or :8000).
Opening the HTML files directly (`file://`) won't work because the pages use JavaScript modules.
