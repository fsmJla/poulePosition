# US-148 — Émarger une épreuve par équipes

- **Epic :** E10 — Équipes
- **Fonctionnalité :** F4, F15 (exigences §3)
- **Priorité :** P2
- **Type :** fonctionnelle
- **Statut :** Prête
- **Dépend de :** US-146, US-084
- **Branche / PR :** — (renseignés par `/debut-impl-US` et `/fin-impl-US`)

## Récit

**En tant qu'**organisateur, **je veux** pointer les tireurs présents et voir d'un coup d'œil quelles équipes sont
complètes, **afin de** ne lancer que des équipes en état de tirer.

Maquette : planche 41 « Émargement par équipes » (à dessiner et à faire valider avant l'implémentation), variante de la
planche 19 : les tireurs groupés par équipe.

## Critères d'acceptation

**CA-1 — Pointage par équipe**
- **Étant donné** une épreuve par équipes
- **Quand** l'organisateur ouvre l'émargement
- **Alors** les tireurs sont groupés sous leur équipe (titulaires puis remplaçant), chacun pointable comme en
  individuel (US-084) ; le compteur dit « 5 équipes complètes sur 6 ».

**CA-2 — Équipe complète ou incomplète**
- **Étant donné** une équipe
- **Quand** ses tireurs sont pointés
- **Alors** elle est « Complète » si elle a au moins 2 (équipes de 2) ou 3 (équipes de 3) tireurs présents, remplaçant
  compris, sinon « Incomplète · 2 présents sur 3 » (Triangle d'alerte).

**CA-3 — Remplaçant titularisé**
- **Étant donné** un titulaire absent et le remplaçant présent
- **Quand** l'équipe est complète grâce à lui
- **Alors** la ligne de l'équipe l'indique (« avec remplaçant »), sans changer la composition enregistrée.

**CA-4 — Incomplète au lancement**
- **Étant donné** une équipe incomplète
- **Quand** l'organisateur passe à l'étape suivante (« Constituer les poules » ou « Créer le tableau »)
- **Alors** une confirmation la liste (« 1 équipe incomplète ne tirera pas : Talence 2 ») ; confirmée, l'équipe est
  laissée de côté, comme un tireur absent en individuel.

## Comportement hors ligne

Comme l'émargement individuel (US-084) : sans réseau, sur le PC pilote.

## Cas limites et erreurs

- Tireurs sans équipe : listés à part, « ne tireront pas ».
- Aucune équipe complète : l'étape suivante est désactivée avec son motif.

## Hypothèses

- La présence reste enregistrée par tireur (`PresenceModifiee`), l'état de l'équipe est calculé.

## Questions bloquantes

- Aucune.

## Notes techniques

- Impacts : US-084 (écran d'émargement), US-086 et US-109 (participants présents = équipes complètes).

## Suivi

| Date | Événement |
|---|---|
| 2026-11-22 | Créée (spécification de l'Epic 10) |
