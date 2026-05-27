import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAnalytics, isSupported } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyDR8XLQsZxxsaggBsN55ECI6Ebdl5qnpi4",
  authDomain: "mucizp-104d7.firebaseapp.com",
  projectId: "mucizp-104d7",
  storageBucket: "mucizp-104d7.firebasestorage.app",
  messagingSenderId: "198530263057",
  appId: "1:198530263057:web:35b55deff49e2bad6e69b0",
  measurementId: "G-GZBG4PW269"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

export let analytics = null;
isSupported().then((supported) => {
  if (supported) {
    analytics = getAnalytics(app);
  }
});
