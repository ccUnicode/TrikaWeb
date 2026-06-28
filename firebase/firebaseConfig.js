import { getApp, getApps, initializeApp } from "firebase/app";
import { GoogleAuthProvider, getAuth, signInWithPopup, signOut } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyARazmRkvJA3Y8JAbr0KmqQkw7BkcAwkJk",
  authDomain: "unicode-2d937.firebaseapp.com",
  projectId: "unicode-2d937",
  storageBucket: "unicode-2d937.firebasestorage.app",
  messagingSenderId: "815175741640",
  appId: "1:815175741640:web:c9b3e503194408cede75fd"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
provider.setCustomParameters({
  hd: "uni.pe",
  prompt: "select_account",
});

export { auth, provider, signInWithPopup, signOut };