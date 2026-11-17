// This module is loaded after the guest UI renders. Keep account SDKs off the
// critical rendering path; every account action awaits the same cached module.
export { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
export {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
export { OperationType, auth, db, googleProvider, handleFirestoreError } from './firebase';
export { migrateGuestWork } from './utils/guestMigration';
