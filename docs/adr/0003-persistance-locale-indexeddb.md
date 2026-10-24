# ADR-0003 — Persistance locale : IndexedDB (Dexie) et sauvegarde fichier

- **Statut :** Acceptée (2026-10-24)
- **Date :** 2026-10-24

## Contexte

Le PC pilote doit conserver toute la compétition sans réseau, et la retrouver intacte après un plantage du
navigateur ou un redémarrage. Les smartphones gardent leurs saisies non accusées (ADR-0005). Le volume est
faible : ~200 tireurs, quelques milliers d'événements par compétition.

## Décision

- **IndexedDB**, via **Dexie** (petite surcouche typée et éprouvée). Tables principales :
  - `evenements` : le journal, indexé par `[competitionId, seq]`, la source de vérité locale ;
  - `projections` : un cache de l'état calculé, reconstructible à tout moment ;
  - `envoi` : le curseur de synchronisation (dernier `seq` confirmé par le serveur) ;
  - `session` : la session et le vérificateur de mot de passe hors ligne (ADR-0006) ;
  - côté smartphone, `saisiesEnAttente`.
- **Écriture transactionnelle** : un événement est d'abord écrit dans IndexedDB, puis affiché, puis envoyé.
  Un plantage n'en perd aucun.
- **Stockage persistant** : l'application demande `navigator.storage.persist()` pour éviter qu'un navigateur
  purge les données sous pression d'espace.
- **Sauvegarde fichier** : un export JSON du journal peut être lancé en un clic. Il est aussi proposé
  automatiquement à chaque clôture de tour, via l'API File System Access sous Chrome/Edge, sinon par
  téléchargement. Le même format sert à l'import / export (F16) et à la reprise sur un autre PC.

## Alternatives écartées

| Alternative | Pourquoi écartée |
|---|---|
| `localStorage` | Il est synchrone, limité à ~5 Mo, sans transactions, et peu sûr en cas de plantage pendant l'écriture. |
| SQLite WASM + OPFS | C'est puissant, mais cela ajoute ~1 Mo de WASM (objectif 1 s en 4G) et des contraintes d'en-têtes (COOP/COEP). C'est disproportionné pour ce volume. |
| RxDB / PouchDB | Leur valeur est la synchronisation, déjà couverte par un protocole simple (ADR-0005). Ils ajoutent du poids et des concepts. |
| IndexedDB brut (`idb`) | C'est possible, mais Dexie apporte les migrations de schéma et un typage confortable pour un coût minime (~25 Ko gz). |

## Conséquences

- ➕ Les données survivent aux plantages et aux redémarrages, sans aucun service externe.
- ➕ Le format d'export est unique, ce qui rend sauvegarde, reprise et F16 cohérents.
- ➖ Les données sont liées au navigateur et au profil. Vider les données du site efface la compétition
  locale, d'où la synchronisation serveur et la sauvegarde fichier.
- ➖ Les tests E2E devront couvrir le rechargement et la reprise. IndexedDB est disponible dans Playwright.
