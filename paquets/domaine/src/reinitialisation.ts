// Réinitialisation du mot de passe par e-mail (US-019) : durée d'un lien et limite des demandes. Dates en
// millisecondes, mesurées par le serveur.

/** US-019 CA-3 : un lien de réinitialisation vaut 1 heure. */
export const DUREE_LIEN_REINITIALISATION = 60 * 60_000;
/** US-019 CA-5 : au plus 3 demandes par heure pour un même compte. */
export const MAX_DEMANDES_REINITIALISATION = 3;
export const FENETRE_DEMANDES_REINITIALISATION = 60 * 60_000;

export function expirationLien(maintenant: number): number {
  return maintenant + DUREE_LIEN_REINITIALISATION;
}

export function lienExpire(expireLe: number, maintenant: number): boolean {
  return maintenant >= expireLe;
}

/** Demandes encore dans la fenêtre d'une heure. */
function recentes(demandes: readonly number[], maintenant: number): number[] {
  return demandes.filter((date) => maintenant - date < FENETRE_DEMANDES_REINITIALISATION);
}

/** US-019 CA-5 : vrai si une nouvelle demande peut envoyer un e-mail. */
export function demandeAutorisee(demandes: readonly number[], maintenant: number): boolean {
  return recentes(demandes, maintenant).length < MAX_DEMANDES_REINITIALISATION;
}

/** Ajoute une demande, en oubliant celles de plus d'une heure. */
export function noterDemande(demandes: readonly number[], maintenant: number): number[] {
  return [...recentes(demandes, maintenant), maintenant];
}
