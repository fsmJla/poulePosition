# US-131 — Sauvegarder automatiquement les épreuves pilotées dans un dossier (clé USB)

- **Epic :** E8 — Hors ligne et resynchronisation
- **Fonctionnalité :** F12 (exigences §1, scénario de perte totale de connexion)
- **Priorité :** P1
- **Type :** fonctionnelle
- **Statut :** En revue
- **Dépend de :** US-034, US-035, US-017
- **Branche / PR :** us/US-131-sauvegarde-automatique (branches empilées US-129 → US-130 → US-131, une seule PR vers dev)

## Récit

**En tant qu'**organisateur, **je veux** choisir une fois un dossier (par exemple sur une clé USB) où le PC pilote
écrit tout seul la sauvegarde des épreuves qu'il pilote, **afin de** pouvoir reprendre la compétition sur un autre PC
si celui-ci tombe en panne pendant une longue coupure, quand rien n'est encore sur le serveur.

Maquette : pas de planche. Le réglage s'ouvre depuis le menu de compte (US-017) : « Sauvegarde automatique… » ouvre une
petite fenêtre (dossier choisi, dernière sauvegarde, « Choisir un dossier » en action principale, « Arrêter » en
secondaire). Écart déclaré dans les Hypothèses, à valider par l'utilisateur.

## Critères d'acceptation

**CA-1 — Choisir le dossier**
- **Étant donné** l'organisateur sur Chrome ou Edge
- **Quand** il ouvre « Sauvegarde automatique… » dans le menu de compte et choisit un dossier
- **Alors** le dossier est retenu pour ce PC, et la fenêtre affiche son nom et « Sauvegarde automatique active ».

**CA-2 — Écriture après chaque modification**
- **Étant donné** une sauvegarde automatique active et une épreuve pilotée par ce PC
- **Quand** l'organisateur valide une modification (score, retrait, création du tableau…)
- **Alors** au plus 30 secondes après, le fichier `<nom-de-l-epreuve>.poule.json` du dossier contient le journal complet,
  au format de l'export (US-034), en ligne comme hors ligne.

**CA-3 — Reprise depuis la sauvegarde**
- **Étant donné** le fichier écrit par la sauvegarde automatique
- **Quand** il est importé sur un autre PC (US-035)
- **Alors** l'épreuve est reprise jusqu'à la dernière modification sauvegardée.

**CA-4 — Écriture sûre**
- **Étant donné** une écriture interrompue (clé retirée pendant l'écriture)
- **Quand** l'écriture suivante a lieu
- **Alors** le dossier contient toujours un fichier lisible : la sauvegarde précédente n'est remplacée qu'une fois la
  nouvelle entièrement écrite.

**CA-5 — Dossier indisponible**
- **Étant donné** une sauvegarde active dont le dossier n'est plus accessible (clé retirée, droit retiré)
- **Quand** une écriture échoue
- **Alors** un bandeau « Sauvegarde automatique impossible : rebranchez la clé ou choisissez un autre dossier »
  s'affiche, avec « Choisir un dossier », et l'épreuve continue normalement ; l'écriture reprend dès que le dossier
  redevient accessible.

**CA-6 — Autorisation après redémarrage**
- **Étant donné** un navigateur rouvert, qui demande à nouveau l'autorisation d'écrire dans le dossier
- **Quand** l'organisateur ouvre une épreuve qu'il pilote
- **Alors** un bandeau « Sauvegarde automatique en pause » propose « Reprendre la sauvegarde » (un clic, qui déclenche
  la demande d'autorisation du navigateur) ; aucune écriture n'a lieu sans cette autorisation.

**CA-7 — Navigateur sans cette possibilité**
- **Étant donné** Firefox ou Safari
- **Quand** l'organisateur ouvre le menu de compte
- **Alors** « Sauvegarde automatique… » est grisé, avec l'infobulle « Disponible sur Chrome et Edge : exportez
  l'épreuve à la main (menu ⋯) ».

**CA-8 — Arrêter**
- **Étant donné** une sauvegarde active
- **Quand** l'organisateur choisit « Arrêter »
- **Alors** plus rien n'est écrit et les fichiers déjà dans le dossier sont conservés.

## Comportement hors ligne

Fonctionne entièrement hors ligne : c'est son but. Le choix du dossier et l'écriture se font en local, sans serveur.
Testé en E2E hors ligne avec un faux dossier (API File System Access simulée dans la page de test).

## Cas limites et erreurs

- Deux épreuves au même nom : le nom du fichier est complété par la date de l'épreuve, puis par un numéro.
- Épreuve non pilotée par ce PC (lecture seule) : rien n'est écrit pour elle.
- Épreuve renommée : le nouveau nom donne un nouveau fichier ; l'ancien reste dans le dossier.
- Dossier plein : traité comme le CA-5.
- Fichiers joints (affiche, feuille de route) : inclus comme dans l'export (US-034 CA-2). Le format de l'export les
  range dans le même fichier : ils sont donc réécrits à chaque sauvegarde (quelques Mo au plus, une fois toutes les 30 s).
- Plusieurs onglets ouverts : un seul écrit à la fois (verrou entre onglets).

## Hypothèses

- Le dossier est un réglage **du PC** (navigateur), pas d'une épreuve ni d'un compte : toutes les épreuves pilotées par
  ce PC y sont sauvegardées.
- Un fichier par épreuve, **remplacé** à chaque écriture (pas d'historique de versions).
- Les écritures sont regroupées : au plus une toutes les 30 secondes par épreuve, et une dernière quand l'épreuve est
  terminée.
- La sauvegarde est active **en ligne comme hors ligne** : plus simple et plus sûr que de ne l'activer qu'à la
  coupure.
- Écart de maquette à valider : réglage dans le menu de compte, fenêtre sans planche.
- Aucun service ni dépendance nouvelle : l'API File System Access est fournie par le navigateur (ADR non nécessaire ;
  l'ADR-0003 la cite déjà pour l'export).

## Questions bloquantes

- Aucune.

## Notes techniques

- `showDirectoryPicker()` ; le `FileSystemDirectoryHandle` se garde dans IndexedDB ; vérifier
  `queryPermission`/`requestPermission` au démarrage (CA-6).
- Écriture atomique : fichier temporaire puis `move()` quand il est disponible, sinon `createWritable()` (qui
  n'écrase le fichier qu'à `close()`).
- Réutiliser le format et le code de l'export (US-034).
- Impacts : US-017 (une entrée de plus dans le menu de compte), US-034 (format partagé), US-035 (import du fichier).

## Suivi

| Date | Événement |
|---|---|
| 2026-11-21 | Créée (spécification de l'Epic 8) |
| 2026-11-21 | Implémentée (série E8 enchaînée, une seule PR finale) : En revue |
