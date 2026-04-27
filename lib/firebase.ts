import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCs4sk1cUAoMqYWBOV_37k6vnXDCjFBg3s",
  authDomain: "link-clone-c2dc5.firebaseapp.com",
  projectId: "link-clone-c2dc5",
  storageBucket: "link-clone-c2dc5.firebasestorage.app",
  messagingSenderId: "933397902186",
  appId: "1:933397902186:web:9dcb01746837adb13b6b13",
  measurementId: "G-ZSXXC8YXVS"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const db = getFirestore(app);
