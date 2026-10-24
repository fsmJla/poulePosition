---
description: Compare la consommation Cloudflare / Vercel / GitHub Actions aux limites gratuites
---

Fais le point sur la consommation des services gratuits, **en lecture seule**.

1. Relis les limites documentées dans les ADR : 0004 (Cloudflare), 0008 (Vercel), 0012 (GitHub Actions) et 0013
   si des intégrations sont actives.
2. Collecte la consommation réelle avec les moyens disponibles :
   - **Vercel** : outils Vercel MCP s'ils sont connectés (transfert de données, déploiements), sinon le chemin du
     tableau de bord (*Usage*) ;
   - **Cloudflare** : `npx wrangler` depuis `serveur/` si l'utilisateur est connecté, sinon le tableau de bord
     (*Workers & Pages* → *Metrics*, *Durable Objects*) : requêtes par jour, durée DO, lignes SQLite lues et écrites,
     stockage ;
   - **GitHub Actions** : minutes consommées ce mois-ci (paramètres du compte → *Billing*), le dépôt étant privé
     (2 000 min par mois).
3. Présente un tableau *ressource / limite gratuite / consommation / % / tendance*. Signale tout ce qui dépasse
   50 % d'une limite journalière un jour de compétition, ou 70 % d'une limite mensuelle.
4. Si une limite semble avoir changé depuis l'ADR, vérifie-la sur la documentation officielle et propose une
   ADR de mise à jour (`/adr`).
