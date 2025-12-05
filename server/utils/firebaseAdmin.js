import admin from 'firebase-admin';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

if (!admin.apps.length) {
  let credential;
  let projectIdFromSa;
  if (process.env.FIREBASE_ADMIN_CREDENTIAL_JSON) {
    try {
      const parsed = JSON.parse(process.env.FIREBASE_ADMIN_CREDENTIAL_JSON);
      credential = admin.credential.cert(parsed);
      projectIdFromSa = parsed?.project_id;
    } catch (err) {
      console.error('[firebaseAdmin] Failed to parse FIREBASE_ADMIN_CREDENTIAL_JSON:', err);
      throw err;
    }
  } else {
    const serviceAccount = require('../serviceAccount.json');
    credential = admin.credential.cert(serviceAccount);
    projectIdFromSa = serviceAccount?.project_id;
  }

  admin.initializeApp({
    credential,
    // Set projectId explicitly to avoid ambiguity and ease debugging
    projectId: projectIdFromSa
  });

  try {
    const opts = admin.apps[0]?.options || {};
    console.log('[firebaseAdmin] Initialized for projectId:', opts.projectId || projectIdFromSa);
  } catch {}
}

export { admin };
