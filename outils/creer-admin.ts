// Commande d'installation (US-002) : crée le premier administrateur d'un environnement.
//   npm run creer-admin -- --env preview      (ou --env production, ou --url http://localhost:8790)
// Le mot de passe ne quitte jamais ce PC : seule la clé dérivée par PBKDF2 est envoyée (ADR-0006).
import { createInterface } from 'node:readline/promises';
import { pathToFileURL } from 'node:url';
import {
  validerConfirmation,
  validerEmail,
  validerMotDePasse,
  validerNom,
  LONGUEUR_MIN_MOT_DE_PASSE,
  type ErreurSaisieCompte,
} from '@poule-position/domaine';
import { messageErreurInstallation, preparerDemandeInstallation } from '@poule-position/protocole';

export const URLS_SERVEUR = {
  preview: 'https://poule-position-serveur-preview.spuc-escrime.workers.dev',
  production: 'https://poule-position-serveur.spuc-escrime.workers.dev',
} as const;

const AIDE = 'Usage : npm run creer-admin -- --env preview | --env production | --url http://localhost:8790';

const MESSAGES: Record<ErreurSaisieCompte, string> = {
  EMAIL_INVALIDE: 'E-mail invalide.',
  NOM_VIDE: 'Le nom est obligatoire.',
  NOM_TROP_LONG: 'Le nom fait au plus 100 caractères.',
  MOT_DE_PASSE_TROP_COURT: `Le mot de passe doit faire au moins ${LONGUEUR_MIN_MOT_DE_PASSE} caractères.`,
  CONFIRMATION_DIFFERENTE: 'Les deux mots de passe sont différents : recommencez.',
};

/** Pose les questions et affiche les messages (terminal, ou simulation dans les tests). */
export interface Questionneur {
  demander(question: string, masque?: boolean): Promise<string>;
  afficher(message: string): void;
}

export interface SaisieAdministrateur {
  email: string;
  nom: string;
  motDePasse: string;
}

/** Adresse du serveur visé, d'après `--env` ou `--url`. */
export function analyserArguments(argv: string[]): { url: string } | { erreur: string } {
  const [option, valeur] = argv;
  if (option === '--env' && (valeur === 'preview' || valeur === 'production')) return { url: URLS_SERVEUR[valeur] };
  if (option === '--url' && valeur && /^https?:\/\/\S+$/.test(valeur)) return { url: valeur.replace(/\/+$/, '') };
  return { erreur: AIDE };
}

/** Demande une valeur jusqu'à ce qu'elle soit valide. */
async function demanderValide(
  questionneur: Questionneur,
  question: string,
  valider: (valeur: string) => ErreurSaisieCompte | null,
  masque = false,
): Promise<string> {
  for (;;) {
    const valeur = await questionneur.demander(question, masque);
    const erreur = valider(valeur);
    if (!erreur) return valeur;
    questionneur.afficher(MESSAGES[erreur]);
  }
}

/** US-002 CA-5 : chaque saisie invalide est redemandée ; rien n'est envoyé avant la fin. */
export async function saisirAdministrateur(questionneur: Questionneur): Promise<SaisieAdministrateur> {
  const email = await demanderValide(questionneur, 'E-mail : ', validerEmail);
  const nom = (await demanderValide(questionneur, 'Nom : ', validerNom)).trim();
  for (;;) {
    const motDePasse = await demanderValide(questionneur, 'Mot de passe : ', validerMotDePasse, true);
    const confirmation = await questionneur.demander('Confirmation du mot de passe : ', true);
    const erreur = validerConfirmation(motDePasse, confirmation);
    if (!erreur) return { email, nom, motDePasse };
    questionneur.afficher(MESSAGES[erreur]);
  }
}

/** Exécute la commande ; renvoie le code de sortie (0 si l'administrateur est créé). */
export async function executer(
  argv: string[],
  questionneur: Questionneur,
  envoyer: typeof fetch = fetch,
): Promise<number> {
  const cible = analyserArguments(argv);
  if ('erreur' in cible) {
    questionneur.afficher(cible.erreur);
    return 1;
  }
  questionneur.afficher(`Création du premier administrateur sur ${cible.url}`);
  const saisie = await saisirAdministrateur(questionneur);
  let secret = '';
  while (!secret) secret = (await questionneur.demander("Secret d'installation : ", true)).trim();

  const demande = await preparerDemandeInstallation(saisie);
  let reponse: Response;
  try {
    reponse = await envoyer(`${cible.url}/installation/administrateur`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
      body: JSON.stringify(demande),
    });
  } catch {
    questionneur.afficher('Serveur injoignable : vérifiez la connexion');
    return 1;
  }
  const corps = (await reponse.json().catch(() => ({}))) as { ok?: boolean; email?: string; erreur?: string };
  if (reponse.status === 201 && corps.ok) {
    questionneur.afficher(`Administrateur créé : ${corps.email}`);
    return 0;
  }
  questionneur.afficher(messageErreurInstallation(corps.erreur));
  return 1;
}

/** Questionneur du terminal : les saisies masquées (mots de passe, secret) ne s'affichent pas. */
function questionneurTerminal(): Questionneur & { fermer(): void } {
  const terminal = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  let masque = false;
  const sortie = terminal as unknown as { _writeToOutput(texte: string): void };
  sortie._writeToOutput = (texte) => {
    if (!masque) process.stdout.write(texte);
    else if (texte.includes('\n')) process.stdout.write('\n');
  };
  return {
    async demander(question, masquer = false) {
      process.stdout.write(question);
      masque = masquer;
      try {
        return await terminal.question('');
      } finally {
        masque = false;
      }
    },
    afficher: (message) => console.log(message),
    fermer: () => terminal.close(),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const questionneur = questionneurTerminal();
  executer(process.argv.slice(2), questionneur)
    .then((code) => {
      process.exitCode = code;
    })
    .finally(() => questionneur.fermer());
}
