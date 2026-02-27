import * as admin from 'firebase-admin';
import * as path from 'path';

const serviceAccount = require(path.resolve(__dirname, './firebase-service-account.json'));

export const firebaseApp = admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
