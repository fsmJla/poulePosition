# Documentation de poulePosition

| Document | Rôle | Qui l'écrit |
|---|---|---|
| [exigences.md](exigences.md) | Le besoin : fonctionnalités, contraintes, questions ouvertes | L'utilisateur |
| [architecture.md](architecture.md) | Vue d'ensemble de l'architecture | Claude, validée par l'utilisateur |
| [adr/](adr/README.md) | Décisions d'architecture, une par fichier | Claude (`/adr`), validées par l'utilisateur |
| [backlog/](backlog/README.md) | Epics et user stories, avec statut | Claude (`/debut-spec-US`, `/impact`, `/bug`) |
| [glossaire.md](glossaire.md) | Vocabulaire métier commun au code et aux docs | Claude et l'utilisateur |
| [reference/](reference/) | Code et docs de référence venus d'autres projets (lecture seule) | — |

À venir avec US-001 (walking skeleton) :

- `protocole.md` : les messages échangés entre l'app et le serveur, sur le modèle de
  `reference/relais-wireless-fencing/TELECOMMANDE.md` ;
- `recette.md` : les scénarios de vérification manuelle et la procédure de test de charge.
