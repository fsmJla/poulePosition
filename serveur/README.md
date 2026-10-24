# serveur — Worker Cloudflare + Durable Objects

Issu du relais Wireless Fencing (`docs/reference/relais-wireless-fencing/`), porté en TypeScript et adapté
selon l'ADR-0004 :
- DO `Competition` : WebSockets en hibernation, copie du journal, vues, boîte des saisies, fichiers ;
- DO `Club` : comptes et index des compétitions ;
- DO `Limiteur` : limite des essais par IP (repris tel quel).

**Aucune logique métier d'escrime** : le serveur authentifie, route, stocke et diffuse.
Workers : `poule-position-serveur-preview` (branche `dev`) et `poule-position-serveur` (branche `main`).

*Contenu créé par US-001 (walking skeleton).*
