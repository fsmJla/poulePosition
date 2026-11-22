// Écrans géants (US-133, ADR-0029, docs/protocole.md §23) : réglages d'affichage gardés dans le DO `Club`. Un écran
// appartient à une manifestation, ou à une compétition seule ; il affiche les épreuves cochées, publiées ou non, par son
// lien secret (`…/ecran/<id>#<jeton>`), échangé contre un ticket de 60 s.
import { MOTIF_IDENTIFIANT } from './epreuves';
import { aExactementLesChamps } from './validation';

/** Vues d'un écran, dans l'ordre de leur défilement (US-134 CA-2) ; chacune peut être masquée. */
export const VUES_ECRAN = ['appel', 'poules', 'classement', 'tableau', 'podium'] as const;
export type VueEcran = (typeof VUES_ECRAN)[number];

export const DUREE_PAGE_DEFAUT = 15;
export const DUREE_PAGE_MIN = 5;
export const DUREE_PAGE_MAX = 120;
export const LONGUEUR_MAX_NOM_ECRAN = 60;
export const EPREUVES_MAX_ECRAN = 50;

/** US-140 : style d'un écran ; « sombre » par défaut, y compris pour un écran créé avant l'US. */
export const STYLES_ECRAN = ['sombre', 'clair'] as const;
export type StyleEcran = (typeof STYLES_ECRAN)[number];

/** US-141 : bandeau des derniers scores, désactivé par défaut ; scores des N dernières minutes. */
export interface BandeauEcran {
  actif: boolean;
  minutes: number;
}
export const BANDEAU_MINUTES_MIN = 1;
export const BANDEAU_MINUTES_MAX = 120;
export const BANDEAU_DEFAUT: BandeauEcran = { actif: false, minutes: 15 };

/** Jeton d'un écran : 128 bits en base64url (22 caractères). */
export const MOTIF_JETON_ECRAN = /^[A-Za-z0-9_-]{22}$/;

export interface ProprietaireEcran {
  type: 'manifestation' | 'competition';
  id: string;
}

/** US-135 : vue imposée à un écran jusqu'à `jusqua` (ms), ou jusqu'à reprise du défilement (`null`). */
export interface VueImposee {
  epreuveId: string;
  vue: VueEcran;
  /** Numéro de poule pour la vue « poules » ; null : toutes. */
  poule: number | null;
  jusqua: number | null;
}

/** Ce que l'organisateur règle (US-133 CA-2). */
export interface ReglagesEcran {
  nom: string;
  epreuves: string[];
  dureePage: number;
  vuesMasquees: VueEcran[];
  style: StyleEcran;
  bandeau: BandeauEcran;
}

/** Réglages facultatifs à la lecture (absents d'un écran créé avant US-140 et US-141). */
const FACULTATIFS = ['style', 'bandeau'];

/** Comme `aExactementLesChamps`, avec des champs facultatifs. */
function aLesChamps(brut: unknown, obligatoires: readonly string[]): Record<string, unknown> | null {
  if (brut === null || typeof brut !== 'object' || Array.isArray(brut)) return null;
  const o = brut as Record<string, unknown>;
  const permis = new Set([...obligatoires, ...FACULTATIFS]);
  const cles = Object.keys(o);
  return cles.every((cle) => permis.has(cle)) && obligatoires.every((cle) => cle in o) ? o : null;
}

function lireBandeau(brut: unknown): BandeauEcran | null {
  if (brut === undefined) return { ...BANDEAU_DEFAUT };
  const o = aExactementLesChamps(brut, ['actif', 'minutes']);
  if (!o || typeof o.actif !== 'boolean' || !Number.isInteger(o.minutes)) return null;
  const minutes = o.minutes as number;
  return minutes >= BANDEAU_MINUTES_MIN && minutes <= BANDEAU_MINUTES_MAX ? { actif: o.actif, minutes } : null;
}

export interface Ecran extends ReglagesEcran {
  id: string;
  proprietaire: ProprietaireEcran;
  jeton: string;
  creeLe: number;
  /** Dernière fois que l'écran a demandé un ticket (ms), ou null s'il n'a jamais été ouvert. */
  ouvertLe: number | null;
  vueImposee: VueImposee | null;
}

/** Ce qu'un écran reçoit de lui-même (sans son jeton). */
export type EcranPublic = Omit<Ecran, 'jeton'>;

export type DemandeEcran = ReglagesEcran & { proprietaire: ProprietaireEcran };

export type ReponseEcrans = { ok: true; ecrans: Ecran[] } | { ok: false; erreur: string };
export type ReponseEcran = { ok: true; ecran: Ecran } | { ok: false; erreur: string };
export type ReponseTicketEcran =
  { ok: true; ticket: string; expireLe: number; ecran: EcranPublic; titre: string } | { ok: false; erreur: string };

const estEntier = (valeur: unknown): valeur is number => Number.isInteger(valeur);

function lireReglages(o: Record<string, unknown>): ReglagesEcran | null {
  const { nom, epreuves, dureePage, vuesMasquees } = o;
  const style = o.style === undefined ? 'sombre' : o.style;
  if (!(STYLES_ECRAN as readonly unknown[]).includes(style)) return null;
  const bandeau = lireBandeau(o.bandeau);
  if (!bandeau) return null;
  if (typeof nom !== 'string') return null;
  const nomPropre = nom.trim();
  if (nomPropre.length === 0 || nomPropre.length > LONGUEUR_MAX_NOM_ECRAN) return null;
  if (!Array.isArray(epreuves) || epreuves.length > EPREUVES_MAX_ECRAN) return null;
  if (!epreuves.every((id) => typeof id === 'string' && MOTIF_IDENTIFIANT.test(id))) return null;
  if (new Set(epreuves).size !== epreuves.length) return null;
  if (!estEntier(dureePage) || dureePage < DUREE_PAGE_MIN || dureePage > DUREE_PAGE_MAX) return null;
  if (!Array.isArray(vuesMasquees) || !vuesMasquees.every((v) => (VUES_ECRAN as readonly unknown[]).includes(v))) {
    return null;
  }
  return {
    nom: nomPropre,
    epreuves: epreuves as string[],
    dureePage,
    vuesMasquees: [...new Set(vuesMasquees as VueEcran[])],
    style: style as StyleEcran,
    bandeau,
  };
}

function lireProprietaire(brut: unknown): ProprietaireEcran | null {
  const o = aExactementLesChamps(brut, ['type', 'id']);
  if (!o || (o.type !== 'manifestation' && o.type !== 'competition')) return null;
  return typeof o.id === 'string' && MOTIF_IDENTIFIANT.test(o.id) ? { type: o.type, id: o.id } : null;
}

/** CA-2 : corps de `POST /ecrans`. */
export function analyserDemandeEcran(brut: unknown): { ok: true; demande: DemandeEcran } | { ok: false } {
  const o = aLesChamps(brut, ['proprietaire', 'nom', 'epreuves', 'dureePage', 'vuesMasquees']);
  if (!o) return { ok: false };
  const proprietaire = lireProprietaire(o.proprietaire);
  const reglages = lireReglages(o);
  return proprietaire && reglages ? { ok: true, demande: { proprietaire, ...reglages } } : { ok: false };
}

/** CA-5 : corps de `PATCH /ecrans/<id>` (le propriétaire ne change pas). */
export function analyserDemandeReglages(brut: unknown): { ok: true; demande: ReglagesEcran } | { ok: false } {
  const o = aLesChamps(brut, ['nom', 'epreuves', 'dureePage', 'vuesMasquees']);
  const reglages = o ? lireReglages(o) : null;
  return reglages ? { ok: true, demande: reglages } : { ok: false };
}

/** US-135 : corps de `PUT /ecrans/<id>/vue` ; `null` reprend le défilement. */
export function analyserVueImposee(brut: unknown): { ok: true; vue: VueImposee | null } | { ok: false } {
  if (brut === null) return { ok: true, vue: null };
  const o = aExactementLesChamps(brut, ['epreuveId', 'vue', 'poule', 'jusqua']);
  if (!o || typeof o.epreuveId !== 'string' || !MOTIF_IDENTIFIANT.test(o.epreuveId)) return { ok: false };
  if (!(VUES_ECRAN as readonly unknown[]).includes(o.vue)) return { ok: false };
  if (!(o.poule === null || (estEntier(o.poule) && o.poule >= 1))) return { ok: false };
  if (!(o.jusqua === null || (estEntier(o.jusqua) && o.jusqua > 0))) return { ok: false };
  return {
    ok: true,
    vue: {
      epreuveId: o.epreuveId,
      vue: o.vue as VueEcran,
      poule: o.poule as number | null,
      jusqua: o.jusqua as number | null,
    },
  };
}

/** Un écran tel que le serveur le renvoie (validation côté application, et relecture de la copie de l'appareil). */
export function analyserEcran(brut: unknown): Ecran | null {
  const o = aLesChamps(brut, [
    'id',
    'proprietaire',
    'nom',
    'epreuves',
    'dureePage',
    'vuesMasquees',
    'jeton',
    'creeLe',
    'ouvertLe',
    'vueImposee',
  ]);
  if (!o || typeof o.id !== 'string' || typeof o.jeton !== 'string' || !estEntier(o.creeLe)) return null;
  if (!(o.ouvertLe === null || estEntier(o.ouvertLe))) return null;
  const proprietaire = lireProprietaire(o.proprietaire);
  const reglages = lireReglages(o);
  const vue = analyserVueImposee(o.vueImposee);
  if (!proprietaire || !reglages || !vue.ok) return null;
  return {
    id: o.id,
    proprietaire,
    ...reglages,
    jeton: o.jeton,
    creeLe: o.creeLe,
    ouvertLe: o.ouvertLe as number | null,
    vueImposee: vue.vue,
  };
}

/** Le lien d'un écran : le jeton est dans le fragment, jamais envoyé au serveur dans une adresse. */
export function lienEcran(origine: string, ecran: Pick<Ecran, 'id' | 'jeton'>): string {
  return `${origine}/ecran/${ecran.id}#${ecran.jeton}`;
}

/** US-134 : un écran tel qu'il se reçoit lui-même (sans jeton), sinon null. */
export function analyserEcranPublic(brut: unknown): EcranPublic | null {
  if (brut === null || typeof brut !== 'object' || Array.isArray(brut) || 'jeton' in brut) return null;
  const lu = analyserEcran({ ...(brut as Record<string, unknown>), jeton: '' });
  if (!lu) return null;
  return ecranPublic(lu);
}

/** Un écran sans son jeton : ce que l'écran lui-même reçoit. */
export function ecranPublic(ecran: Ecran): EcranPublic {
  const { id, proprietaire, nom, epreuves, dureePage, vuesMasquees, style, bandeau, creeLe, ouvertLe, vueImposee } =
    ecran;
  return { id, proprietaire, nom, epreuves, dureePage, vuesMasquees, style, bandeau, creeLe, ouvertLe, vueImposee };
}
