/* global firebase */
importScripts("/__/firebase/11.10.0/firebase-app-compat.js");
importScripts("/__/firebase/11.10.0/firebase-messaging-compat.js");
importScripts("/__/firebase/init.js");

// This worker exists only for Firebase Cloud Messaging. It intentionally does
// not handle fetch events or cache Central content.
firebase.messaging();
