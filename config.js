// Instellingen voor de bestel-app.
window.DH_CONFIG = {

  // ---------- Aanmelden met pincode ----------
  // Elke gebruiker: id (kleine letters, geen spaties), naam (zo verschijnt die
  // in de app en bij "Vorige tellingen") en pinHash.
  // Een pinHash maak je met pincode-maken.html (open die pagina op de site).
  // Laat de lijst leeg ([]) om de pincode uit te schakelen.
  gebruikers: [
    // Vaste login (tijdelijk) – pincode 5555.
    // Later uitbreiden naar persoonlijke login zoals in Loftbeheer.
    { id: "user", naam: "user", pinHash: "36128f0ab619e1bf1dfb03c62a3a02abad204b0d1783c8a5d7b5c65d5cb40030" }
  ],
  pinLengte: 4,               // aantal cijfers
  vergrendelNaMinuten: 30,    // automatisch afmelden na zoveel minuten niets doen
  pinZout: "dehoorn-bestellingen", // niet wijzigen, anders kloppen alle hashes niet meer

  // ---------- Database ----------
  // Fase 1 (nu): geen database. Tellingen worden op het toestel bewaard.
  // Fase 2: vul de Firebase-config in (Firebase console → Project settings →
  // Your apps → Web app). Vanaf dan worden tellingen gedeeld via Firestore.
  firebase: null
  // firebase: {
  //   apiKey: "…",
  //   authDomain: "….firebaseapp.com",
  //   projectId: "…",
  //   appId: "…"
  // }
};
