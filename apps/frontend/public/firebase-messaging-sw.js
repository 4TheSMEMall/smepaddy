// SME Paddy Push Notification Service Worker
// Uses native Web Push API (no Firebase dependency)

self.addEventListener("push", function (event) {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "SME Paddy", body: event.data.text() };
  }

  const title = payload.title ?? "SME Paddy";
  const options = {
    body: payload.body ?? "",
    icon: "/icon-192.png",
    badge: "/badge-72.png",
    data: payload.data ?? {},
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  event.waitUntil(clients.openWindow("/"));
});
