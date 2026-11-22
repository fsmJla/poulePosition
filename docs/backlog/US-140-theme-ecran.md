# US-140 — Choisir le thème clair ou sombre d'un écran géant

- **Epic :** E9 — Affichage en direct
- **Fonctionnalité :** F13 (exigences §3)
- **Priorité :** P1
- **Type :** fonctionnelle
- **Statut :** Prête
- **Dépend de :** US-133, US-134
- **Branche / PR :** — (renseignés par `/debut-impl-US` et `/fin-impl-US`)

## Récit

**En tant qu'**organisateur, **je veux** choisir pour chaque écran géant un affichage clair ou sombre, **afin de**
l'adapter à la salle (lumière du jour, vidéoprojecteur ou TV).

Maquette : réglage ajouté à la fenêtre de la planche 37 (« Style : Sombre / Clair ») ; l'écran en sombre suit les
planches 31 à 35, en clair il reprend les mêmes pages avec les couleurs du thème clair de l'application. Écart déclaré
dans les Hypothèses : pas de planche du thème clair de l'écran.

## Critères d'acceptation

**CA-1 — Réglage**
- **Étant donné** la fenêtre de réglage d'un écran (US-133)
- **Quand** l'organisateur choisit « Style : Clair » ou « Sombre »
- **Alors** le choix est enregistré avec l'écran ; « Sombre » est la valeur par défaut, y compris pour les écrans créés
  avant cette US.

**CA-2 — Appliqué sans rechargement**
- **Étant donné** un écran ouvert
- **Quand** son style change
- **Alors** l'écran passe dans le nouveau style en moins de 2 s, sans rechargement ni retour à la première page.

**CA-3 — Indépendant de l'appareil**
- **Étant donné** une TV dont le navigateur est réglé en clair
- **Quand** l'écran est réglé en sombre
- **Alors** il s'affiche en sombre : c'est le réglage de l'écran qui décide, pas celui de l'appareil.

## Comportement hors ligne

Le style fait partie des réglages de l'écran : la fenêtre locale (US-136) le reprend de la copie de l'appareil. Hors
ligne, il ne se change pas (réglages grisés, comme US-133).

## Cas limites et erreurs

- Écran créé avant cette US : sombre.

## Hypothèses

- Deux styles seulement ; le style personnalisé (couleurs et logo d'un sponsor) est l'US-144.
- Écart de maquette : pas de planche du thème clair de l'écran ; il reprend les couleurs du thème clair de l'application.

## Questions bloquantes

- Aucune.

## Notes techniques

- Champ `style: 'sombre' | 'clair'` facultatif dans `Ecran` (`paquets/protocole/src/ecrans.ts`), absent = sombre.
- Impacts : US-133 (fenêtre de réglage), US-134 (thème de l'écran, aujourd'hui toujours sombre).

## Suivi

| Date | Événement |
|---|---|
| 2026-11-22 | Créée (retours de recette de l'Epic 9) |
