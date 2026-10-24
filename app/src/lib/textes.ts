// Catalogue des textes de l'interface (français seul pour l'instant, ADR-0002). Aucun texte en dur dans les composants.
import type { EtatConnexion } from './connexion';

export const textes = {
  accroche: "Organisation et suivi de compétitions d'escrime",
  etats: {
    'non-configure': 'Serveur non configuré',
    connexion: 'Connexion au serveur…',
    connecte: 'Serveur connecté',
    injoignable: 'Serveur injoignable',
  } satisfies Record<EtatConnexion, string>,
};
