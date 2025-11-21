import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyA3D_1IRdpPB_2rmF5rtGqvJ1EXFNF2zxc",
    authDomain: "alarix-61e90.firebaseapp.com",
    databaseURL: "https://alarix-61e90-default-rtdb.firebaseio.com",
    projectId: "alarix-61e90",
    storageBucket: "alarix-61e90.firebasestorage.app",
    messagingSenderId: "747193234958",
    appId: "1:747193234958:web:c69501009d5950b63d6e5f",
    measurementId: "G-DV5XBRC8L1"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
