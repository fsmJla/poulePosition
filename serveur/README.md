# serveur — Worker Cloudflare + Durable Objects

Issu du relais Wireless Fencing (`docs/reference/relais-wireless-fencing/`), porté en TypeScript et adapté
selon l'ADR-0004 :
- DO `Competition` : WebSockets en hibernation, copie du journal, vues, boîte des saisies, fichiers ;
- DO `Club` : comptes et index des compétitions ;
- DO `Limiteur` : limite des essais par IP (repris tel quel).

**Aucune logique métier d'escrime** : le serveur authentifie, route, stocke et diffuse.
Workers : `poule-position-serveur-preview` (branche `dev`) et `poule-position-serveur` (branche `main`).

Commandes (depuis la racine) : `npm run dev -w serveur` (port 8790), `npm run deploy:preview -w serveur`,
`npm run deploy -w serveur`. Tests : `npx vitest run --project serveur` (intégration dans workerd).

Secrets Wrangler (par environnement, voir le README racine) : `POIVRE`, `SECRET_INSTALLATION` et `SECRET_SESSION`.
Routes : `docs/protocole.md` (connexion et session : §7).
