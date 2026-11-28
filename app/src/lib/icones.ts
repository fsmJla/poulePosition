// Icônes de l'application (US-054 CA-4) : le vocabulaire de docs/maquettes/README.md, dessiné au trait en SVG
// (24 × 24, trait 1,75, `currentColor`). Pas de police d'icônes, pas d'émoji. Une icône garde le même sens partout ;
// ajouter une icône au tableau du vocabulaire avant de l'employer ici.

/** Tracés (contenu du `<svg>`) de chaque icône, par son nom. */
export const ICONES = {
  plus: '<path d="M12 5v14M5 12h14" />',
  loupe: '<circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" />',
  crayon:
    '<path d="M4 20l1-4.2L16.6 4.2a2 2 0 0 1 2.8 0l.4.4a2 2 0 0 1 0 2.8L8.2 19z" /><path d="m14.5 6.3 3.2 3.2" />',
  troisPoints:
    '<circle cx="5.5" cy="12" r="1.2" fill="currentColor" /><circle cx="12" cy="12" r="1.2" fill="currentColor" /><circle cx="18.5" cy="12" r="1.2" fill="currentColor" />',
  corbeille: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12M9 7V4.5h6V7" />',
  oeil: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="3" />',
  oeilBarre:
    '<path d="M2.5 12S6 5.5 12 5.5c1.6 0 3 .5 4.3 1.2M21.5 12S18 18.5 12 18.5c-1.6 0-3-.5-4.3-1.2" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2M4 4l16 16" />',
  ecran: '<rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" />',
  cadenas: '<rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" />',
  alerte: '<path d="M12 4 2.8 19.5h18.4z" /><path d="M12 10v4.5M12 17.2v.1" />',
  calendrier: '<rect x="3.5" y="5" width="17" height="15" rx="2" /><path d="M3.5 10h17M8 3v4M16 3v4" />',
  lieu: '<path d="M12 21s-6.5-5.7-6.5-11a6.5 6.5 0 0 1 13 0c0 5.3-6.5 11-6.5 11z" /><circle cx="12" cy="10" r="2.3" />',
  document: '<path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4" />',
  maison: '<path d="M4 11 12 4l8 7M6 10v10h12V10M10 20v-5h4v5" />',
  personnePlus: '<circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0M18 8v6M15 11h6" />',
  personnes:
    '<circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M15.5 4.8a3.5 3.5 0 0 1 0 6.4M18 14.3a6.5 6.5 0 0 1 3.5 5.7" />',
  listeCochee: '<rect x="5" y="4" width="14" height="17" rx="2" /><path d="m8.8 12.5 2 2 4-4.3M9 3v3h6V3" />',
  grille:
    '<rect x="3.5" y="4" width="17" height="16" rx="1.5" /><path d="M3.5 9.5h17M3.5 14.5h17M9.2 4v16M14.8 4v16" />',
  arbre: '<path d="M3 5h5v5H3M3 14h5v5H3M8 7.5h4V12M8 16.5h4V12M12 12h3M15 12h6M18 9v6" />',
  imprimante:
    '<path d="M7 9V4h10v5M7 17H5a1.5 1.5 0 0 1-1.5-1.5v-5A1.5 1.5 0 0 1 5 9h14a1.5 1.5 0 0 1 1.5 1.5v5A1.5 1.5 0 0 1 19 17h-2" /><rect x="7" y="14" width="10" height="6" />',
  curseurs:
    '<path d="M4 7h9M17 7h3M4 17h3M11 17h9M4 12h3M11 12h9" /><circle cx="15" cy="7" r="2" /><circle cx="9" cy="17" r="2" /><circle cx="9" cy="12" r="0.01" />',
  aide: '<circle cx="12" cy="12" r="9" /><path d="M9.3 9.5a2.8 2.8 0 1 1 4 2.5c-.9.5-1.3 1.1-1.3 2M12 17.2v.1" />',
  soleil:
    '<circle cx="12" cy="12" r="4" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" />',
  lune: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />',
  croix: '<path d="M6 6l12 12M18 6 6 18" />',
  flecheGauche: '<path d="M19 12H5M11 6l-6 6 6 6" />',
  chevron: '<path d="m9 6 6 6-6 6" />',
  liste: '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />',
  carres:
    '<rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />',
  coche: '<path d="m5 12.5 4.5 4.5L19 7.5" />',
  archive:
    '<rect x="3" y="4" width="18" height="4.5" rx="1" /><path d="M5 8.5V19a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8.5M10 12.5h4" />',
  telecharger: '<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19h14" />',
  televerser: '<path d="M12 16V5M7.5 9.5 12 5l4.5 4.5M5 19h14" />',
  lien: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />',
  // US-086 et US-087 (planches 8 et 9).
  flechesCroisees:
    '<path d="M3 7h3.5c2 0 3.2 1 4.3 2.6l2.4 4.8c1.1 1.6 2.3 2.6 4.3 2.6H21M3 17h3.5c1.4 0 2.4-.5 3.3-1.4M14.2 8.4c.9-.9 1.9-1.4 3.3-1.4H21M18.5 4.5 21 7l-2.5 2.5M18.5 14.5 21 17l-2.5 2.5" />',
  poignee:
    '<circle cx="9" cy="6" r="1.2" fill="currentColor" /><circle cx="15" cy="6" r="1.2" fill="currentColor" /><circle cx="9" cy="12" r="1.2" fill="currentColor" /><circle cx="15" cy="12" r="1.2" fill="currentColor" /><circle cx="9" cy="18" r="1.2" fill="currentColor" /><circle cx="15" cy="18" r="1.2" fill="currentColor" />',
  lecture: '<path d="M7 4.5v15l12-7.5z" />',
  /** US-099 : envoyé, en attente de la table (avion en papier, planches 14 et 15). */
  avion: '<path d="M4 12l16-8-6 16-3-7-7-1z" />',
  /** US-102 : saisie suspendue, pilote absent (planche 16). */
  pause: '<rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" />',
  /** US-100 : saisies reçues des smartphones (planche 10). */
  smartphone: '<rect x="7" y="3" width="10" height="18" rx="2" /><path d="M11 17.5h2" />',
} as const;

export type NomIcone = keyof typeof ICONES;

/** Noms de toutes les icônes (pour les tests et la documentation). */
export const NOMS_ICONES = Object.keys(ICONES) as NomIcone[];
