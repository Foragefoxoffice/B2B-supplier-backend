const admin = require('firebase-admin');

// We use a try-catch so the app doesn't crash if the user hasn't provided credentials yet.
let isInitialized = false;

try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    const serviceAccount = JSON.parse(
      Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('ascii')
    );
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log('Firebase Admin initialized successfully.');
    isInitialized = true;
  } else {
    console.warn('Firebase Admin NOT initialized. Please set FIREBASE_SERVICE_ACCOUNT_BASE64 in .env for push notifications.');
  }
} catch (error) {
  console.error('Error initializing Firebase Admin:', error.message);
}

module.exports = { admin, isInitialized };
