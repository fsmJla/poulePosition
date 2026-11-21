# Décisions d'architecture (ADR)

Une ADR par décision importante : contexte, décision, alternatives écartées, conséquences.
Pour chaque service externe, l'ADR documente les limites du plan gratuit (vérifiées le 2026-10-24).

Statuts : **Proposée** → **Acceptée** (après validation) → éventuellement **Remplacée par ADR-XXXX**.
Une ADR acceptée ne se modifie pas : on en écrit une nouvelle qui la remplace.

Vue d'ensemble : [`../architecture.md`](../architecture.md).

| N° | Décision | Statut |
|----|----------|--------|
| [0001](0001-local-first-pc-organisateur.md) | Local-first : le PC de l'organisateur est la source de vérité, journal d'événements | Acceptée |
| [0002](0002-front-svelte-vite-typescript-pwa.md) | Front : Svelte 5 + Vite + TypeScript, PWA | Acceptée |
| [0003](0003-persistance-locale-indexeddb.md) | Persistance locale : IndexedDB (Dexie) et sauvegarde fichier | Acceptée |
| [0004](0004-serveur-cloudflare-relais-adapte.md) | Serveur : Cloudflare Worker + Durable Objects, à partir du relais Wireless Fencing | Acceptée |
| [0005](0005-synchronisation-et-saisies-smartphone.md) | Synchronisation PC ↔ serveur et saisies smartphone | Acceptée |
| [0006](0006-authentification.md) | Authentification (comptes, hors ligne, mot de passe oublié) | Acceptée |
| [0007](0007-acces-qr-code-et-droits.md) | Accès par QR code et droits des arbitres / tireurs / spectateurs | Acceptée |
| [0008](0008-hebergement-vercel-hobby.md) | Hébergement de l'application sur Vercel Hobby | Acceptée |
| [0009](0009-impressions-hors-ligne.md) | Impressions hors ligne en HTML/CSS | Acceptée |
| [0010](0010-ecran-geant.md) | Écran géant : en ligne via le serveur, hors ligne via une fenêtre locale | Acceptée |
| [0011](0011-fichiers-joints.md) | Fichiers joints (feuille de route, affiche) dans les Durable Objects | Acceptée |
| [0012](0012-monorepo-qualite-ci.md) | Monorepo, qualité et CI/CD (GitHub Actions, Vitest, Playwright, k6) | Acceptée |
| [0013](0013-integrations-email-carte.md) | Intégrations externes : e-mail et carte | Acceptée ; partie e-mail remplacée par ADR-0015 |
| [0014](0014-donnees-personnelles-multi-clubs.md) | Données personnelles, conservation, préparation multi-clubs | Acceptée |
| [0015](0015-envoi-emails-smtp-ovh.md) | Envoi d'e-mails par le SMTP OVH du club (remplace la partie e-mail de l'ADR-0013) | Acceptée |
| [0016](0016-replication-index-pilote.md) | Réplication du journal par HTTP, pilote identifié par son appareil, index des compétitions dans le DO `Club` | Acceptée |
| [0017](0017-prise-de-main-et-presence-du-pilote.md) | Prise de main par HTTP et présence du pilote par battements (provisoire, en attendant la WebSocket) | Acceptée |
| [0018](0018-economie-minutes-ci.md) | Économie des minutes de CI : E2E de la preview choisis selon le commit | Acceptée |
| [0019](0019-suppression-definitive-pierres-tombales.md) | Suppression définitive d'une compétition et pierres tombales | Acceptée |
| [0020](0020-suppression-avec-contenu-par-morceaux.md) | Suppression d'une épreuve ou d'une manifestation avec son contenu, par morceaux | Acceptée |
| [0021](0021-inversion-vocabulaire-competition-epreuve.md) | Inversion du vocabulaire : la compétition regroupe des épreuves (les ADR 0005, 0007, 0010, 0011, 0016, 0019 et 0020 se lisent avec le nouveau sens) | Acceptée |
| [0022](0022-fichiers-joints-dans-le-do-club.md) | Fichiers joints dans le DO `Club`, nom à empreinte et lecture publique (complète les ADR 0011 et 0016) | Acceptée |
| [0023](0023-deux-niveaux-e2e-interface-et-reel.md) | Deux niveaux de E2E : « interface » en local, « réel » sur Cloudflare (remplace la règle 2 de l'ADR-0018) | Acceptée |
| [0025](0025-recherche-adresse-geoplateforme.md) | Recherche d'adresse : service de géocodage de la Géoplateforme (IGN), complète l'ADR-0013 | Proposée |
| [0026](0026-pdfjs-apercu-feuille-de-route.md) | pdf.js (Apache-2.0, chargé à la demande, hors précache) pour l'aperçu de la feuille de route, complète l'ADR-0022 | Proposée |
| [0027](0027-exceptions-datees-audit-dependances.md) | Exceptions ciblées et datées à l'audit des dépendances (complète l'ADR-0012) | Acceptée |
| [0028](0028-websocket-du-pilote-par-ticket.md) | WebSocket du pilote authentifiée par un ticket de 60 s ; fin des battements (complète les ADR 0005 et 0017) | Proposée |
| [0029](0029-vue-en-direct-ecrans-spectateurs.md) | Vue en direct publiée par le pilote ; lecteurs spectateurs (publiques) et écrans (lien secret, ticket de 60 s, réglages dans le DO `Club`) (complète les ADR 0005, 0007, 0010 et 0028) | Acceptée |
