import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAm1SfhGln_Zc7ZboqFT74RfwLGaBn0hYk",
  authDomain: "let-s-out.firebaseapp.com",
  projectId: "let-s-out",
  storageBucket: "let-s-out.firebasestorage.app",
  messagingSenderId: "259737951981",
  appId: "1:259737951981:web:969cfd43152d4c73deb6e4",
  measurementId: "G-3N2Q8C11WH"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
