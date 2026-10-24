# poulePosition — Exigences

> Ce document décrit le **besoin** (le quoi). L'architecture, le découpage en user stories et les choix d'implémentation (le comment) sont proposés par Claude, puis validés par moi.
>
> Légende des priorités : **P1** = indispensable au lancement · **P2** = important, peu après · **P3** = plus tard / bonus

---

## 1. Contexte

**Cette application permettra d'organiser et de suivre le déroulement d'une compétition d'escrime :**
- Inscription des tireurs / équipes - Feuille de présence, émargement
- Organisation des poules et répartition sur les pistes - Feuilles de score pour les arbitres
- Choix de la formule de la compétition / Tableau final
- Suivi en temps réel des scores et visualisation sur écran géant, saisie par smartphone

**Problème qu'elle résout / ce qui existe aujourd'hui :**
- Elle permettra de fluidifier le déroulement de la compétition
- Il existe une application vieillissante, Belle Poule : http://betton.escrime.free.fr/fencing-tournament-software/fr/bellepoule/index.html
- Une application plus moderne, mais compliquée à déployer, Engarde : https://www.engarde-escrime.com/
  - Sa documentation : https://www.engarde-escrime.com/documentation?lang=fr
- Ces deux logiciels sont des sources d'inspiration (formules, fonctionnement, documents imprimés), pas des applications à copier.

**Ce qui est hors périmètre (ce qu'elle ne fera pas) :**
- Pas de connexion avec des appareils officiels de score

**Prérequis techniques**
- Tous les composants utilisés doivent être gratuits (développement, déploiement, hébergement)
- Utiliser de préférence les briques déjà utilisées (Vercel, GitHub, Cloudflare)
- Application au look moderne et intuitif
- Stack technique reconnue, compatible avec les modes d'hébergement choisis
- Application robuste : en cas de plantage ou de perte de connexion, il faut impérativement pouvoir continuer la compétition
- Possibilité de fonctionner en mode déconnecté : s'il n'y a pas (ou plus) de connexion, il faut pouvoir continuer le déroulé de la compétition en mode offline, avec resynchronisation ensuite (les fonctionnalités nécessitant une connexion sont bien évidemment inaccessibles)

**Scénario de perte totale de connexion**

La compétition est pilotée depuis le PC de l'organisateur. C'est la référence :
en cas de conflit, ses données font foi.

Si ce PC perd internet :
- il continue à fonctionner entièrement en local : saisie des scores, calcul des
  classements de poules, génération du tableau, passage aux tours suivants ;
- l'écran géant peut cesser d'afficher les résultats : c'est accepté
  (si l'affichage peut continuer localement depuis ce PC, c'est un bonus) ;
- les smartphones (arbitres, tireurs) ne doivent plus pouvoir saisir de scores,
  même s'ils ont encore une connexion 4G : seul le PC de l'organisateur fait foi.
  Ils affichent clairement que la saisie est suspendue ;
- l'organisateur imprime depuis le PC, à l'avance ou sur le moment, les feuilles
  de poule, les feuilles de match et le tableau. Les impressions doivent
  fonctionner sans internet ;
- les arbitres rapportent leurs feuilles papier à l'organisateur, qui saisit
  les scores sur le PC ;
- l'organisateur imprime les feuilles des tours suivants et les affiche dans
  la salle, comme avec Belle Poule.

Au retour de la connexion, le PC resynchronise ses données, puis la saisie par
smartphone et l'affichage en direct reprennent.

---

## 2. Utilisateurs et rôles

| Rôle | Qui c'est | Ce qu'il peut faire globalement | Accès sans compte |
|------|-----------|--------------------------------|-------------------|
| Administrateur | Un ou deux gestionnaires du club | Utiliser toute l'application et gérer les comptes utilisateurs | Non |
| Organisateur de la compétition | Maîtres d'armes ou personnes désignées | Créer / lancer les compétitions, modifier les poules, les pistes, les formules | Non |
| Tireur | Les compétiteurs | Saisir leur propre score, ou ceux de leur poule (droits à affiner et paramétrables) | Oui, par QR code |
| Arbitre | Les arbitres de la compétition | Saisir les scores de la compétition, modifier la répartition des pistes (droits à affiner et paramétrables) | Oui, par QR code |
| Spectateur | Spectateurs de la compétition | Suivre le déroulement de la compétition | Oui |

---

## 3. Fonctionnalités

> Une section par fonctionnalité. Écrire avec mes mots, sans chercher à être exhaustif : les cas limites seront complétés lors du découpage en US.
> Les fonctionnalités de la liste en fin de section seront détaillées au fur et à mesure.

### F1 — Authentification et gestion des utilisateurs
- **Priorité :** P1
- **Rôle(s) concerné(s) :** Administrateur
- **Description :** créer des utilisateurs et leur associer un des profils :
  - Administrateur
  - Organisateur

- **Règles métier connues :**
  - Prévoir un système d'authentification robuste
- **Cas particuliers / erreurs auxquels je pense :**
  - IMPORTANT : pouvoir s'authentifier même sans connexion internet
- **Notes libres (idées, exemples, écrans imaginés) :**
  - Si possible et gratuit, un système de mot de passe oublié


### F2 — Création d'une compétition
- **Priorité :** P1
- **Rôle(s) concerné(s) :** Administrateur, Organisateur
- **Description :** pouvoir créer une compétition d'escrime :
  - Nom de la compétition - Exemple : Challenge Orpi 2027
  - Catégorie (facultatif) - Exemple : Vétéran 1
  - Homme / femme (facultatif)
  - Individuelle / par équipe de 2 ou 3
  - Formule - Exemple : poules puis tableau par élimination directe (choix par défaut)
  - Date (facultatif)
  - Lieu (facultatif)
  - Feuille de route (facultatif), fichier PDF
  - Affiche (facultatif)
  - ...

- **Règles métier connues :**
  -
- **Cas particuliers / erreurs auxquels je pense :**
  -
- **Notes libres :**
  - Pour les formules, chercher sur le net et dans la documentation des 2 logiciels mentionnés pour voir et comprendre ce qui existe


### Liste des fonctionnalités à détailler

- **F3 — Inscription des tireurs et des équipes** (saisie manuelle, import) — P1
- **F4 — Émargement** : feuille de présence, pointage des tireurs le jour J — P1
- **F5 — Constitution des poules** : répartition automatique (classement, club), modifiable à la main — P1
- **F6 — Répartition des poules sur les pistes** — P1
- **F7 — Saisie des scores de poule sur le PC de l'organisateur** — P1
- **F8 — Saisie des scores par smartphone** (arbitres, tireurs, accès QR code) — P1
- **F9 — Classement après poules et génération du tableau d'élimination directe** — P1
- **F10 — Déroulement du tableau** : saisie des matchs, tours suivants, classement final — P1
- **F11 — Impressions** : feuilles de présence, de poule, de match, tableau (doit fonctionner hors-ligne) — P1
- **F12 — Mode hors-ligne et resynchronisation** du PC de l'organisateur (voir scénario section 1) — P1
- **F13 — Affichage en direct sur écran géant** — P1
- **F14 — Suivi de la compétition par les spectateurs** sur smartphone — P2
- **F15 — Compétitions par équipes** (rencontres en relais) — P2
- **F16 — Import / export des compétitions** (tireurs, poules, résultats) — P2
- **F17 — Journal des actions** — P2
- **F18 — Carte de localisation de la compétition** — P3

<!-- Pour détailler une fonctionnalité, copier le bloc de F2 -->

---

## 4. Données

**Principales informations manipulées** (en langage courant, pas en tables) :
-

**Données personnelles concernées ?** Oui — lesquelles : nom, prénom, catégorie, club

**Durée de conservation / suppression :** 1 an

**Import / export nécessaires ?** (CSV, PDF, API d'un tiers…)
- Import / export des compétitions (tireurs, poules, résultats)

---

## 5. Exigences techniques

### Imposé (non négociable)
- Code hébergé sur GitHub : poulePosition
- Déploiement sur Vercel
- Tests end-to-end avec Playwright
- Rien de payant

### Préférences (à challenger si une meilleure option existe)
- Langage / framework : à toi de choisir (on peut rester sur celui de Wireless Fencing : vanilla JS + Vite)
- Base de données / persistance : à toi de trouver un système de persistance simple
- Authentification : à toi de choisir quelque chose de simple, permettant de s'authentifier sans connexion internet

### Brique existante à réutiliser
- Le relais WebSocket Cloudflare de Wireless Fencing (Workers + Durable Objects,
  plan gratuit) est le point de départ pour le temps réel entre appareils
  (smartphones de saisie ↔ écran géant ↔ spectateurs). Description complète
  en annexe A.
- Claude évalue dans une ADR ce qui peut être repris tel quel et ce qui doit
  être adapté, notamment : la limite de 16 clients par salle (pic attendu : 150),
  l'absence de persistance, et le comportement en cas de coupure internet.

### Intégrations externes
- E-mails, si un plan gratuit est possible
- Carte pour la localisation de la compétition

### Plateformes cibles
- [x] Desktop
- [x] Mobile web
- [x] PWA installable
- [x] Hors-ligne nécessaire

---

## 6. Exigences non-fonctionnelles

> Des chiffres, même approximatifs : ce sont eux que les tests de charge vérifieront.

| Sujet | Attendu |
|-------|---------|
| Nombre d'utilisateurs authentifiés total | 10 |
| Utilisateurs simultanés au pic | 150 |
| Moments de pic | Compétition (week-end) |
| Taille maximale d'une compétition | ___ tireurs, ___ pistes |
| Délai entre la saisie d'un score et son affichage sur l'écran géant | moins de 2 s |
| Affichage d'une page sur smartphone en 4G | moins de 1 s |
| Disponibilité attendue | Pendant les compétitions, sans interruption ; en dehors, une indisponibilité ponctuelle est acceptable |
| Volume de données à 1 an | 100 Mo |

**Sécurité :**
- Journal des actions

**RGPD :**
- Voir question ouverte sur les données de mineurs (section 9)

**Accessibilité :**
-

**Langues :**
- Français (prévoir la possibilité de traduire)

**Budget d'hébergement mensuel max :**
- 0 €

**Tests de charge :**
- Les prévoir, mais JAMAIS les lancer automatiquement : je veux en découvrir le principe

---

## 7. Qualité, CI/CD et environnements

**Environnements souhaités :**
- [x] Preview par pull request (Vercel)
- [x] Production

**Ce qui doit bloquer une mise en production :**
- [x] Tests unitaires
- [x] Tests E2E Playwright
- [x] Lint / typage
- [x] Couverture de code minimale : à proposer par Claude
- [x] Audit de sécurité des dépendances
- [ ] Tests de charge (sur preview/staging, jamais sur la prod)

**Workflow Git :**
- une branche par US, créée depuis `dev`
- pull request de la branche US vers `dev` → déploiement preview automatique
- quand plusieurs US sont validées : pull request `dev` → `main` → production
- **seul moi merge sur `main`** ; Claude ne merge jamais sur `main`

**Mise en prod :** automatique au merge sur `main`

---

## 8. Définition de « terminé »

Une US est terminée quand :
- [x] ses critères d'acceptation sont tous couverts par des tests
- [x] les tests unitaires et E2E passent en CI
- [x] elle est déployée en preview et vérifiée
- [x] la doc concernée est à jour

---

## 9. Questions ouvertes

> Ce que je n'ai pas encore tranché. Claude ne doit pas le trancher sans me demander.

- **Scores saisis par smartphone juste avant la coupure** : s'ils ne sont pas
  parvenus au PC de l'organisateur, sont-ils perdus (l'arbitre les rapporte
  sur papier) ou récupérés au retour de la connexion ?
- **Authentification hors-ligne** : est-il suffisant de rester connecté hors-ligne sur un
  appareil déjà identifié en ligne auparavant ?
- **Droits des tireurs et arbitres** : qui peut saisir quels scores, modifier quoi ;
  quels droits doivent être paramétrables par l'organisateur.
- **Accès par QR code** : durée de validité, portée (une poule, une piste, toute la
  compétition), révocation.
- **Multi-clubs** : l'application est-elle réservée à mon club, ou d'autres clubs
  pourront-ils l'utiliser avec leurs données isolées ?
- **Données de mineurs** : présence de catégories jeunes → précautions RGPD à prévoir.
- **Environnement de staging** : à ajouter plus tard si le besoin apparaît.

---

## 10. Retour d'expérience Wireless Fencing

**Ce qui a bien marché et que je veux garder :**
- Écriture des US au fil de l'eau, en mode amélioration continue, et classement par Epic

**Ce qui m'a gêné et que je veux éviter :**
- Interaction avec Claude un peu floue : prévoir des commandes personnalisées du type :
  - `debut-spec-US` / `fin-spec-US` : passage en mode écriture de spécifications
  - `debut-impl-US` / `fin-impl-US` (prenant en paramètre la référence d'une US)
- Sur un autre projet, Claude m'a généré des commandes personnalisées : en proposer ici aussi

---

## 11. Ce que j'attends de Claude

À partir de ce document, dans cet ordre, avec ma validation entre chaque étape :

1. **Proposition d'architecture** avec une ADR par décision importante (choix, alternatives
   écartées, raison). Pour chaque service externe, l'ADR vérifie et documente les limites
   du plan gratuit : quotas, mise en veille après inactivité, conditions d'utilisation.
   Les questions ouvertes de la section 9 qui impactent l'architecture me sont posées
   avant toute décision.

2. **Squelette du repo** :
   - structure, `CLAUDE.md` (règles permanentes du projet), dossier de documentation, backlog ;
   - commandes personnalisées Claude Code, au minimum :
     - `/debut-spec-US` et `/fin-spec-US` : passage en mode écriture de spécifications ;
     - `/debut-impl-US <ref>` et `/fin-impl-US <ref>` : implémentation d'une US donnée ;
   - Claude propose d'autres commandes utiles et je choisis lesquelles garder.

3. **Walking skeleton — avant toute fonctionnalité métier.**
   Mettre en place toute la chaîne avec une page minimale (« hello world »).
   L'étape est terminée seulement quand :
   - [ ] le projet tourne en local avec une seule commande documentée
   - [ ] un test unitaire et un test E2E Playwright existent et passent en local
   - [ ] une pull request déclenche la CI : lint, typage, tests unitaires, build, audit des dépendances
   - [ ] la PR produit un déploiement preview Vercel
   - [ ] les tests Playwright tournent en CI contre l'URL de preview
   - [ ] la CI bloque le merge si un test échoue (vérifié en cassant volontairement un test)
   - [ ] le merge sur main déploie en production
   - [ ] un squelette de test de charge existe ; il n'est jamais lancé automatiquement
     et sa première exécution se fait manuellement, avec moi, contre la preview
   - [ ] le README explique comment lancer, tester et déployer

   Aucune US fonctionnelle ne démarre tant que cette liste n'est pas entièrement cochée.

4. **Découpage des fonctionnalités en US fines**, classées par Epic, chacune livrable et
   testable seule, avec critères d'acceptation détaillés (Étant donné / Quand / Alors),
   cas limites et erreurs, US techniques implicites et ordre selon les dépendances.
   Le découpage se fait au fil de l'eau : quand j'ajoute ou modifie une fonctionnalité,
   Claude génère les nouvelles US et signale celles déjà réalisées qui sont impactées.

5. Avec les US, deux listes à me soumettre :
   - **Hypothèses** faites pour combler les trous
   - **Questions bloquantes**

---

## Annexe A — Relais WebSocket de Wireless Fencing

> Description du relais temps réel utilisé dans Wireless Fencing, fournie comme
> point de départ. À adapter selon l'ADR correspondante (voir section 5).
> Code source de référence : `docs/reference/relais-wireless-fencing/`

Relais WebSocket sur Cloudflare (Workers + Durable Objects, plan gratuit)

1. Rôle : il met en relation des navigateurs qui ne peuvent pas se joindre directement. Ici, une app web statique sans backend (hébergée sur Vercel) et des smartphones (télécommande, téléphones de saisie). Il ne fait que relayer des messages JSON. Il n'a ni base de données, ni secret, ni compte utilisateur, et il ne garde rien au-delà de la vie d'une salle.
2. Services Cloudflare : un Worker, qui gère les routes HTTP/WebSocket, vérifie l'origine, attribue un code libre et refuse les connexions invalides. Il s'appuie sur deux classes de Durable Objects : Salle, une instance par code à 4 chiffres (idFromName(code)), qui tient les WebSockets et transmet les messages, et Limiteur, une instance par adresse IP, qui compte les codes erronés pour bloquer les essais au hasard. Il n'y a ni Tunnel, ni KV, ni D1.
3. Qui parle à qui : l'hôte (l'écran principal) ouvre wss://…/salles et reçoit un code dans le message bienvenue. Il affiche ce code ou un QR code. Les clients (smartphones, jusqu'à 16 par salle) rejoignent wss://…/salles/<code>/…. L'hôte envoie son état, les clients envoient des commandes, et le relais filtre et route les messages entre eux. Les messages sont limités à 16 Ko.
4. Plan : Workers Free, sans moyen de paiement ni nom de domaine (adresse *.workers.dev). Ce plan n'accepte que les Durable Objects à stockage SQLite (new_sqlite_classes dans wrangler.toml). Les WebSockets en hibernation permettent qu'une salle inactive ne consomme rien et que les ping ne la réveillent pas. Au-delà des quotas quotidiens, les requêtes sont refusées sans facturation.
5. Pour le réutiliser : copier relais/, qui est un projet indépendant (seulement wrangler et vitest), et adapter ORIGINES dans wrangler.toml, qui liste les origines autorisées avec des motifs *. Déployer ensuite avec npx wrangler deploy et donner l'adresse wss:// à l'app par une variable de build (VITE_URL_RELAIS). Le protocole est décrit dans docs/TELECOMMANDE.md et la mise en place pas à pas dans relais/README.md.
