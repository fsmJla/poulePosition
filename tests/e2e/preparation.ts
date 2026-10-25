// Préparation globale des E2E.
// - Contre la preview (BASE_URL) : obtient le cookie de contournement de la protection Vercel (ADR-0008) et le garde
//   pour tous les tests. Le secret n'est envoyé qu'ici, à Vercel, et jamais au serveur Cloudflare (US-003).
// - En local : crée le compte de test sur le serveur de test, par la route d'installation (US-003). Il existe déjà si
//   le serveur a été démarré par un lancement précédent (409 accepté).
import { request } from '@playwright/test';
import { preparerDemandeInstallation } from '@poule-position/protocole';
import { compteLocal, ETAT_PREVIEW, SECRET_INSTALLATION_LOCAL, URL_SERVEUR_LOCAL } from './compte';

async function obtenirCookiePreview(urlPreview: string) {
  const secret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET ?? '';
  const contexte = await request.newContext({
    baseURL: urlPreview,
    extraHTTPHeaders: { 'x-vercel-protection-bypass': secret, 'x-vercel-set-bypass-cookie': 'true' },
  });
  try {
    const reponse = await contexte.get('/');
    if (!reponse.ok()) throw new Error(`Preview inaccessible avec le secret de contournement (${reponse.status()})`);
    await contexte.storageState({ path: ETAT_PREVIEW });
  } finally {
    await contexte.dispose();
  }
}

async function creerCompteLocal() {
  const reponse = await fetch(`${URL_SERVEUR_LOCAL}/installation/administrateur`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SECRET_INSTALLATION_LOCAL}` },
    body: JSON.stringify(await preparerDemandeInstallation(compteLocal)),
  });
  if (reponse.status !== 201 && reponse.status !== 409) {
    throw new Error(`Création du compte de test impossible (${reponse.status}) : ${await reponse.text()}`);
  }
}

export default async function preparer() {
  if (process.env.BASE_URL) await obtenirCookiePreview(process.env.BASE_URL);
  else await creerCompteLocal();
}
