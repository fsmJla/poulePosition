# US-045 — Rattacher toute épreuve à une compétition

- **Epic :** E2 — Compétitions
- **Fonctionnalité :** F2 (exigences §3)
- **Priorité :** P1
- **Type :** fonctionnelle
- **Statut :** Prête
- **Dépend de :** US-044
- **Branche / PR :** — (renseignés par `/debut-impl-US` et `/fin-impl-US`)

## Récit

**En tant qu'**organisateur, **je veux** qu'une épreuve appartienne toujours à une compétition, et qu'une compétition
puisse être dans une manifestation ou seule, **afin de** n'avoir qu'une règle à retenir : manifestation → compétitions
→ épreuves.

## Critères d'acceptation

Vocabulaire d'après US-044 : la compétition regroupe, l'épreuve se tire.

**CA-1 — Une épreuve est toujours dans une compétition**
- **Étant donné** le formulaire « Nouvelle épreuve »
- **Quand** aucune compétition n'est choisie
- **Alors** la création est impossible, avec « Choisissez la compétition de cette épreuve ». La règle est dans le
  domaine (`validerEpreuve`) et le protocole refuse une épreuve sans `competitionId`.

**CA-2 — Une compétition dans une manifestation, ou seule**
- **Étant donné** un organisateur en ligne
- **Quand** il crée une compétition sans choisir de manifestation
- **Alors** elle est créée seule et apparaît au premier niveau de la liste. Créée dans une manifestation, elle apparaît
  sous elle. La règle d'arme cohérente est conservée (US-024 CA-4).

**CA-3 — Le rattachement d'une épreuve tient en un champ**
- **Étant donné** une épreuve
- **Quand** elle est créée ou modifiée
- **Alors** son rattachement est sa seule compétition ; sa manifestation se déduit de la compétition. Les valeurs
  reprises (glossaire) sont le lieu et les jours de la manifestation et l'arme de la compétition, modifiables. Les
  dates d'une épreuve d'une manifestation restent comprises entre ses dates (US-025 CA-4).

**CA-4 — Une compétition seule en une étape (challenge)**
- **Étant donné** un organisateur qui crée une « compétition seule »
- **Quand** il valide le formulaire (nom, arme, date, catégorie, sexe…)
- **Alors** la compétition et sa première épreuve sont créées ensemble ; l'épreuve porte le nom de la compétition par
  défaut et s'ouvre directement. Le niveau compétition n'est pas montré tant qu'elle n'a qu'une épreuve.

**CA-5 — La liste de l'accueil suit le modèle**
- **Étant donné** la liste du club (US-026)
- **Quand** elle est affichée
- **Alors** elle montre les manifestations, leurs compétitions et leurs épreuves, puis les compétitions seules. Les
  sections « isolées » et « sans compétition » disparaissent. Une compétition seule à une seule épreuve s'affiche sur une
  ligne, comme une épreuve.

**CA-6 — Suppressions et sélection par lot**
- **Étant donné** les suppressions d'US-039 à US-043
- **Quand** un administrateur supprime ou coche des éléments
- **Alors** les types sont manifestation, compétition et épreuve, et « avec son contenu » vaut pour une manifestation ou
  une compétition. Supprimer la dernière épreuve d'une compétition seule supprime aussi la compétition, après le même
  message de confirmation.

**CA-7 — Épreuve dont la compétition a disparu**
- **Étant donné** une épreuve créée hors ligne dans une compétition supprimée entre-temps sur le serveur
- **Quand** le réseau revient
- **Alors** l'épreuve est envoyée et apparaît en tête de la liste sous « Épreuves à rattacher », avec « Sa compétition a
  été supprimée : choisissez-en une autre ». Le bouton ouvre la modification du rattachement (US-027).

## Comportement hors ligne

Décision du 2026-11-08 (réponse 1a) : hors ligne, une épreuve ne se crée **que dans une compétition déjà connue de
l'appareil** (dernière copie de la liste). Créer une compétition, seule ou dans une manifestation, reste en ligne
seulement : « Nécessite une connexion internet ». Le PC pilote continue sans réseau toutes les épreuves qu'il détient.
Testé par un E2E réseau coupé (choix limité aux compétitions de la copie, création de compétition grisée).

## Cas limites et erreurs

- Compétition seule supprimée par un autre administrateur pendant la création de son épreuve : CA-7.
- Épreuve d'une arme différente de celle de la compétition : refus « Cette compétition est au <arme> ».
- Changer une compétition de manifestation : non prévu, comme aujourd'hui (US-024).

## Hypothèses

- Pas de migration (décision du 2026-11-08) : la preview est purgée avant le déploiement, les journaux locaux sont des
  données de test.
- Une compétition seule n'a pas de dates ni de lieu propres : ce sont ceux de ses épreuves.
- CA-7 réutilise la modification du rattachement d'US-027 plutôt qu'un écran dédié.

## Questions bloquantes

- Aucune.

## Notes techniques

- Domaine : `rattachement` de l'épreuve réduit à `competitionId` ; `construireListe`, `analyserSelection` (US-043) et
  les règles « non vide » suivent. Protocole : validation de `competitionId`, `manifestationId` facultatif sur la
  compétition.
- Impacte les US terminées US-023, US-024, US-025, US-026, US-027, US-041, US-042 et US-043 (ligne de suivi ajoutée).

## Suivi

| Date | Événement |
|---|---|
| 2026-11-08 | Créée (analyse d'impact du changement de modèle) |
