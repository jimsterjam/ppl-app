

import admin from 'firebase-admin';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

if (!admin.apps.length) {
  let credential, projectIdFromSa;
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
    // Fallback: serviceAccount.json laden
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const saPath = path.join(__dirname, '../serviceAccount.json');
    if (!fs.existsSync(saPath)) {
      throw new Error('[firebaseAdmin] Missing Firebase Admin credentials. Set FIREBASE_ADMIN_CREDENTIAL_JSON in ENV or provide serviceAccount.json.');
    }
    const parsed = JSON.parse(fs.readFileSync(saPath, 'utf8'));
    credential = admin.credential.cert(parsed);
    projectIdFromSa = parsed?.project_id;
  }
  admin.initializeApp({
    credential,
    projectId: projectIdFromSa
  });
  try {
    const opts = admin.apps[0]?.options || {};
    console.log('[firebaseAdmin] Initialized for projectId:', opts.projectId || projectIdFromSa);
  } catch {}
}

export { admin };
