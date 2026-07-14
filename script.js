/* ====== CONFIG ======
   Paste your deployed Google Apps Script Web App URL here.
   See README.md for how to get this. */
const APPS_SCRIPT_URL = "PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE";

/* ====== INTRO SEQUENCE ====== */
const INTRO_LINES = [
  "Stop asking Reddit.",
  "Google can't answer this one.",
  "Facebook groups are just ads.",
  "Your Korean friend doesn't know.",
  "Instagram is all vibes.",
  "TikTok sold the dream.",
  "Forgot the instructions.",
  "You just found it.",
  '<span class="accent">Kore ///</span>'
];

(function runIntro() {
  const introEl = document.getElementById("intro");
  const lineEl = document.getElementById("intro-line");
  const skipBtn = document.getElementById("intro-skip");
  const siteEl = document.getElementById("site");

  const alreadySeen = sessionStorage.getItem("kore_intro_seen");
  const LINE_MS = 900;
  const PAUSE_MS = 1300;

  function reveal() {
    introEl.classList.add("hide");
    siteEl.classList.add("reveal");
    sessionStorage.setItem("kore_intro_seen", "1");
    document.body.style.overflow = "";
  }

  if (alreadySeen) {
    reveal();
    return;
  }

  document.body.style.overflow = "hidden";
  let i = 0;
  let stopped = false;

  function showNext() {
    if (stopped) return;
    if (i >= INTRO_LINES.length) {
      setTimeout(reveal, PAUSE_MS);
      return;
    }
    lineEl.innerHTML = INTRO_LINES[i];
    lineEl.classList.remove("show");
    void lineEl.offsetWidth; // restart animation
    lineEl.classList.add("show");
    i++;
    setTimeout(showNext, LINE_MS);
  }

  function skip() {
    stopped = true;
    reveal();
  }

  skipBtn.addEventListener("click", (e) => { e.stopPropagation(); skip(); });
  introEl.addEventListener("click", skip);

  showNext();
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
      if (data.ok) showConfirmation(data);
    })
    .catch(() => {});
})();
