# US-114 — Tirer le match pour la 3e place

- **Epic :** E6 — Tableau
- **Fonctionnalité :** F10 (exigences §3), US-028 CA-5
- **Priorité :** P1
- **Type :** fonctionnelle
- **Statut :** En revue
- **Dépend de :** US-111, US-112, US-028
- **Branche / PR :** `us/US-114-match-troisieme-place`

## Récit

**En tant qu'**organisateur, **je veux** que le match pour la 3e place apparaisse dans le tableau quand la formule le
prévoit, même si je l'active tard, **afin de** départager les perdants des demi-finales.

Maquette : planche 11 (`docs/maquettes/deroule/11-tableau.png`), sous-titre « pas de match pour la 3e place » ; le
match lui-même n'est pas dessiné (voir Hypothèses).

## Critères d'acceptation

**CA-1 — Sous-titre**
- **Étant donné** un tableau
- **Quand** l'étape s'affiche
- **Alors** le sous-titre porte « match pour la 3e place » ou « pas de match pour la 3e place » selon la formule.

**CA-2 — Le match dans le tableau**
- **Étant donné** une formule avec match pour la 3e place
- **Quand** le tableau s'affiche
- **Alors** une pilule « 3e place » suit « Finale », et l'arbre montre le match sous la finale (« Perdant de la demie 1 »
  contre « Perdant de la demie 2 », « En attente » tant que les demies ne sont pas réglées).

**CA-3 — Appeler et saisir**
- **Étant donné** les deux demies réglées
- **Quand** l'organisateur choisit le match « 3e place »
- **Alors** il s'appelle (US-112), se saisit et se corrige (US-111) et accepte un retrait (US-113) comme les autres.

**CA-4 — Activé tard**
- **Étant donné** une finale déjà réglée et une épreuve pas encore terminée
- **Quand** l'organisateur active le match pour la 3e place (page « Formule », US-028)
- **Alors** le match apparaît, à tirer, et l'épreuve ne peut se terminer qu'une fois ce match réglé.

**CA-5 — Désactivé**
- **Étant donné** un match pour la 3e place pas encore réglé
- **Quand** l'organisateur désactive l'option dans la formule
- **Alors** le match disparaît et les deux perdants des demies redeviennent 3es ex aequo ; s'il est réglé, la page
  « Formule » refuse avec « Le match pour la 3e place est déjà tiré ».

## Comportement hors ligne

Disponible sur le PC pilote sans réseau (journal local).

## Cas limites et erreurs

- Tableau de 2 (finale seule) : pas de demi-finale, l'option est sans effet ; la page « Formule » l'indique.
- Retrait dans une demie : le perdant (retiré pour abandon ou forfait) est forfait pour la 3e place ; exclu, il ne la
  tire pas et son adversaire est 3e.

## Hypothèses

- **Écart validé par l'utilisateur le 2026-11-20 :** la planche 11 ne dessine pas ce match ; il se place sous la finale, dans la dernière colonne de
  l'arbre, avec le même gabarit de match.
- Le perdant d'une demie retiré pour abandon ou forfait déclare forfait pour la 3e place (Hypothèse à vérifier dans le
  règlement de la FIE).

- Implémentation (2026-11-20) : la pilule « 3e place » porte « 0/1 » puis « terminé » ; le match s'affiche sous la finale,
  titré « Match pour la 3e place ». Le cas limite du tableau de 2 (option sans effet) n'est pas encore annoncé sur la page
  « Formule » : la règle du domaine l'ignore simplement (pas de demi-finale, pas de match).

## Questions bloquantes

Aucune.

## Notes techniques

- US-028 : brancher la règle de CA-5 (« possible tant que l'épreuve n'est pas terminée ») et le refus de la
  désactivation d'un match réglé (`TROISIEME_PLACE_REGLEE`, US-108 CA-9).

## Suivi

| Date | Événement |
|---|---|
| 2026-11-20 | Créée (spécification de l'Epic 6) ; hypothèses et écarts validés par l'utilisateur, passe à Prête |
| 2026-11-20 | Implémentée : pilule et match sous la finale, refus de le retirer une fois tiré ; passe En revue |
