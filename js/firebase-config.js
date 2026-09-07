/**
 * Configuração pública do aplicativo Web no Firebase.
 *
 * IMPORTANTE:
 * - Estes valores NÃO são senhas. O Firebase os entrega para apps Web e eles podem ficar no front-end.
 * - A segurança real deve ser controlada pelas regras do Realtime Database e pelo Authentication.
 * - Substitua os valores abaixo pelos dados fornecidos em Firebase Console > Project settings > Your apps.
 */
export const firebaseConfig = {
  apiKey: "__FIREBASE_API_KEY__",
  authDomain: "__FIREBASE_AUTH_DOMAIN__",
  databaseURL: "__FIREBASE_DATABASE_URL__",
  projectId: "__FIREBASE_PROJECT_ID__",
  storageBucket: "__FIREBASE_STORAGE_BUCKET__",
  messagingSenderId: "__FIREBASE_MESSAGING_SENDER_ID__",
  appId: "__FIREBASE_APP_ID__"
};

/** Retorna true quando os placeholders acima já foram substituídos. */
export function isFirebaseConfigured() {
  return Object.values(firebaseConfig).every((value) => value && !String(value).startsWith("__FIREBASE_"));
}
