# Kore prelaunch waitlist — setup

Two things need to happen before this is live: (1) connect the Google Sheet backend, (2) publish the site. Do them in this order.

## 1. Connect Google Sheets

1. Go to [sheets.google.com](https://sheets.google.com) and create a new blank sheet. Name it whatever you want (e.g. "Kore Waitlist").
2. Rename the bottom tab (default "Sheet1") to **`Signups`** — exact spelling matters, the script looks for this name.
3. In the menu bar: **Extensions → Apps Script**. A new tab opens with a code editor.
4. Delete anything in the editor (`Code.gs`), then paste in the entire contents of `apps-script.gs` from this folder.
5. Click **Deploy → New deployment**.
6. Click the gear icon next to "Select type" → choose **Web app**.
7. Fill in:
   - Description: anything (e.g. "Kore waitlist API")
   - Execute as: **Me**
   - Who has access: **Anyone**
8. Click **Deploy**. Google will ask you to authorize — click **Authorize access**, pick your account, click **Advanced → Go to (project name)** if it shows an "unverified app" warning, then **Allow**. (This warning is normal — it's your own script, Google just flags anything not published on the app store.)
9. Copy the **Web app URL** it gives you (looks like `https://script.google.com/macros/s/AKfycb.../exec`).
10. Open `script.js` in this folder, and paste that URL as the value of `APPS_SCRIPT_URL` near the top of the file, replacing `"PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE"`.

Every signup will now land as a new row in the `Signups` tab: Timestamp, Email, Code (their referral code), ReferredBy (whoever referred them, if anyone).

**If you ever edit `apps-script.gs` again**, you need to redeploy: Deploy → Manage deployments → click the pencil/edit icon on the existing deployment → change Version to "New version" → Deploy. Editing the script alone does *not* update the live URL.

## 2. Publish to GitHub Pages

I can do this part for you — just say the word and confirm you want me to create a new repo on your GitHub account and push this folder. Once live, your page will be at:

`https://<your-github-username>.github.io/kore-waitlist/`

You can point a custom domain at it later (e.g. `korea.app` or whatever you land on) if you buy one — GitHub Pages supports that.

## Adding real photos

The photo strip on the page (`.gallery` section) currently uses placeholder gradients. To swap in real photos:

1. Drop your images into the `images/` folder (e.g. `hero-1.jpg`, `hero-2.jpg`, `hero-3.jpg`, `hero-4.jpg`).
2. In `style.css`, find the comment `/* To use real photos... */` near the bottom of the `.photo` rules, and add:
   ```css
   .ph-1 { background-image: url('images/hero-1.jpg'); background-size: cover; background-position: center; }
   .ph-2 { background-image: url('images/hero-2.jpg'); background-size: cover; background-position: center; }
   .ph-3 { background-image: url('images/hero-3.jpg'); background-size: cover; background-position: center; }
   .ph-4 { background-image: url('images/hero-4.jpg'); background-size: cover; background-position: center; }
   ```
Aim for photos that look like someone's actual camera roll — casual, real, a little imperfect — not stock photography.

## How referral ranking works

- Everyone gets a unique 6-character referral code the moment they sign up, and a shareable link: `yoursite.com/?ref=THEIRCODE`.
- New signups join at the back of the line — their position is stored permanently in the `Position` column (not recalculated from scratch each time).
- Each time someone signs up through your link, you swap places with whoever is directly one spot ahead of you. One referral = one bump up, not a jump to the top. If you're #12 and a friend joins through your link, you become #11; a second friend gets you to #10, and so on.
- "Batches" (releasing access to the top N people at a time) isn't built as an automated feature yet — when you're ready to launch, open the Sheet, sort by position, and invite people in chunks yourself. If you want this automated later (e.g. auto-emailing batches), that's a straightforward next step — just ask.

## Editing text / colors later

This site is plain HTML/CSS/JS, not a drag-and-drop builder — to change copy, colors, or layout, tell me what you want changed and I'll edit the code directly. Main files:
- `index.html` — all text content and page structure
- `style.css` — colors, fonts, spacing, layout (`--blue`, `--black`, `--off-white` near the top control the whole palette)
- `script.js` — the rotating intro lines (`INTRO_LINES` array near the top), form/referral logic
