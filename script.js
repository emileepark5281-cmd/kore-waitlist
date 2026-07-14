/* ====== CONFIG ======
   Paste your deployed Google Apps Script Web App URL here.
   See README.md for how to get this. */
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzKOPX3RM59UO2M-5m-ug_x-MZ3IHpqN68LcH8Q8ILuWL7efvHQ-SPWj1ByNUO2Cf0-/exec";

/* ====== INTRO SEQUENCE ======
   Full-screen white/black cube: each of the first 3 faces holds one
   statement, revealed by rotating the cube 90deg. The 4th face starts
   blank (cursor only), then fast-typewrites "You just found", clears,
   and types "the real Korea" (Korea in blue from the first keystroke).
   A simulated backspace erases the trailing "a" before the site reveals. */
(function runIntro() {
  const introEl = document.getElementById("intro");
  const cubeEl = document.getElementById("cube");
  const face3 = document.getElementById("face3");
  const skipBtn = document.getElementById("intro-skip");
  const siteEl = document.getElementById("site");

  const alreadySeen = sessionStorage.getItem("kore_intro_seen");

  const ROTATE_HOLD_MS = 1600;   // statement stays put before rotating
  const ROTATE_MS = 900;         // cube rotation transition itself
  const ANTICIPATION_MS = 1000;  // blank face, cursor-only
  const TYPE_CHAR_MS = 32;       // per-character typing speed, fast-paced
  const LINE_ONE_HOLD_MS = 550;
  const LINE_SWAP_FADE_MS = 220;
  const LINE_TWO_HOLD_MS = 900;
  const CURSOR_MOVE_PAUSE_MS = 350;
  const BACKSPACE_PAUSE_MS = 450;
  const POST_BACKSPACE_HOLD_MS = 650;

  let stopped = false;
  const sleep = (ms) => new Promise((resolve) => {
    const id = setTimeout(resolve, ms);
    if (stopped) { clearTimeout(id); resolve(); }
  });

  async function typeInto(el, text) {
    for (let i = 0; i < text.length && !stopped; i++) {
      el.textContent += text[i];
      await sleep(TYPE_CHAR_MS);
    }
  }

  function reveal() {
    introEl.classList.add("hide");
    siteEl.classList.add("reveal");
    sessionStorage.setItem("kore_intro_seen", "1");
    document.body.style.overflow = "";
  }

  async function rotateTo(step) {
    if (stopped) return;
    cubeEl.style.transform = `rotateX(${-90 * step}deg)`;
    await sleep(ROTATE_MS);
  }

  async function play() {
    // Faces 0-2 already hold their statements (static HTML). Hold on
    // face 0, then rotate through 1 and 2.
    await sleep(ROTATE_HOLD_MS);
    if (stopped) return;
    await rotateTo(1);
    await sleep(ROTATE_HOLD_MS);
    if (stopped) return;
    await rotateTo(2);
    await sleep(ROTATE_HOLD_MS);
    if (stopped) return;

    // face3 starts blank: just the cursor, blinking alone.
    face3.innerHTML = '<span class="stmt" id="finalStmt"><span id="typeTarget"></span><span class="cursor" id="finalCursor"></span></span>';
    await rotateTo(3);
    await sleep(ANTICIPATION_MS);
    if (stopped) return;

    const finalStmt = document.getElementById("finalStmt");
    const typeTarget = document.getElementById("typeTarget");
    finalStmt.style.transition = `opacity ${LINE_SWAP_FADE_MS}ms ease`;

    // Line 1: fast-typed, then cleared (never shown together with line 2).
    await typeInto(typeTarget, "You just found");
    if (stopped) return;
    await sleep(LINE_ONE_HOLD_MS);
    if (stopped) return;
    finalStmt.style.opacity = "0";
    await sleep(LINE_SWAP_FADE_MS);
    if (stopped) return;
    typeTarget.textContent = "";
    finalStmt.style.opacity = "1";

    // Line 2: "the real " in black, "Korea" typed straight into blue.
    typeTarget.innerHTML = '<span id="preBlack"></span><span id="preBlue" style="color:var(--blue)"></span>';
    const preBlack = document.getElementById("preBlack");
    const preBlue = document.getElementById("preBlue");
    await typeInto(preBlack, "the real ");
    if (stopped) return;
    await typeInto(preBlue, "Korea");
    if (stopped) return;
    await sleep(LINE_TWO_HOLD_MS);
    if (stopped) return;

    // Restructure "Korea" so the trailing "a" can be targeted and erased.
    preBlue.innerHTML = 'Kore<span id="tailA">a</span>';
    const finalCursor = document.getElementById("finalCursor");
    const tailA = document.getElementById("tailA");

    // Move cursor left, in front of the trailing "a".
    tailA.parentNode.insertBefore(finalCursor, tailA);
    await sleep(CURSOR_MOVE_PAUSE_MS);
    if (stopped) return;

    // Backspace: delete the "a". "Korea" is now "Kore", still blue.
    tailA.remove();
    await sleep(BACKSPACE_PAUSE_MS);
    if (stopped) return;

    await sleep(POST_BACKSPACE_HOLD_MS);
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
