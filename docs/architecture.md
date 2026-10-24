# poulePosition — Architecture

> Statut : **acceptée le 2026-10-24**. Chaque choix est détaillé dans une ADR (`docs/adr/`).
> Réponses aux questions ouvertes (section 9 des exigences) prises en compte, données le 2026-10-24 :
>
> | Question | Réponse |
> |---|---|
> | Scores smartphone non parvenus avant la coupure | **Récupérés automatiquement** au retour ; si le match a déjà un score, le PC fait foi |
> | Authentification hors ligne | **Appareil déjà identifié en ligne** + mot de passe vérifiable localement |
> | Multi-clubs | **Mon club**, données préparées pour plusieurs clubs (identifiant de club partout) |
> | Taille maximale | **~200 tireurs, ~20 pistes** |
> | Portée du QR code | **Toute la compétition**, révocable |
> | Droits par défaut | **Arbitres et tireurs saisissent** (paramétrable par compétition) |
> | Mineurs | **Pas de traitement spécifique** (purge à 1 an pour tous) |
> | Staging | Non pour l'instant |
>
> Décisions prises à la validation (2026-10-24) : le dépôt GitHub **reste privé**, donc il n'y a pas de
> blocage technique du merge (ADR-0012). L'usage reste **non commercial**, sans paiement ni sponsor
> (ADR-0008). L'option « Prénom N. » (ADR-0014) et le domaine `pessac-escrime.fr` pour de futurs
> e-mails (ADR-0013) sont **conservés**.

## 1. Principe directeur

**Le PC de l'organisateur est la source de vérité et fonctionne seul.** Tout le métier (poules, classements,
tableau, impressions) s'exécute dans le navigateur de ce PC, sur des données stockées localement. Internet
n'apporte que le **partage** : saisie par smartphone, écran géant distant, spectateurs, sauvegarde distante.
Une perte de connexion ne fait donc perdre que ces fonctions de partage (ADR-0001).

## 2. Vue d'ensemble

```
                         ┌──────────────────────────── Vercel (Hobby) ───────────────────────────┐
                         │  Application statique PWA : Svelte 5 + Vite + TypeScript (ADR-0002/08) │
                         └───────────────▲───────────────────────▲──────────────────▲────────────┘
                                         │ téléchargement initial, puis cache Service Worker
                                         │                       │                  │
 ┌───────────── PC organisateur (pilote) ┴──┐      ┌─────────────┴───────┐  ┌───────┴─────────────┐
 │  Domaine métier (TS pur)                 │      │ Smartphones saisie   │  │ Écran géant /       │
 │  Journal d'événements → IndexedDB        │      │ (QR arbitre/tireur)  │  │ spectateurs         │
 │  Impressions HTML/CSS (hors ligne)       │      │ file d'attente locale│  │ (lecture seule)     │
 │  Fenêtre « écran géant » locale ─────────┼──┐   └──────────▲───────────┘  └───────▲─────────────┘
 └──────────────────▲───────────────────────┘  │ BroadcastChannel (hors ligne, ADR-0010)
                    │ WebSocket (pilote, jeton de session)          │ WebSocket (jeton QR)   │ WebSocket (public)
                    │                                               │                        │
 ┌──────────────────┴──────── Cloudflare Workers Free (ADR-0004) ───┴────────────────────────┴───────┐
 │  Worker : routes HTTP/WS, origines, authentification (ADR-0006), limiteur d'essais                 │
 │  DO « Competition » (1 par compétition, SQLite) : copie du journal, dernières vues publiées,       │
 │      boîte de saisies en attente, fichiers joints, WebSockets en hibernation (≤ 300 clients)       │
 │  DO « Club » (1 par club, SQLite) : comptes, index des compétitions                                │
 │  DO « Limiteur » (1 par IP) : repris tel quel du relais                                            │
 └────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

## 3. Flux principaux

**Saisie d'un score par smartphone (en ligne)**
1. Le téléphone envoie une `saisie` avec un identifiant unique (UUID) et la garde « en attente ».
2. Le DO vérifie le jeton QR et la présence du pilote, enregistre la saisie dans sa boîte et la transmet au PC.
3. Le PC valide (droits, cohérence), l'applique comme événement du journal, puis répond `accuse` (accepté / refusé).
4. Le DO retire la saisie de sa boîte et transmet l'accusé au téléphone. Le PC publie les nouvelles vues ;
   le DO les diffuse à l'écran géant et aux spectateurs (objectif : < 2 s de bout en bout).

**Coupure internet du PC** (ADR-0005)
- Le PC continue seul (saisie au clavier, impressions, tours suivants).
- Le DO détecte l'absence du pilote, prévient les téléphones (« saisie suspendue ») et refuse les nouvelles saisies.
- Les saisies reçues mais pas encore accusées restent dans la boîte du DO et sur les téléphones (même UUID).
- Au retour : le PC renvoie au DO les événements manquants, récupère la boîte, applique automatiquement les
  saisies dont le match n'a pas encore de score (sinon : rejet journalisé, le PC fait foi), republie les vues ;
  la saisie par smartphone reprend.

## 4. Organisation du code (ADR-0012)

```
poulePosition/
├─ app/                 PWA (Svelte) — PC organisateur, smartphones, écran géant, spectateurs
├─ serveur/             Worker + Durable Objects (issu de relais/ de Wireless Fencing)
├─ paquets/
│  ├─ domaine/          règles métier pures : poules, classements, tableau, formules (TS, sans dépendance)
│  └─ protocole/        types et validation des messages échangés (partagés app ↔ serveur)
├─ tests/e2e/           Playwright
├─ tests/charge/        k6 (jamais lancé automatiquement)
└─ docs/                exigences, architecture, ADR, backlog
```

## 5. Budget gratuit : marge estimée pour un jour de compétition

Hypothèse : 150 clients connectés 10 h, 200 tireurs, ~1 500 matchs saisis, ping applicatif toutes les 30 s.

| Ressource (Cloudflare Workers Free, par jour) | Quota | Estimation | Marge |
|---|---|---|---|
| Requêtes Workers + DO | 100 000 | connexions ~1 000 + messages entrants /20 ≈ 10 000 | ×10 |
| Durée DO | 13 000 Go·s | DO réveillé ~10 h × 128 Mo ≈ 4 600 Go·s (pire cas) | ×2,8 |
| Lignes SQLite écrites | 100 000 | événements + saisies + vues ≈ 10 000 | ×10 |
| Stockage SQLite (compte) | 5 Go | objectif 100 Mo à 1 an | ×50 |

Le point le plus serré est la durée DO **si** le DO ne s'endort jamais. Les pings sont traités par réponse
automatique (pas de réveil), ce qui laisse en pratique une marge bien supérieure. Le test de charge k6
(manuel) servira à le vérifier.
