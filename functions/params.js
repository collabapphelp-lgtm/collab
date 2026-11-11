const { defineString } = require('firebase-functions/params');

/** Collab team accounts: can open the dashboard and get report alerts. Asked for on first deploy. */
exports.ADMIN_UIDS = defineString('ADMIN_UIDS', {
  description: 'Your Collab user ID (Firebase console → Authentication → User UID). Separate several with commas.',
});
exports.adminUids = () =>
  exports.ADMIN_UIDS.value()
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
