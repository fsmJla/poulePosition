// Jetons des QR codes (US-096, ADR-0007, docs/protocole.md §19) : le pilote les génère et les confie au DO de l'épreuve,
// qui les vérifiera à l'ouverture d'un lien (US-097, US-103). Le journal n'en garde que l'empreinte (`JetonQrDefini`).
import { MOTIF_JETON_QR, ROLES_QR, type RoleQr } from '@poule-position/domaine';
import { CODES_ERREUR_SESSION, type CodeErreurSession } from './session';
import type { PiloteEnPlace } from './epreuves';

/** Corps de `PUT /epreuves/<id>/jetons/<role>` : l'appareil pilote et le nouveau jeton en clair. */
export interface DemandeJetonQr {
  appareilId: string;
  jeton: string;
}

export type ReponseJetonQr =
  { ok: true } | ({ ok: false; erreur: CodeErreurSession | 'REPONSE_INVALIDE' } & PiloteEnPlace);

/** `GET /epreuves/<id>/jetons` : les jetons en service, en clair (comptes du club seulement), null s'il n'y en a pas. */
export type ReponseJetonsQr =
  | { ok: true; arbitre: string | null; tireur: string | null }
  | { ok: false; erreur: CodeErreurSession | 'REPONSE_INVALIDE' };

export const estRoleQr = (valeur: unknown): valeur is RoleQr => (ROLES_QR as readonly unknown[]).includes(valeur);

const estObjet = (brut: unknown): brut is Record<string, unknown> =>
  brut !== null && typeof brut === 'object' && !Array.isArray(brut);

const erreurDe = (brut: unknown): { ok: false; erreur: CodeErreurSession | 'REPONSE_INVALIDE' } => {
  const code = estObjet(brut) ? brut.erreur : undefined;
  return {
    ok: false,
    erreur: (CODES_ERREUR_SESSION as readonly unknown[]).includes(code)
      ? (code as CodeErreurSession)
      : 'REPONSE_INVALIDE',
  };
};

export function analyserDemandeJetonQr(brut: unknown): { ok: true; demande: DemandeJetonQr } | { ok: false } {
  if (!estObjet(brut) || Object.keys(brut).sort().join(',') !== 'appareilId,jeton') return { ok: false };
  const { appareilId, jeton } = brut;
  if (typeof appareilId !== 'string' || appareilId === '' || appareilId.length > 64) return { ok: false };
  if (typeof jeton !== 'string' || !MOTIF_JETON_QR.test(jeton)) return { ok: false };
  return { ok: true, demande: { appareilId, jeton } };
}

export function analyserReponseJetonQr(brut: unknown): ReponseJetonQr {
  if (estObjet(brut) && brut.ok === true) return { ok: true };
  const refus = erreurDe(brut);
  if (!estObjet(brut)) return refus;
  const { piloteAppareil, piloteNom } = brut;
  return {
    ...refus,
    ...(typeof piloteAppareil === 'string' && { piloteAppareil }),
    ...(typeof piloteNom === 'string' && { piloteNom }),
  };
}

export function analyserReponseJetonsQr(brut: unknown): ReponseJetonsQr {
  if (!estObjet(brut) || brut.ok !== true) return erreurDe(brut);
  const lire = (valeur: unknown) =>
    valeur === null || (typeof valeur === 'string' && MOTIF_JETON_QR.test(valeur)) ? valeur : undefined;
  const arbitre = lire(brut.arbitre);
  const tireur = lire(brut.tireur);
  if (arbitre === undefined || tireur === undefined) return { ok: false, erreur: 'REPONSE_INVALIDE' };
  return { ok: true, arbitre, tireur };
}
