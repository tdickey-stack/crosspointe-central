/* global firebase */
self.addEventListener("notificationclick", function(event) {
  event.stopImmediatePropagation();
  event.notification.close();

  var notificationData = event.notification.data || {};
  var link = notificationData.link || "/";
  var destination = new URL(link, self.location.origin).href;

  event.waitUntil(
      self.clients.matchAll({type: "window", includeUncontrolled: true})
          .then(function(windowClients) {
            var sameOriginClient = windowClients.find(function(client) {
              return new URL(client.url).origin ===
                new URL(destination).origin;
            });

            if (sameOriginClient) {
              return sameOriginClient.navigate(destination)
                  .then(function() {
                    return sameOriginClient.focus();
                  }).catch(function() {
                    return self.clients.openWindow(destination);
                  });
            }

            return self.clients.openWindow(destination);
          }),
  );
});

importScripts("/__/firebase/11.10.0/firebase-app-compat.js");
importScripts("/__/firebase/11.10.0/firebase-messaging-compat.js");
importScripts("/__/firebase/init.js");

// This worker exists only for Firebase Cloud Messaging. It intentionally does
// not handle fetch events or cache Central content.
var messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
  var data = payload && payload.data || {};
  return self.registration.showNotification(
      data.title || "CrossPointe Central",
      {
        body: data.message || "",
        icon: "/icons/central-192.png",
        badge: "/icons/central-192.png",
        data: {link: data.link || self.location.origin + "/"},
        requireInteraction: true,
      },
  );
});
