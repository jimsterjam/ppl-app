import { admin } from '../utils/firebaseAdmin.js';

const uid = process.argv[2];
if (!uid) {
  console.error('Usage: node test-delete-user.mjs <UID>');
  process.exit(1);
}

(async () => {
  try {
    console.log('Attempting admin.auth().deleteUser for', uid);
    await admin.auth().deleteUser(uid);
    console.log('deleteUser succeeded');
    process.exit(0);
  } catch (e) {
    console.error('deleteUser error:', e.code || '<no-code>', e.message || e);
    console.error(e.stack || '<no-stack>');
    process.exit(2);
  }
})();
