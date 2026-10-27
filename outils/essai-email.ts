// Essai d'envoi d'e-mail (US-018 CA-2, ADR-0015) : demande au Worker d'envoyer l'e-mail d'essai, par le SMTP du club.
//   npm run essai-email -- --env preview vous@exemple.fr      (ou --env production, ou --url http://localhost:8790)
// Le secret d'installation est demandé sans s'afficher ; l'e-mail part du Worker, pas de ce PC.
import { pathToFileURL } from 'node:url';
import { normaliserEmail, validerEmail } from '@poule-position/domaine';
import { messageErreurInstallation } from '@poule-position/protocole';
import { analyserArguments, questionneurTerminal, verifierTerminal, type Questionneur } from './creer-admin';

const AIDE =
  'Usage : npm run essai-email -- --env preview <destinataire> | --env production <destinataire> | --url <adresse> <destinataire>';

/** Serveur visé (`--env` ou `--url`) et destinataire de l'e-mail d'essai. */
export function analyserArgumentsEssai(argv: string[]): { url: string; destinataire: string } | { erreur: string } {
  const cible = analyserArguments(argv.slice(0, 2));
  const destinataire = argv[2] ?? '';
  if ('erreur' in cible || validerEmail(destinataire) !== null) return { erreur: AIDE };
  return { url: cible.url, destinataire: normaliserEmail(destinataire) };
}

/** Exécute la commande ; renvoie le code de sortie (0 si l'e-mail d'essai est parti). */
export async function executer(
  argv: string[],
  questionneur: Questionneur,
  envoyer: typeof fetch = fetch,
): Promise<number> {
  const cible = analyserArgumentsEssai(argv);
  if ('erreur' in cible) {
    questionneur.afficher(cible.erreur);
    return 1;
  }
  let secret = '';
  while (!secret) secret = (await questionneur.demander("Secret d'installation : ", true)).trim();

  let reponse: Response;
  try {
    reponse = await envoyer(`${cible.url}/installation/essai-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
      body: JSON.stringify({ destinataire: cible.destinataire }),
    });
  } catch {
    questionneur.afficher('Serveur injoignable : vérifiez la connexion');
    return 1;
  }
  const corps = (await reponse.json().catch(() => ({}))) as { ok?: boolean; erreur?: string };
  if (reponse.ok && corps.ok) {
    questionneur.afficher(
      `E-mail d’essai envoyé à ${cible.destinataire} : vérifiez la boîte de réception (et les indésirables).`,
    );
    return 0;
  }
  questionneur.afficher(messageErreurInstallation(corps.erreur));
  return 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const refus = verifierTerminal(process.stdin.isTTY && process.stdout.isTTY);
  if (refus) {
    console.error(
      refus.replace('npm run creer-admin -- --env preview', 'npm run essai-email -- --env preview <adresse>'),
    );
    process.exit(1);
  }
  const questionneur = questionneurTerminal();
  executer(process.argv.slice(2), questionneur)
    .then((code) => {
      process.exitCode = code;
    })
    .finally(() => questionneur.fermer());
}
