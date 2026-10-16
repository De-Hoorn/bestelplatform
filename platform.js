// platform.js — laat de app draaien buiten claude.ai.
//
// De app vraagt drie diensten op via window.claude.use(naam):
//   "user"      → wie is aangemeld (hier: niemand, dus null)
//   "downloads" → bestanden bewaren (hier: gewone browser-download)
//   "db"        → database met een Firestore-achtige API
//
// Voor "db" zijn er twee varianten:
//   - lokaal (standaard): localStorage op dit toestel
//   - Firebase: zodra DH_CONFIG.firebase is ingevuld in config.js
// De app-code (index.html) hoeft daarvoor niet te veranderen: de lokale
// variant volgt dezelfde API als de Firebase compat-SDK.
(function () {
  "use strict";
  if (window.claude && window.claude.use) return; // draait al in claude.ai

  var cfg = window.DH_CONFIG || {};

  // ---------- downloads ----------
  var downloads = {
    save: function (r) {
      return new Promise(function (ok, fail) {
        try {
          var ext = String(r.filename).split(".").pop();
          var type = ext === "xlsx"
            ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            : "text/csv;charset=utf-8";
          var url = URL.createObjectURL(new Blob([r.data], { type: type }));
          var a = document.createElement("a");
          a.href = url; a.download = r.filename;
          document.body.appendChild(a); a.click(); a.remove();
          setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
          ok({ status: "saved" });
        } catch (e) { fail({ code: "unavailable" }); }
      });
    }
  };

  // ---------- lokale database (localStorage) ----------
  function localDb() {
    var PREFIX = "dh-db:";
    var listeners = {};
    function read(path) {
      try { var r = localStorage.getItem(PREFIX + path); return r ? JSON.parse(r) : null; } catch (e) { return null; }
    }
    function write(path, val) { localStorage.setItem(PREFIX + path, JSON.stringify(val)); }
    function emit(path) { (listeners[path] || []).forEach(function (f) { f(); }); }
    function on(path, f) {
      (listeners[path] = listeners[path] || []).push(f);
      setTimeout(f, 0);
      return function () { listeners[path] = listeners[path].filter(function (g) { return g !== f; }); };
    }
    function snap(v) { return { exists: v != null, data: function () { return v; } }; }

    function query(name, field, dir, max) {
      return {
        orderBy: function (f, d) { return query(name, f, d || "asc", max); },
        limit: function (n) { return query(name, field, dir, n); },
        onSnapshot: function (cb) {
          return on("col:" + name, function () {
            var rows = (read("col:" + name) || []).slice();
            if (field) rows.sort(function (a, b) {
              var x = a[field], y = b[field];
              return (x < y ? -1 : x > y ? 1 : 0) * (dir === "desc" ? -1 : 1);
            });
            if (max) rows = rows.slice(0, max);
            cb({ docs: rows.map(function (r) { return { id: r.__id, data: function () { return r; } }; }) });
          });
        }
      };
    }
    return {
      doc: function (path) {
        return {
          onSnapshot: function (cb) { return on("doc:" + path, function () { cb(snap(read("doc:" + path))); }); },
          set: function (v) { write("doc:" + path, v); emit("doc:" + path); return Promise.resolve(); }
        };
      },
      collection: function (name) {
        var q = query(name);
        q.add = function (doc) {
          return new Promise(function (ok, fail) {
            try {
              var rows = read("col:" + name) || [];
              var id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
              rows.push(Object.assign({ __id: id }, doc));
              while (rows.length > 60) rows.shift(); // beperk opslag op het toestel
              write("col:" + name, rows);
              emit("col:" + name);
              ok({ id: id });
            } catch (e) { fail({ code: e && e.name === "QuotaExceededError" ? "quota_exceeded" : "unavailable" }); }
          });
        };
        return q;
      }
    };
  }

  // ---------- Firebase (fase 2) ----------
  var FB = "https://www.gstatic.com/firebasejs/10.12.2/";
  function load(src) {
    return new Promise(function (ok, fail) {
      var s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = fail;
      document.head.appendChild(s);
    });
  }
  function firebaseDb() {
    return load(FB + "firebase-app-compat.js")
      .then(function () { return load(FB + "firebase-firestore-compat.js"); })
      .then(function () {
        if (!firebase.apps.length) firebase.initializeApp(cfg.firebase);
        return firebase.firestore();
      })
      .catch(function (e) {
        console.warn("Firebase niet beschikbaar, val terug op lokale opslag", e);
        return localDb();
      });
  }

  // ---------- gebruiker (pincode, zie pin.js) ----------
  var auth = window.DH_AUTH || { ready: Promise.resolve(null) };
  function userApi(u) {
    if (!u) return null;
    return {
      id: function () { return Promise.resolve(u.id); },
      can: function () { return Promise.resolve(true); },
      profiles: function (ids) { return auth.profiles ? auth.profiles(ids) : Promise.resolve({}); }
    };
  }

  var dbPromise = null;
  window.claude = {
    use: function (name) {
      // Niets laden of opslaan voordat iemand is aangemeld
      return auth.ready.then(function (u) {
        if (name === "user") return userApi(u);
        if (name === "downloads") return downloads;
        if (name === "db") return dbPromise || (dbPromise = cfg.firebase ? firebaseDb() : Promise.resolve(localDb()));
        return null;
      });
    }
  };
})();
