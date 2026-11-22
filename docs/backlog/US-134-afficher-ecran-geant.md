# US-134 — Afficher l'écran géant avec un défilement automatique

- **Epic :** E9 — Affichage en direct
- **Fonctionnalité :** F13 (exigences §3, §6 : moins de 2 s entre la saisie et l'affichage)
- **Priorité :** P1
- **Type :** fonctionnelle
- **Statut :** Terminée
- **Dépend de :** US-132, US-133
- **Branche / PR :** us/US-132-publier-vue-en-direct (série E9 enchaînée, une seule PR vers dev)

## Récit

**En tant que** spectateur dans la salle, **je veux** voir sur l'écran géant l'appel des matchs, les poules en cours,
le classement et le tableau des épreuves choisies, qui défilent seuls, **afin de** savoir où et quand tirer, et de
suivre les résultats.

Maquette : planches 31 à 35 (`docs/maquettes/direct/31-ecran-appel.png` à `35-ecran-podium.png`), 1920 × 1080, thème sombre.

## Critères d'acceptation

**CA-1 — Ouverture par le lien d'écran**
- **Étant donné** le lien d'un écran (US-133)
- **Quand** il est ouvert sur une TV ou un mini-PC
- **Alors** l'écran s'affiche en plein écran (bouton « Plein écran » au premier affichage), sans entête de
  l'application ni action, avec le nom de la manifestation et l'heure.

**CA-2 — Défilement selon l'avancement**
- **Étant donné** un écran avec plusieurs épreuves cochées
- **Quand** il tourne
- **Alors** il enchaîne, pour chaque épreuve, les pages utiles à son étape, chacune pendant la durée réglée :
  - **poules en cours :** l'appel par piste, puis les poules et leurs scores, puis le classement provisoire ;
  - **poules finies :** le classement ;
  - **tableau :** l'appel des matchs, puis le tour en cours du tableau, puis le classement après les poules ;
  - **épreuve terminée :** le podium, puis le classement final.

  Une page trop longue se découpe en plusieurs pages. Les vues masquées (US-133) sont sautées.

**CA-3 — Mise à jour en direct**
- **Étant donné** la page d'une poule affichée
- **Quand** un score y est enregistré par le pilote
- **Alors** il apparaît en moins de 2 s, sans recommencer le défilement.

**CA-4 — Pilote absent ou réseau coupé**
- **Étant donné** un écran dont la vue n'est plus à jour (pilote absent, réseau de l'écran coupé)
- **Quand** il continue à défiler
- **Alors** il affiche discrètement « Dernière mise à jour : 14 h 32 » et reprend seul au retour.

**CA-5 — Lien invalide**
- **Étant donné** un lien régénéré ou un écran supprimé
- **Quand** l'écran s'ouvre ou est connecté
- **Alors** il affiche « Ce lien d'écran n'est plus valable : demandez le nouveau à l'organisateur ».

**CA-6 — Lisible de loin**
- **Étant donné** une salle de 20 m
- **Quand** l'écran affiche une poule de 7 ou un tableau de 16
- **Alors** les noms et les scores restent lisibles (tailles fixées par la planche), en thème sombre par défaut.

**CA-7 — Conforme aux planches 31 à 35**
- **Étant donné** les données des planches
- **Quand** chaque page s'affiche à 1920 × 1080
- **Alors** elle est conforme à sa capture (`direct/31-ecran-appel.png` à `direct/35-ecran-podium.png`).

## Comportement hors ligne

Un écran distant dépend d'internet (ADR-0010). Si le pilote ou l'écran perd le réseau, il garde la dernière vue avec
son heure (CA-4) et reprend seul au retour. La version sans internet est la fenêtre locale (US-136).

## Cas limites et erreurs

- Aucune épreuve en cours : page d'attente (nom de la manifestation, prochaines épreuves et leurs horaires d'appel).
- Écran en 4/3 ou en 1280 × 720 : la mise en page s'adapte, sans défilement.
- Veille de la TV : l'écran demande au navigateur de ne pas se mettre en veille (Wake Lock) quand c'est possible.

## Hypothèses

- Ordre des épreuves : celui des cases cochées ; à étape égale, on alterne les épreuves.
- Thème sombre par défaut sur l'écran géant, plus lisible dans une salle.

## Questions bloquantes

- Aucune (planches validées le 2026-11-21).

## Notes techniques

- Page `/ecran/<id>` ; le jeton est dans le fragment (`#`), jamais envoyé dans l'adresse au serveur (comme les QR,
  US-097).
- Une WebSocket de lecture par épreuve cochée (US-132).

## Suivi

| Date | Événement |
|---|---|
| 2026-11-21 | Créée (spécification de l'Epic 9) |
| 2026-11-21 | Planches validées : Prête |
| 2026-11-21 | Implémentée : page `/ecran/<id>#<jeton>` (ticket, socket de contrôle, une socket de lecture par épreuve), défilement selon l'étape (`ecran-geant.ts`), pages des planches 31 à 35, « Dernière mise à jour », lien invalide, plein écran et Wake Lock. Tests : `ecran-geant.test.ts`, `connexion-ecran.test.ts`, E2E `ecran-geant.spec.ts` (CA-1 à CA-3, CA-5) : En revue |
| 2026-11-21 | Recette : à la demande de l'utilisateur, le classement s'ajoute au défilement pendant les poules (provisoire) et au tableau (après les poules), pas seulement entre les deux ; le pied de l'écran ne garde que l'heure de mise à jour |
| 2026-11-22 | Recette OK par l'utilisateur sur la preview de la PR #182 ; mergée dans `dev` |
