import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

let firebaseApp: admin.app.App;

try {
  const serviceAccountPath = path.resolve(__dirname, 'firebase-service-account.json');
  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = require(serviceAccountPath);
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log('Firebase Admin SDK Initialized successfully.');
  } else {
    console.warn('Firebase Service Account JSON not found. Push notifications will fail.');
  }
} catch (error) {
  console.error('Firebase Admin initialization error', error);
}

export { firebaseApp };
