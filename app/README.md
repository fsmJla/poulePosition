# app — application PWA

Svelte 5 + Vite + TypeScript (ADR-0002). Un seul build pour quatre usages, selon la route :
- **pilote** : le PC de l'organisateur, qui détient le journal, fait le calcul métier et les impressions ;
- **saisie** : smartphones des arbitres et des tireurs, par QR code (ADR-0007) ;
- **ecran** : écran géant, distant ou fenêtre locale (ADR-0010) ;
- **spectateur** : suivi public en lecture seule.

Persistance locale : IndexedDB (Dexie, ADR-0003). Aucune règle métier ici : elles sont dans `paquets/domaine`.

*Contenu créé par US-001 (walking skeleton).*
