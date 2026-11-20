# US-116 — Séparer les tireurs d'un même club au premier tour du tableau (P2)

- **Epic :** E6 — Tableau
- **Fonctionnalité :** F9 (exigences §3)
- **Priorité :** P2
- **Type :** fonctionnelle
- **Statut :** À spécifier
- **Dépend de :** US-109
- **Branche / PR :** —

## Récit

**En tant qu'**organisateur, **je veux** pouvoir éviter que deux tireurs d'un même club se rencontrent au premier tour
du tableau, **afin de** respecter l'usage de certaines compétitions régionales.

Maquette : à définir (option dans l'aperçu d'US-109 ou dans la page « Formule »).

## Critères d'acceptation

À écrire une fois les règles précisées (voir Questions bloquantes).

## Comportement hors ligne

Calcul local sur le PC pilote, comme la création du tableau (US-109).

## Cas limites et erreurs

- Séparation impossible (un club majoritaire) : le tableau reste celui de la FIE pour les rencontres restantes.

## Hypothèses

- Option désactivée par défaut ; en P1, le placement suit strictement l'ordre de la FIE (choix de l'utilisateur,
  2026-11-20).

## Questions bloquantes

- Règle d'échange : avec quel tireur échanger (rang voisin, même groupe de têtes de série), et jusqu'à quel tour ?
  À reprendre de la documentation d'Engarde (https://www.engarde-escrime.com/documentation?lang=fr).
- Où se règle l'option : formule de l'épreuve ou au moment de créer le tableau ?

## Notes techniques

- Le placement modifié doit être porté par `TableauCree` (US-108), comme l'ordre des ex aequo.

## Suivi

| Date | Événement |
|---|---|
| 2026-11-20 | Créée (spécification de l'Epic 6), en attente de règles |
