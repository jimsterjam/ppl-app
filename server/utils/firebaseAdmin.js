import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS && fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
    try {
      const raw = fs.readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8');
      const parsed = JSON.parse(raw);
      credential = admin.credential.cert(parsed);
      projectIdFromSa = parsed?.project_id;
    } catch (err) {
      console.error('[firebaseAdmin] Failed to read GOOGLE_APPLICATION_CREDENTIALS:', err);
      throw err;
    }
  } else {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const serviceAccountPath = path.join(__dirname, '..', 'serviceAccount.json');
    if (!fs.existsSync(serviceAccountPath)) {
      const hint = 'Set FIREBASE_ADMIN_CREDENTIAL_JSON (recommended) or provide server/serviceAccount.json.';
      throw new Error(`[firebaseAdmin] Missing Firebase Admin credentials. ${hint}`);
    }
    try {
      const raw = fs.readFileSync(serviceAccountPath, 'utf8');
      const parsed = JSON.parse(raw);
      credential = admin.credential.cert(parsed);
      projectIdFromSa = parsed?.project_id;
    } catch (err) {
      console.error('[firebaseAdmin] Failed to read serviceAccount.json:', err);
      throw err;
    }
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
