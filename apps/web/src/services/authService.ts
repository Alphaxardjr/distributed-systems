
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";

import {
  doc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";

import { auth, db } from "../../firebase/config";

// Register a new user
export async function registerUser(
  displayName: string,
  email: string,
  password: string
): Promise<User> {
  const credential = await createUserWithEmailAndPassword(
    auth,
    email,
    password
  );

  const user = credential.user;

  await updateProfile(user, {
    displayName,
  });

  await setDoc(doc(db, "users", user.uid), {
    displayName,
    email: user.email,
    photoURL: null,
    createdAt: serverTimestamp(),
  });

  return user;
}

// Login
export async function loginUser(
  email: string,
  password: string
): Promise<User> {
  const credential = await signInWithEmailAndPassword(
    auth,
    email,
    password
  );

  return credential.user;
}

// Logout
export async function logoutUser(): Promise<void> {
  await signOut(auth);
}
