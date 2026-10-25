// Catalogue des textes de l'interface (français seul pour l'instant, ADR-0002). Aucun texte en dur dans les composants.
import type { Role } from '@poule-position/domaine';
import type { EtatConnexion } from './connexion';
import type { ErreurConnexion } from './session';

export const textes = {
  accroche: "Organisation et suivi de compétitions d'escrime",
  etats: {
    'non-configure': 'Serveur non configuré',
    connexion: 'Connexion au serveur…',
    connecte: 'Serveur connecté',
    injoignable: 'Serveur injoignable',
  } satisfies Record<EtatConnexion, string>,
  accueil: {
    seConnecter: 'Se connecter',
    espaceOrganisateur: "Accueil de l'organisateur",
  },
  connexion: {
    titre: 'Se connecter',
    email: 'E-mail',
    motDePasse: 'Mot de passe',
    valider: 'Se connecter',
    enCours: 'Connexion…',
    retour: "Retour à l'accueil",
    horsLigne: 'Hors ligne : connexion possible uniquement sur un appareil déjà utilisé',
    erreurs: {
      IDENTIFIANTS_INVALIDES: 'E-mail ou mot de passe incorrect',
      COMPTE_DESACTIVE: 'Ce compte est désactivé : contactez un administrateur',
      HORS_LIGNE: 'Hors ligne : connexion possible uniquement sur un appareil déjà utilisé',
      SERVEUR_NON_CONFIGURE: 'Serveur non configuré : connexion impossible',
      ERREUR_INATTENDUE: 'Erreur inattendue du serveur : réessayez',
    } satisfies Record<ErreurConnexion, string>,
  },
  organisateur: {
    bonjour: (nom: string) => `Bonjour, ${nom}`,
    seDeconnecter: 'Se déconnecter',
  },
  roles: {
    administrateur: 'Administrateur',
    organisateur: 'Organisateur',
  } satisfies Record<Role, string>,
};
