/* ====== CONFIG ======
   Paste your deployed Google Apps Script Web App URL here.
   See README.md for how to get this. */
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzKOPX3RM59UO2M-5m-ug_x-MZ3IHpqN68LcH8Q8ILuWL7efvHQ-SPWj1ByNUO2Cf0-/exec";

/* ====== INTRO SEQUENCE ======
   Full-screen white/black cube: each of the first 3 faces holds one
   statement, revealed by rotating the cube 90deg. The 4th face starts
   blank (cursor only), then fades in the closing line. A simulated
   backspace + crossfade morphs "Kore" into the KORE wordmark before the
   site reveals. */
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
  const FINAL_LINE_HOLD_MS = 2000;
  const CURSOR_MOVE_PAUSE_MS = 400;
  const BACKSPACE_PAUSE_MS = 500;
  const BLINK_ONCE_MS = 700;
  const MORPH_MS = 750;
  const POST_MORPH_HOLD_MS = 700;

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
    face3.innerHTML = '<span class="cursor"></span>';
    await rotateTo(3);
    await sleep(ANTICIPATION_MS);
    if (stopped) return;

    // Fade in the closing line within the same face.
    face3.innerHTML = '<span class="stmt" id="finalStmt" style="opacity:0">You just found<br>the real <span id="wordKore">Kore</span><span id="tailA">a</span><span class="cursor" id="finalCursor"></span></span>';
    const finalStmt = document.getElementById("finalStmt");
    finalStmt.style.transition = "opacity 0.7s ease";
    void finalStmt.offsetWidth;
    finalStmt.style.opacity = "1";
    await sleep(700 + FINAL_LINE_HOLD_MS);
    if (stopped) return;

    // Move cursor left, in front of the trailing "a".
    const finalCursor = document.getElementById("finalCursor");
    const tailA = document.getElementById("tailA");
    tailA.parentNode.insertBefore(finalCursor, tailA);
    await sleep(CURSOR_MOVE_PAUSE_MS);
    if (stopped) return;

    // Backspace: delete the "a".
    tailA.remove();
    await sleep(BACKSPACE_PAUSE_MS);
    if (stopped) return;

    // One more blink before the morph.
    await sleep(BLINK_ONCE_MS);
    if (stopped) return;

    // Crossfade "Kore" into the KORE wordmark, fade out "the real ".
    const finalStmtEl = document.getElementById("finalStmt");
    finalStmtEl.innerHTML = 'You just found<br>the real <span class="brand-wrap"><span class="brand-old">Kore</span><span class="brand-new">KORE ///</span></span>';
    finalStmtEl.appendChild(finalCursor); // keep the same cursor node so it can fade out instead of vanishing
    const brandOld = finalStmtEl.querySelector(".brand-old");
    const brandNew = finalStmtEl.querySelector(".brand-new");
    finalCursor.style.transition = "opacity 0.4s ease";
    void finalStmtEl.offsetWidth;
    brandOld.style.opacity = "0";
    brandNew.style.opacity = "1";
    finalCursor.style.opacity = "0";
    await sleep(MORPH_MS);
    if (stopped) return;

    await sleep(POST_MORPH_HOLD_MS);
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
