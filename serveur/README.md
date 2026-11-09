# serveur — Worker Cloudflare + Durable Objects

Issu du relais Wireless Fencing (`docs/reference/relais-wireless-fencing/`), porté en TypeScript et adapté
selon l'ADR-0004 :
- DO `Epreuve` : WebSockets en hibernation, copie du journal, vues, boîte des saisies, fichiers ;
- DO `Club` : comptes et index des épreuves ;
- DO `Limiteur` : limite des essais par IP (repris tel quel).

**Aucune logique métier d'escrime** : le serveur authentifie, route, stocke et diffuse.
Workers : `poule-position-serveur-preview` (branche `dev`) et `poule-position-serveur` (branche `main`).

Commandes (depuis la racine) : `npm run dev -w serveur` (port 8790), `npm run deploy:preview -w serveur`,
`npm run deploy -w serveur`. Tests : `npx vitest run --project serveur` (intégration dans workerd).

Secrets Wrangler (par environnement, voir le README racine) : `POIVRE`, `SECRET_INSTALLATION`, `SECRET_SESSION`, et
`SMTP_UTILISATEUR` / `SMTP_MOT_DE_PASSE` pour l'envoi d'e-mails (ADR-0015 ; module `courriel.ts`, transport `smtp.ts`).
Routes : `docs/protocole.md` (connexion et session : §7 ; mot de passe oublié : §8 ter). Variable `URL_APPLICATION` :
adresse de l'application de production, pour les liens envoyés par e-mail.
