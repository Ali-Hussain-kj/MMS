// These values identify the Firebase project used by the JavaScript SDK.
const firebaseConfig = {
  apiKey: 'AIzaSyAlPCDa9G3YtBAeAXXi_O80YUwlk1capDA',
  authDomain: 'madaris-mangement-system.firebaseapp.com',
  projectId: 'madaris-mangement-system',
  storageBucket: 'madaris-mangement-system.firebasestorage.app',
  messagingSenderId: '346010208441',
  appId: '1:346010208441:android:ae69f7073cd6f244953368',
};

export function validateFirebaseConfig() {
  // Fail early with a useful message if a project value is still a placeholder.
  const missingValues = Object.entries(firebaseConfig)
    .filter(([, value]) => !value || value.startsWith('YOUR_'))
    .map(([key]) => key);

  if (missingValues.length > 0) {
    throw new Error(
      `Firebase is not configured. Add these values from your Firebase project: ${missingValues.join(', ')}.`,
    );
  }
}

export default firebaseConfig;
