/**
 * Whale Delivery Log - Firebase init (Anonymous Auth + Firestore)
 * Exposes a single promise on window: __whaleFirebaseReady
 */
const firebaseConfig = {
  apiKey: "AIzaSyB7bjqEsdC1ogmUiXCPiY4LPX5HmpQuLlY",
  authDomain: "whale-delivery-41077.firebaseapp.com",
  projectId: "whale-delivery-41077",
  storageBucket: "whale-delivery-41077.firebasestorage.app",
  messagingSenderId: "355030544556",
  appId: "1:355030544556:web:74f53b84c99396a6e0af09",
  measurementId: "G-BY7VJMPQZY"
};

window.__whaleFirebaseReady = (async () => {
  const { initializeApp } = await import("https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js");
  const { getAuth, signInAnonymously } = await import("https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js");
  const { getFirestore, doc, getDoc, setDoc, serverTimestamp } = await import("https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js");

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  await signInAnonymously(auth);

  const db = getFirestore(app);
  return { app, auth, db, doc, getDoc, setDoc, serverTimestamp };
})().catch((e) => {
  console.warn("[Firebase] init failed", e);
  throw e;
});
