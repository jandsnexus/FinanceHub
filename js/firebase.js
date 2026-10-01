// Einziger Ort, an dem Firebase geladen wird. Alle anderen Module importieren von hier.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, sendPasswordResetEmail, sendEmailVerification
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  initializeFirestore, getFirestore, persistentLocalCache, persistentMultipleTabManager,
  doc, collection, getDoc, setDoc, deleteDoc, onSnapshot, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { firebaseConfig } from './config.js';

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Firestore mit eingebautem Offline-Cache (IndexedDB). Fällt auf Standard zurück,
// falls der Browser den Cache nicht unterstützt (z. B. privater Modus).
let firestore;
try {
  firestore = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
  });
} catch (err) {
  console.warn('Offline-Cache nicht verfügbar, nutze Standard.', err);
  firestore = getFirestore(app);
}
export const db = firestore;

export {
  onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
  sendPasswordResetEmail, sendEmailVerification,
  doc, collection, getDoc, setDoc, deleteDoc, onSnapshot, serverTimestamp
};
