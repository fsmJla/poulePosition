# US-047 — Créer une manifestation avec un assistant

- **Epic :** E2 — Compétitions
- **Fonctionnalité :** F2 (exigences §3)
- **Priorité :** P1
- **Type :** fonctionnelle
- **Statut :** En cours
- **Dépend de :** US-048, US-049
- **Branche / PR :** `us/US-047-assistant-manifestation` / —

## Récit

**En tant qu'**organisateur, **je veux** être guidé pas à pas pour créer une manifestation, ses compétitions puis leurs
épreuves, en voyant la structure se construire, **afin de** monter tout un week-end sans me demander par quoi commencer.

Maquette : écran 3 « Assistant de manifestation » : https://claude.ai/artifact/Pzn3RPYfvQkfWLDPjMPknZ

## Critères d'acceptation

**CA-1 — Quatre étapes**
- **Étant donné** un organisateur en ligne qui choisit « Une manifestation »
- **Quand** l'assistant s'ouvre
- **Alors** il montre les étapes Manifestation (nom, jours, lieu), Compétitions (nom, arme, jours), Épreuves (grille
  d'US-048 pour chaque compétition) et Vérifier, avec l'étape en cours mise en avant et les étapes faites cochées.

**CA-2 — Aperçu en direct**
- **Étant donné** une étape de l'assistant
- **Quand** l'organisateur saisit ou ajoute quelque chose
- **Alors** l'aperçu à droite se met à jour : le cadre de la manifestation, ses compétitions avec le nombre de leurs
  épreuves, et celle en cours de saisie en pointillés. Il a la même forme que le plan (US-049).

**CA-3 — Chaque étape est enregistrée**
- **Étant donné** l'étape Manifestation validée
- **Quand** l'organisateur passe à l'étape suivante
- **Alors** la manifestation est créée sur le serveur (US-023) ; de même chaque compétition ajoutée à l'étape 2 et
  chaque lot d'épreuves de l'étape 3. Quitter l'assistant ne perd rien : la manifestation se retrouve dans la liste et
  se complète depuis son plan.

**CA-4 — Étapes facultatives**
- **Étant donné** l'étape Compétitions ou Épreuves
- **Quand** l'organisateur choisit « Plus tard »
- **Alors** il passe à l'étape suivante sans rien créer. Une manifestation peut se terminer sans compétition.

**CA-5 — Vérifier**
- **Étant donné** la dernière étape
- **Quand** elle s'affiche
- **Alors** elle montre le plan de la manifestation (US-049) en lecture, avec le nombre de compétitions et d'épreuves
  créées, et le bouton « Terminer » ouvre ce plan.

**CA-6 — Revenir en arrière**
- **Étant donné** une étape après la première
- **Quand** l'organisateur clique « Précédent »
- **Alors** il revoit l'étape précédente avec ce qu'il a créé, modifiable (modification d'US-023 et d'US-024).

## Comportement hors ligne

L'assistant demande le réseau (une manifestation et une compétition se créent en ligne, US-045) : hors ligne, son
entrée est grisée avec « Nécessite une connexion internet ». Si le réseau tombe pendant l'assistant, l'étape en cours
affiche « Réseau perdu : ce qui est déjà créé est gardé » et l'organisateur pourra reprendre depuis le plan. L'étape
Épreuves continue hors ligne (US-048). Testé par un E2E réseau coupé en cours d'assistant.

## Cas limites et erreurs

- Erreur de validation à une étape (dates incohérentes, nom vide) : l'étape ne se valide pas, avec les messages
  d'US-023 et d'US-024.
- Deux organisateurs modifient la même manifestation : contrôle de version d'US-023 (« modifiée entre-temps »).

## Hypothèses

- L'assistant enchaîne les écrans existants (formulaires d'US-023, US-024, grille d'US-048, plan d'US-049) plutôt que
  d'en dupliquer la logique.
- Pas de brouillon local : ce qui est validé est créé, ce qui ne l'est pas est perdu en quittant.

## Questions bloquantes

- Aucune.

## Notes techniques

- Les étapes sont une machine d'état pure dans `paquets/domaine` (étape courante, étapes faites, transitions) ; l'écran
  ne fait qu'afficher.

## Suivi

| Date | Événement |
|---|---|
| 2026-11-08 | Créée (maquette d'ergonomie de création) |
