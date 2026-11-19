# US-096 — Afficher, imprimer et régénérer les QR codes des arbitres et des tireurs

- **Epic :** E5 — Saisie smartphone
- **Fonctionnalité :** F8 (exigences §3)
- **Priorité :** P1
- **Type :** fonctionnelle
- **Statut :** En revue
- **Dépend de :** US-094, US-032
- **Branche / PR :** `us/US-096-qr-codes-arbitres-tireurs`

## Récit

**En tant qu'**organisateur, **je veux** obtenir un QR code pour les arbitres et un autre pour les tireurs de mon
épreuve, les afficher ou les imprimer, et pouvoir les régénérer, **afin que** chacun saisisse ses scores sans compte
et que je puisse couper un accès compromis (ADR-0007).

Maquette : **planche 21 « Paramètres : accès par QR code et appareils connectés »**
(`docs/maquettes/deroule/ParametresAcces.dc.html`, validée le 2026-11-19), section de la page « Paramètres ». Entrées :
le lien « Gérer les accès » de la carte « Saisies reçues des smartphones » (planche 10) et la page « Paramètres » de
l'épreuve.

## Critères d'acceptation

**CA-1 — Deux QR par épreuve**
- **Étant donné** une épreuve pilotée par ce PC
- **Quand** l'organisateur ouvre « Accès »
- **Alors** il voit deux QR codes, « Arbitres » et « Tireurs », avec le lien en clair sous chacun
  (`…/#/saisie/<epreuveId>?j=<jeton>`) et un bouton « Copier le lien ».

**CA-2 — Jetons générés par le pilote**
- **Étant donné** une épreuve sans jetons
- **Quand** l'organisateur ouvre « Accès » pour la première fois, en ligne
- **Alors** le pilote génère deux jetons aléatoires de 128 bits et les enregistre dans le DO `Epreuve` ; le journal
  n'en garde que l'empreinte (événement `JetonsQrGeneres`), jamais le jeton en clair.

**CA-3 — Imprimer**
- **Étant donné** les QR affichés
- **Quand** l'organisateur choisit « Imprimer »
- **Alors** une page A4 imprimable montre le nom de l'épreuve, les deux QR en grand et leur mode d'emploi en une
  phrase (« Arbitres : scannez pour saisir les scores de votre piste »).

**CA-4 — Régénérer**
- **Étant donné** des QR en service
- **Quand** l'organisateur choisit « Régénérer… » sur l'un d'eux et confirme
- **Alors** un nouveau jeton remplace l'ancien ; le DO ferme les sockets des appareils qui utilisaient l'ancien
  (`4003`), qui affichent « Ce lien n'est plus valable : scannez le nouveau QR code ».

**CA-5 — Rôle désactivé**
- **Étant donné** le réglage « Tireur : saisir… » désactivé dans les Paramètres (US-032)
- **Quand** l'organisateur ouvre « Accès »
- **Alors** le QR des tireurs reste disponible (il donne accès à « Mes matchs » en lecture) et une mention l'indique :
  « Les tireurs ne peuvent pas saisir (Paramètres) ».

**CA-6 — Fin de validité**
- **Étant donné** une épreuve passée « Terminée » ou archivée
- **Quand** un appareil ouvre un ancien lien
- **Alors** il est refusé : « Cette épreuve est terminée ».

**CA-7 — Conforme à la planche 21**
- **Étant donné** la capture de la planche 21 (`docs/maquettes/deroule/21-acces-qr.png`)
- **Quand** un test E2E affiche l'écran avec les données de la planche
- **Alors** sa structure suit la planche ; la recette liste les écarts.

## Comportement hors ligne

Hors ligne, les QR déjà générés s'affichent et s'impriment (les jetons sont gardés localement par le pilote, comme les
autres données de l'épreuve) ; « Régénérer » est désactivé avec la mention « Nécessite une connexion ». Si aucun jeton
n'a encore été généré, l'écran l'indique et propose de revenir en ligne. Testé par un E2E réseau coupé.

## Cas limites et erreurs

- Épreuve pilotée par un autre PC : QR visibles en lecture seule, pas de « Régénérer ».
- Prise de main (US-029) : le nouveau pilote garde les mêmes jetons (lus dans le DO).
- Échec de l'enregistrement dans le DO : message d'erreur, jetons non affichés (un QR non enregistré ne marcherait pas).

## Hypothèses

- Le QR vaut pour **l'épreuve** (ce qui se tire, avec son journal et son pilote), et non pour la compétition comme
  l'écrit l'ADR-0007, rédigée avant l'inversion du vocabulaire (ADR-0021).
- L'impression des QR sur les feuilles de poule relève d'E7 (Impressions).
- Le QR se dessine dans l'application, avec une bibliothèque gratuite et sans réseau (choix noté dans les notes de l'US).

- Implémentation (2026-11-19) : bibliothèque `qrcode-generator` 2.0.4 (MIT, sans dépendance, sans réseau), correction M.
  Le QR reste noir sur blanc dans les deux thèmes (variables `--qr-encre` et `--qr-fond`).
- Implémentation : le lien est `/saisie/<epreuveId>#j=<jeton>` (et non `#/saisie/…?j=…`) : l'application route par
  chemins, et le jeton, dans le fragment, n'est jamais envoyé au serveur ni journalisé par Vercel.
- Implémentation : le DO garde le jeton en clair (il en a besoin pour qu'un autre PC affiche les mêmes QR), le journal
  seulement son empreinte SHA-256. Le pilote le garde aussi sur son PC (IndexedDB) pour l'impression hors ligne.
- Implémentation : « Régénérer… » se confirme dans un encart sous les boutons (pas de fenêtre modale).
- Écarts à la planche 21 : le titre de page reste « Paramètres de l'épreuve » (comme les autres étapes), les réglages
  restent des cases à cocher à gauche (et non des interrupteurs à droite), le bouton « Enregistrer les paramètres »
  (US-032) reste, en neutre (l'action principale est « Imprimer les QR codes ») ; la carte « Appareils connectés » vient
  avec US-105, le nombre d'appareils connectés sous chaque QR aussi.
- CA-4 et CA-6 côté smartphone : le DO ferme déjà (`4003`) les sockets étiquetées `qr:<role>` d'un jeton remplacé, et la
  règle « accès ouvert en préparation et en cours » est dans le domaine (`accesQrOuvert`) ; les messages affichés par le
  smartphone (« Ce lien n'est plus valable… », « Cette épreuve est terminée ») et leurs tests viennent avec US-097, qui
  crée ces sockets. Sur le PC, une épreuve terminée ou archivée n'affiche plus ses QR (« ne donnent plus accès »).

## Questions bloquantes

Aucune. La planche 21 a été validée par l'utilisateur le 2026-11-19 : « Accès par QR code » est une section de la page
« Paramètres », et « Gérer les accès » (planche 10) y mène.

## Notes techniques

- ADR-0007 (jetons, empreinte, régénération), ADR-0014.
- Les jetons doivent être lisibles par le PC hors ligne pour l'impression : ils sont gardés dans le stockage local du
  pilote, hors du journal répliqué.
- Nouvelle icône éventuelle (« QR code ») à ajouter au vocabulaire avant usage.

## Suivi

| Date | Événement |
|---|---|
| 2026-11-19 | Créée |
| 2026-11-19 | En cours sur `us/US-096-qr-codes-arbitres-tireurs` (série « maximum d'US ») |
| 2026-11-19 | Implémentée ; en revue. Contrôles locaux verts (lint, typage, 1 745 tests, couverture 94,5 %, E2E `acces-qr`, `parametres`, `epreuve-etapes`, `charte`) |
