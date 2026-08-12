/* global firebase */
self.addEventListener("notificationclick", function(event) {
  event.notification.close();

  var notificationData = event.notification.data || {};
  var fcmMessage = notificationData.FCM_MSG || {};
  var link = notificationData.link ||
    (fcmMessage.data && fcmMessage.data.link) ||
    (fcmMessage.fcmOptions && fcmMessage.fcmOptions.link) ||
    "/";
  var destination = new URL(link, self.location.origin).href;

  event.waitUntil(
      clients.matchAll({type: "window", includeUncontrolled: true})
          .then(function(windowClients) {
            var sameOriginClient = windowClients.find(function(client) {
              return new URL(client.url).origin ===
                new URL(destination).origin;
            });

            if (sameOriginClient) {
              return sameOriginClient.navigate(destination)
                  .then(function() {
                    return sameOriginClient.focus();
                  });
            }

            return clients.openWindow(destination);
          }),
  );
});

importScripts("/__/firebase/11.10.0/firebase-app-compat.js");
importScripts("/__/firebase/11.10.0/firebase-messaging-compat.js");
importScripts("/__/firebase/init.js");

// This worker exists only for Firebase Cloud Messaging. It intentionally does
// not handle fetch events or cache Central content.
firebase.messaging();
