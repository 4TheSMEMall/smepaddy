importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyCydUHblR96HfLXAnbMpHIewQW2EOXtuc4",
  authDomain: "smepa-3d9e3.firebaseapp.com",
  projectId: "smepa-3d9e3",
  storageBucket: "smepa-3d9e3.firebasestorage.app",
  messagingSenderId: "462875852905",
  appId: "1:462875852905:web:7e688d24addd52e302e2f8",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title ?? "SME Paddy";
  const body = payload.notification?.body ?? "";

  self.registration.showNotification(title, {
    body,
    icon: "/icon-192.png",
    badge: "/badge-72.png",
    data: payload.data ?? {},
  });
});
