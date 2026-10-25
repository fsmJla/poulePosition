// Préparation globale des E2E (US-003) : en local, crée le compte de test sur le serveur de test, par la route
// d'installation. Il existe déjà si le serveur a été démarré par un lancement précédent (409 accepté).
import { preparerDemandeInstallation } from '@poule-position/protocole';
import { compteLocal, SECRET_INSTALLATION_LOCAL, URL_SERVEUR_LOCAL } from './compte';

export default async function preparer() {
  if (process.env.BASE_URL) return;
  const reponse = await fetch(`${URL_SERVEUR_LOCAL}/installation/administrateur`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SECRET_INSTALLATION_LOCAL}` },
    body: JSON.stringify(await preparerDemandeInstallation(compteLocal)),
  });
  if (reponse.status !== 201 && reponse.status !== 409) {
    throw new Error(`Création du compte de test impossible (${reponse.status}) : ${await reponse.text()}`);
  }
}
