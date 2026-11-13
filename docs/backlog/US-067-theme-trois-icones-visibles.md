# US-067 — Afficher en permanence les trois icônes de thème sur PC

- **Epic :** E1 — Comptes et authentification
- **Fonctionnalité :** F1 (exigences §3)
- **Priorité :** P2
- **Type :** fonctionnelle
- **Statut :** Prête
- **Dépend de :** US-052, US-054
- **Branche / PR :** — (renseignés par `/debut-impl-US` et `/fin-impl-US`)

## Récit

**En tant qu'**organisateur sur PC, **je veux** voir en permanence les trois icônes de thème (soleil, lune, écran) dans
l'entête, **afin de** changer de thème en un clic sans ouvrir un menu.

Maquette : planche 1 (`ihm/1-accueil.png`), principes 2 et 4. La planche prévoit une **seule icône de thème qui ouvre le
choix** (US-054) ; cette US s'en écarte volontairement (Hypothèses).

## Critères d'acceptation

**CA-1 — Trois icônes toujours visibles**
- **Étant donné** un écran large (au moins 640 px), sur n'importe quelle page connectée ou publique
- **Quand** la page s'affiche
- **Alors** l'entête montre côte à côte trois boutons à icône seule : soleil (clair), lune (sombre), écran (automatique),
  sans menu à ouvrir ; celui du thème en cours est mis en évidence et porte `aria-pressed="true"`.

**CA-2 — Un clic suffit**
- **Étant donné** les trois icônes
- **Quand** l'organisateur clique sur l'une d'elles
- **Alors** le thème change aussitôt, sans recharger la page, et le choix est retenu sur l'appareil (comportement d'US-052 CA-3 à CA-5).

**CA-3 — Accessibles**
- **Étant donné** chaque bouton
- **Quand** il reçoit le focus ou le survol
- **Alors** il a un nom accessible (« Thème clair », « Thème sombre », « Thème automatique »), une infobulle et une cible
  d'au moins 44 × 44 px ; l'ensemble est un groupe nommé « Thème » et se parcourt au clavier.

**CA-4 — Écran étroit inchangé**
- **Étant donné** un écran de moins de 640 px
- **Quand** l'entête s'affiche
- **Alors** il garde la marque, la loupe et le menu de compte, où se trouve le choix du thème (US-054 CA-7) ; aucun
  défilement horizontal.

**CA-5 — Place dans l'entête**
- **Étant donné** un écran de 1 040 px, administrateur, avec la recherche, « Créer », « Comptes », l'aide et le menu de compte
- **Quand** l'entête s'affiche
- **Alors** tout tient sur une ligne, sans chevauchement ni troncature du champ de recherche en dessous de sa largeur minimale.

## Comportement hors ligne

Sans objet : le thème est un réglage local de l'appareil, sans réseau (US-052).

## Cas limites et erreurs

- Stockage local indisponible (navigation privée) : le choix s'applique pour la session, comme dans US-052.
- Thème choisi puis système qui change : « automatique » suit le système, les deux autres non.

## Hypothèses

- « Sur PC » = écran d'au moins 640 px (seuil d'US-061). Sur smartphone, le choix reste dans le menu de compte, faute de place.
- Écart à la planche 1 et au principe 4 : trois icônes seules visibles au lieu d'une. À valider, avec la mise à jour du
  tableau d'icônes de `docs/maquettes/README.md`.
- L'icône « écran » désigne aussi « Ce PC est le pilote » dans le vocabulaire ; elle est utilisée ici pour « automatique »,
  comme dans la capture de recette. Pour lever l'ambiguïté, le tableau d'icônes doit nommer « Écran (thème automatique) »
  à part, groupée avec Soleil et Lune. À valider.
- Le sélecteur à trois icônes existe déjà (`SelecteurTheme.svelte`, `BarreOutils.svelte`, US-052) : on le remet dans
  l'entête des pages connectées, sans nouveau comportement.

## Questions bloquantes

Aucune.

## Notes techniques

- Amende le rendu d'US-054 (« seule sa présentation devient une icône qui ouvre le choix ») sur écran large ; la logique
  de `lib/theme.ts` ne change pas.
- Test de garde : trois boutons visibles sans interaction à 1 360 px, et dans le menu de compte à 390 px.

## Suivi

| Date | Événement |
|---|---|
| 2026-11-13 | Créée depuis le retour de recette « Brain Dump » (PC) |
