import { getApp } from '@react-native-firebase/app';
import { getAuth } from '@react-native-firebase/auth';
import { getFirestore } from '@react-native-firebase/firestore';

// O app padrao e configurado nativamente a partir do google-services.json
// (Android) / GoogleService-Info.plist (iOS) no momento do build — nao
// precisa (nem deve) passar um firebaseConfig em JS aqui.
const app = getApp();
const auth = getAuth(app);
const db = getFirestore(app);

export { app, db, auth };
