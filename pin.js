// pin.js — aanmelden met een persoonlijke pincode.
//
// Gebruikers en hun pincode-hash staan in config.js (DH_CONFIG.gebruikers).
// Een hash maak je met pincode-maken.html. De pincode zelf staat nergens.
//
// Let op: zolang er geen server/Firebase is, gebeurt de controle in de browser.
// Dit houdt toevallige gebruikers buiten en zet een naam bij elke telling,
// maar is geen echte beveiliging (zie README).
(function () {
  "use strict";
  var cfg = window.DH_CONFIG || {};
  var gebruikers = cfg.gebruikers || [];
  var ZOUT = cfg.pinZout || "dehoorn-bestellingen";
  var PIN_LEN = cfg.pinLengte || 4;
  var IDLE_MIN = cfg.vergrendelNaMinuten || 30;
  var SKEY = "dh-sessie-v1", FKEY = "dh-pinfouten-v1";

  function hash(id, pin) {
    var data = new TextEncoder().encode(ZOUT + ":" + id + ":" + pin);
    return crypto.subtle.digest("SHA-256", data).then(function (buf) {
      return Array.from(new Uint8Array(buf)).map(function (b) { return b.toString(16).padStart(2, "0"); }).join("");
    });
  }
  window.DH_PIN_HASH = hash; // gebruikt door pincode-maken.html

  function lees(k) { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; } }
  function schrijf(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function vind(id) { return gebruikers.filter(function (g) { return g.id === id; })[0] || null; }

  var klaar, losLaten;
  var huidig = null;
  klaar = new Promise(function (r) { losLaten = r; });

  // Geen gebruikers ingesteld → pincode uit (zelfde gedrag als vroeger)
  if (!gebruikers.length) { window.DH_AUTH = { ready: Promise.resolve(null), logout: function () {} }; return; }

  // ---------- stijl ----------
  var css = document.createElement("style");
  css.textContent = [
    "#pin{position:fixed;inset:0;z-index:100;background:var(--bg,#f3f5f2);color:var(--fg,#1d2420);display:flex;align-items:center;justify-content:center;padding:16px;font-family:var(--body,system-ui,sans-serif)}",
    "#pin .kaart{width:100%;max-width:380px;text-align:center}",
    "#pin h2{font-family:var(--display,sans-serif);font-size:30px;margin:0 0 4px;letter-spacing:.01em}",
    "#pin .hint{color:var(--muted,#5d6a62);margin:0 0 18px;min-height:1.4em}",
    "#pin .hint.fout{color:var(--bad,#b3261e);font-weight:600}",
    "#pin .namen{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-bottom:22px}",
    "#pin .naam{font:inherit;font-weight:600;font-size:17px;padding:12px 18px;border-radius:999px;border:1px solid var(--line,#d3dad3);background:var(--surface,#fff);color:inherit;cursor:pointer;min-height:48px}",
    "#pin .naam[aria-pressed=true]{background:var(--accent,#1f5c45);color:var(--accent-fg,#fff);border-color:var(--accent,#1f5c45)}",
    "#pin .bolletjes{display:flex;gap:14px;justify-content:center;margin:6px 0 20px}",
    "#pin .bol{width:16px;height:16px;border-radius:50%;border:2px solid var(--accent,#1f5c45)}",
    "#pin .bol.vol{background:var(--accent,#1f5c45)}",
    "#pin .klavier{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}",
    "#pin .klavier button{font:inherit;font-size:26px;font-weight:600;height:64px;border-radius:14px;border:1px solid var(--line,#d3dad3);background:var(--surface,#fff);color:inherit;cursor:pointer;touch-action:manipulation}",
    "#pin .klavier button:active{background:var(--surface-2,#e8ece6)}",
    "#pin .klavier button:disabled{opacity:.4}",
    "#pin .klavier .klein{font-size:16px}",
    "#pin.schud .bolletjes{animation:dhschud .35s}",
    "@keyframes dhschud{20%,60%{transform:translateX(-8px)}40%,80%{transform:translateX(8px)}}",
    ".dh-wie{font:inherit;font-size:14px;font-weight:600;padding:6px 12px;border-radius:999px;border:1px solid var(--line,#d3dad3);background:var(--surface-2,#e8ece6);color:var(--fg,#1d2420);cursor:pointer}"
  ].join("\n");
  document.head.appendChild(css);

  // ---------- scherm ----------
  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    for (var k in attrs || {}) {
      if (k === "text") n.textContent = attrs[k];
      else if (k.slice(0, 2) === "on") n.addEventListener(k.slice(2), attrs[k]);
      else n.setAttribute(k, attrs[k]);
    }
    (kids || []).forEach(function (c) { n.appendChild(c); });
    return n;
  }

  var scherm, hint, bollen, klavierKnoppen = [], gekozen = null, invoer = "";

  function toonScherm() {
    if (scherm) { scherm.hidden = false; return; }
    hint = el("p", { "class": "hint", text: "Kies je naam en geef je pincode in" });
    var namen = el("div", { "class": "namen", role: "group", "aria-label": "Wie ben je?" });
    gebruikers.forEach(function (g) {
      namen.appendChild(el("button", { "class": "naam", type: "button", "aria-pressed": "false", "data-id": g.id, text: g.naam,
        onclick: function () { kies(g.id); } }));
    });
    bollen = el("div", { "class": "bolletjes", "aria-hidden": "true" });
    for (var i = 0; i < PIN_LEN; i++) bollen.appendChild(el("span", { "class": "bol" }));
    var klavier = el("div", { "class": "klavier" });
    ["1", "2", "3", "4", "5", "6", "7", "8", "9", "wis", "0", "⌫"].forEach(function (t) {
      var b = el("button", { type: "button", text: t, "aria-label": t === "⌫" ? "Laatste cijfer wissen" : t === "wis" ? "Alles wissen" : t,
        onclick: function () { druk(t); } });
      if (t.length > 1 && t !== "⌫") b.className = "klein";
      klavierKnoppen.push(b); klavier.appendChild(b);
    });
    scherm = el("div", { id: "pin", role: "dialog", "aria-modal": "true", "aria-label": "Aanmelden" }, [
      el("div", { "class": "kaart" }, [el("h2", { text: "Aanmelden" }), hint, namen, bollen, klavier])
    ]);
    document.body.appendChild(scherm);
    document.addEventListener("keydown", function (e) {
      if (scherm.hidden) return;
      if (/^[0-9]$/.test(e.key)) druk(e.key);
      else if (e.key === "Backspace") druk("⌫");
    });
    if (gebruikers.length === 1) kies(gebruikers[0].id);
    var laatste = lees("dh-laatste-gebruiker");
    if (laatste && vind(laatste)) kies(laatste);
    teken();
  }

  function kies(id) {
    gekozen = id; invoer = "";
    scherm.querySelectorAll(".naam").forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-id") === id)); });
    zetHint("Pincode voor " + vind(id).naam, false);
    teken();
  }
  function zetHint(t, fout) { hint.textContent = t; hint.className = "hint" + (fout ? " fout" : ""); }
  function teken() {
    Array.from(bollen.children).forEach(function (b, i) { b.className = "bol" + (i < invoer.length ? " vol" : ""); });
  }

  function geblokkeerdTot() { var f = lees(FKEY); return f && f.tot > Date.now() ? f.tot : 0; }
  function blokkeerAftellen() {
    var tot = geblokkeerdTot();
    klavierKnoppen.forEach(function (b) { b.disabled = !!tot; });
    if (!tot) { if (gekozen) zetHint("Pincode voor " + vind(gekozen).naam, false); return; }
    zetHint("Te veel foute pogingen. Wacht " + Math.ceil((tot - Date.now()) / 1000) + " s", true);
    setTimeout(blokkeerAftellen, 1000);
  }

  function druk(t) {
    if (geblokkeerdTot()) return;
    if (!gekozen) { zetHint("Kies eerst je naam", true); return; }
    if (t === "⌫") invoer = invoer.slice(0, -1);
    else if (t === "wis") invoer = "";
    else if (invoer.length < PIN_LEN) invoer += t;
    teken();
    if (invoer.length === PIN_LEN) controleer();
  }

  function controleer() {
    var id = gekozen, pin = invoer, g = vind(id);
    hash(id, pin).then(function (h) {
      if (g && h === g.pinHash) {
        schrijf(FKEY, null);
        schrijf("dh-laatste-gebruiker", id);
        aanmelden(id);
      } else {
        var f = lees(FKEY) || { n: 0 };
        f.n = (f.n || 0) + 1;
        if (f.n >= 5) { f.tot = Date.now() + 30000 * Math.pow(2, Math.min(f.n - 5, 5)); }
        schrijf(FKEY, f);
        invoer = ""; teken();
        scherm.classList.remove("schud"); void scherm.offsetWidth; scherm.classList.add("schud");
        if (f.tot && f.tot > Date.now()) blokkeerAftellen(); else zetHint("Foute pincode, probeer opnieuw", true);
      }
    });
  }

  // ---------- sessie ----------
  var idleTimer;
  function bewaarSessie() { if (huidig) schrijf(SKEY, { id: huidig.id, laatst: Date.now() }); }
  function opIdle() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(function () { afmelden(); }, IDLE_MIN * 60000);
    bewaarSessie();
  }

  function aanmelden(id) {
    huidig = vind(id);
    if (scherm) { scherm.hidden = true; invoer = ""; teken(); }
    bewaarSessie();
    opIdle();
    toonWie();
    losLaten(huidig);
  }

  function afmelden() {
    schrijf(SKEY, null);
    huidig = null;
    clearTimeout(idleTimer);
    toonWie();
    toonScherm();
    if (gekozen) kies(gekozen);
    // De app kent na het aanmelden de gebruiker; na afmelden herladen we zodat
    // een volgende telling op naam van de nieuwe persoon komt.
    window.DH_AUTH._naAfmelden = true;
  }

  function toonWie() {
    var top = document.querySelector("header .top");
    if (!top) return;
    var knop = document.getElementById("dh-wie");
    if (!knop) {
      knop = el("button", { id: "dh-wie", "class": "dh-wie", type: "button", title: "Afmelden",
        onclick: function () { if (confirm("Afmelden?")) afmelden(); } });
      top.appendChild(knop);
    }
    knop.hidden = !huidig;
    if (huidig) knop.textContent = huidig.naam + " · afmelden";
  }

  ["pointerdown", "keydown"].forEach(function (ev) {
    document.addEventListener(ev, function () { if (huidig) opIdle(); }, { passive: true });
  });

  // Na afmelden + opnieuw aanmelden: pagina herladen zodat de app de nieuwe naam gebruikt
  var oudLos = losLaten;
  losLaten = function (u) {
    if (window.DH_AUTH && window.DH_AUTH._naAfmelden) { location.reload(); return; }
    oudLos(u);
  };

  window.DH_AUTH = {
    ready: klaar,
    logout: afmelden,
    profiles: function (ids) {
      var r = {};
      (ids || []).forEach(function (id) { var g = vind(id); if (g) r[id] = { name: g.naam }; });
      return Promise.resolve(r);
    }
  };

  function start() {
    var s = lees(SKEY);
    if (s && vind(s.id) && Date.now() - (s.laatst || 0) < IDLE_MIN * 60000) aanmelden(s.id);
    else { schrijf(SKEY, null); toonScherm(); blokkeerAftellen(); }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
