/* ====== CONFIG ======
   Paste your deployed Google Apps Script Web App URL here.
   See README.md for how to get this. */
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzKOPX3RM59UO2M-5m-ug_x-MZ3IHpqN68LcH8Q8ILuWL7efvHQ-SPWj1ByNUO2Cf0-/exec";

/* ====== INTRO SEQUENCE ======
   White screen, huge black text, nothing else. Each line holds 2s then
   fades. Last line gets an extra pause. Then a beat of blank white,
   a blinking cursor, "Okay.", then the reveal line. */
const INTRO_LINES = [
  "Stop asking Reddit.",
  "Google can't answer this one.",
  "Facebook Groups are just ads.",
  "Instagram is all vibes.",
  "TikTok sold the dream.",
  "Forgot the instructions."
];

(function runIntro() {
  const introEl = document.getElementById("intro");
  const lineEl = document.getElementById("intro-line");
  const cursorEl = document.getElementById("intro-cursor");
  const skipBtn = document.getElementById("intro-skip");
  const siteEl = document.getElementById("site");

  const alreadySeen = sessionStorage.getItem("kore_intro_seen");

  const DISPLAY_MS = 2000;
  const FADE_MS = 450;
  const LAST_LINE_PAUSE_MS = 900;
  const BLANK_MS = 2000;
  const CURSOR_BLINK_MS = 1400;
  const OKAY_HOLD_MS = 900;
  const FINAL_HOLD_MS = 1300;

  let stopped = false;
  const sleep = (ms) => new Promise((resolve) => {
    const id = setTimeout(resolve, ms);
    if (stopped) { clearTimeout(id); resolve(); }
  });

  function reveal() {
    introEl.classList.add("hide");
    siteEl.classList.add("reveal");
    sessionStorage.setItem("kore_intro_seen", "1");
    document.body.style.overflow = "";
  }

  async function showLine(html, holdMs) {
    if (stopped) return;
    lineEl.innerHTML = html;
    lineEl.classList.remove("show");
    void lineEl.offsetWidth; // restart transition
    lineEl.classList.add("show");
    await sleep(holdMs);
    lineEl.classList.remove("show");
    await sleep(FADE_MS);
  }

  async function play() {
    for (let i = 0; i < INTRO_LINES.length; i++) {
      const isLast = i === INTRO_LINES.length - 1;
      await showLine(INTRO_LINES[i], isLast ? DISPLAY_MS + LAST_LINE_PAUSE_MS : DISPLAY_MS);
      if (stopped) return;
    }

    // blank beat
    await sleep(BLANK_MS);
    if (stopped) return;

    // blinking cursor
    cursorEl.classList.add("show");
    await sleep(CURSOR_BLINK_MS);
    cursorEl.classList.remove("show");
    if (stopped) return;

    await showLine("Okay.", OKAY_HOLD_MS);
    if (stopped) return;

    await showLine('Here\'s <span class="accent">KORE</span>..', FINAL_HOLD_MS);
    reveal();
  }

  function skip() {
    if (stopped) return;
    stopped = true;
    reveal();
  }

  if (alreadySeen) {
    reveal();
    return;
  }

  document.body.style.overflow = "hidden";
  skipBtn.addEventListener("click", (e) => { e.stopPropagation(); skip(); });
  introEl.addEventListener("click", skip);

  play();
})();

/* ====== SCROLL REVEAL ====== */
(function scrollReveal() {
  const targets = document.querySelectorAll(".what-item, .photo");
  if (!("IntersectionObserver" in window)) {
    targets.forEach(t => t.classList.add("visible"));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });
  targets.forEach(t => io.observe(t));
})();

/* ====== REFERRAL CODE FROM URL ====== */
function getReferralFromURL() {
  const params = new URLSearchParams(window.location.search);
  return params.get("ref") || "";
}

/* ====== SIGNUP HANDLING ====== */
async function submitSignup(email) {
  const referredBy = getReferralFromURL();
  const res = await fetch(APPS_SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ email, referredBy })
  });
  if (!res.ok) throw new Error("Signup request failed");
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || "Signup failed");
  return data; // { ok, code, position, referralCount }
}

let freshSignupShown = false;

function wireCopyButton() {
  const copyBtn = document.getElementById("copy-btn");
  const referralLinkEl = document.getElementById("referral-link");
  if (!copyBtn || copyBtn.dataset.wired) return;
  copyBtn.dataset.wired = "1";

  copyBtn.addEventListener("click", async () => {
    const text = referralLinkEl.value;
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      referralLinkEl.select();
      document.execCommand("copy");
    }
    const original = copyBtn.textContent;
    copyBtn.textContent = "Copied!";
    setTimeout(() => { copyBtn.textContent = original; }, 1800);
  });
}

function showConfirmation(data) {
  const confirmation = document.getElementById("confirmation");
  const positionEl = document.getElementById("position-number");
  const referralLinkEl = document.getElementById("referral-link");
  const referralCountEl = document.getElementById("referral-count-number");
  const formNote = document.getElementById("form-note");
  const form = document.getElementById("signup-form");

  positionEl.textContent = "#" + data.position;
  const link = window.location.origin + window.location.pathname + "?ref=" + data.code;
  referralLinkEl.value = link;
  referralCountEl.textContent = data.referralCount || 0;

  form.hidden = true;
  formNote.hidden = true;
  confirmation.hidden = false;
  wireCopyButton();

  localStorage.setItem("kore_referral_code", data.code);
  localStorage.setItem("kore_email", data.email || "");
}

function wireForm(formId, inputId, buttonId) {
  const form = document.getElementById(formId);
  const input = document.getElementById(inputId);
  const button = document.getElementById(buttonId);
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = input.value.trim();
    if (!email) return;

    if (APPS_SCRIPT_URL.includes("PASTE_YOUR")) {
      alert("Backend not connected yet — see README.md to set up Google Sheets.");
      return;
    }

    button.disabled = true;
    button.textContent = "Joining...";
    try {
      const data = await submitSignup(email);
      freshSignupShown = true;
      showConfirmation(data);
    } catch (err) {
      button.textContent = "Try again";
      button.disabled = false;
      alert("Something went wrong. Please try again in a moment.");
      console.error(err);
      return;
    }
  });
}

wireForm("signup-form", "email-input", "signup-btn");
wireForm("signup-form-2", "email-input-2", "signup-btn-2");

/* ====== RETURNING VISITOR: show saved confirmation state ====== */
(function restoreState() {
  const savedCode = localStorage.getItem("kore_referral_code");
  if (!savedCode || APPS_SCRIPT_URL.includes("PASTE_YOUR")) return;
  fetch(APPS_SCRIPT_URL + "?code=" + encodeURIComponent(savedCode))
    .then(res => res.json())
    .then(data => {
      if (data.ok && !freshSignupShown) showConfirmation(data);
    })
    .catch(() => {});
})();
