// Accès par QR code (US-096, ADR-0007) : un jeton aléatoire de 128 bits par rôle (arbitres, tireurs), valable pour toute
// l'épreuve. Le jeton en clair est gardé par le pilote et par le DO de l'épreuve ; le journal n'en garde que l'empreinte
// (SHA-256, en hexadécimal), écrite par l'événement `JetonQrDefini`. Logique pure.
import type { Statut } from './epreuve';

export const ROLES_QR = ['arbitre', 'tireur'] as const;
export type RoleQr = (typeof ROLES_QR)[number];

/** Jeton de 128 bits écrit en base64url, sans remplissage : 22 caractères. */
export const MOTIF_JETON_QR = /^[A-Za-z0-9_-]{22}$/;
/** Empreinte SHA-256 du jeton, en hexadécimal minuscule. */
export const MOTIF_EMPREINTE_QR = /^[0-9a-f]{64}$/;

export interface DonneesJetonQr {
  role: RoleQr;
  empreinte: string;
}

/** Empreintes des jetons en service, par rôle ; null tant qu'aucun jeton n'a été généré. */
export interface AccesQr {
  arbitre: string | null;
  tireur: string | null;
}

export const accesQrVide = (): AccesQr => ({ arbitre: null, tireur: null });

export type ErreurAccesQr = 'ROLE_QR_INVALIDE' | 'EMPREINTE_INVALIDE';

/** CA-2 et CA-4 : les données d'un `JetonQrDefini` sont-elles recevables ? */
export function verifierDonneesJetonQr({ role, empreinte }: DonneesJetonQr): ErreurAccesQr | null {
  if (!(ROLES_QR as readonly string[]).includes(role)) return 'ROLE_QR_INVALIDE';
  return MOTIF_EMPREINTE_QR.test(empreinte) ? null : 'EMPREINTE_INVALIDE';
}

/** CA-6 : un lien QR n'ouvre l'accès que tant que l'épreuve n'est ni terminée ni archivée. */
export function accesQrOuvert(statut: Statut): boolean {
  return statut === 'preparation' || statut === 'enCours';
}

/** CA-1 : le lien d'un QR code ; le jeton est dans le fragment (`#`), qui n'est jamais envoyé au serveur ni journalisé. */
export function lienQr(origine: string, epreuveId: string, jeton: string): string {
  return `${origine.replace(/\/+$/, '')}/saisie/${encodeURIComponent(epreuveId)}#j=${jeton}`;
}
