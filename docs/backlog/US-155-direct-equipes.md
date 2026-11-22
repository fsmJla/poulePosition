# US-155 — Afficher les épreuves par équipes sur l'écran géant et pour les spectateurs

- **Epic :** E10 — Équipes
- **Fonctionnalité :** F13, F14, F15 (exigences §3)
- **Priorité :** P2
- **Type :** fonctionnelle
- **Statut :** Terminée
- **Dépend de :** US-150, US-151, US-132 à US-143
- **Branche / PR :** `us/US-145-equipes` (série E10, une seule PR)

## Récit

**En tant que** spectateur, **je veux** suivre une épreuve par équipes sur l'écran géant et sur mon smartphone,
**afin de** voir les rencontres, les poules et le tableau des équipes comme en individuel.

Maquette : planches 31 à 39 et captures de référence de l'Epic 9 (`docs/maquettes/direct/`), avec des noms d'équipes ;
écart déclaré dans les Hypothèses.

## Critères d'acceptation

**CA-1 — Vue en direct**
- **Étant donné** une épreuve par équipes publiée
- **Quand** le pilote publie la vue en direct (US-132)
- **Alors** elle porte les équipes (nom, club ou « Mixte », tireurs au nom affiché selon « Prénom N. ») et leurs
  rencontres, à la place des tireurs et des matchs.

**CA-2 — Écran géant**
- **Étant donné** un écran qui affiche l'épreuve
- **Quand** les pages défilent
- **Alors** l'appel montre les rencontres par piste (« Pessac 1 – Talence 2 »), les poules et le tableau en arbre
  montrent les équipes et le score final des rencontres (« 45 – 38 »), le bandeau des derniers scores aussi, et le podium
  et le classement final affichent les équipes.

**CA-3 — Spectateur**
- **Étant donné** la page spectateur de l'épreuve (US-137)
- **Quand** un spectateur la consulte
- **Alors** il voit les mêmes onglets avec des équipes ; « Suivre » s'applique à une équipe (US-138) et met en avant
  ses rencontres.

## Comportement hors ligne

Comme l'Epic 9 : l'écran géant et les spectateurs gardent la dernière vue reçue et l'heure de mise à jour ; la fenêtre
locale du PC pilote reste à jour sans réseau.

## Cas limites et erreurs

- Nom d'équipe long : coupé avec « … » (nom complet en infobulle), comme les noms de tireurs.

## Hypothèses

- Pas de nouvelle planche : les pages de l'Epic 9 affichent des équipes à la place des tireurs.
- Pas de détail des relais à l'écran (le score n'est saisi qu'en final).

## Questions bloquantes

- Aucune.

## Notes techniques

- `VueDirect` gagne les équipes ; validation dans `paquets/protocole` (le serveur valide la vue, à redéployer).
- Impacts : US-132, US-134, US-137, US-138, US-141, US-142, US-143.

## Suivi

| Date | Événement |
|---|---|
| 2026-11-22 | Créée (spécification de l'Epic 10) |
| 2026-11-22 | Implémentée sur `us/US-145-equipes` (série E10, PR unique) ; en attente de la recette groupée |
| 2026-11-22 | Recette OK par l'utilisateur sur la preview de la PR #183 ; mergée dans `dev` |
