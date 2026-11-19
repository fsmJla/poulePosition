# US-105 — Voir les appareils connectés et en exclure un

- **Epic :** E5 — Saisie smartphone
- **Fonctionnalité :** F8 (exigences §3)
- **Priorité :** P1
- **Type :** fonctionnelle
- **Statut :** Prête
- **Dépend de :** US-096, US-097, US-103
- **Branche / PR :** —

## Récit

**En tant qu'**organisateur, **je veux** voir qui est connecté à la saisie de mon épreuve et exclure un appareil
indésirable, **afin de** couper un accès abusif sans régénérer le QR de tout le monde (ADR-0007).

Maquette : **planche 21** (`docs/maquettes/deroule/ParametresAcces.dc.html`, validée le 2026-11-19) ; entrée par « Gérer les accès » de la
planche 10.

## Critères d'acceptation

**CA-1 — Liste des appareils**
- **Étant donné** des téléphones connectés à l'épreuve
- **Quand** l'organisateur ouvre « Accès »
- **Alors** il voit un tableau des appareils : identifiant (`t4`), rôle et nom (« arbitre Dupont », « tireuse DUBOIS
  Chloé »), piste ou poule, connecté ou non (« vu à 10 h 46 »), nombre de saisies ; il se met à jour en direct.

**CA-2 — Exclure**
- **Étant donné** un appareil de la liste
- **Quand** l'organisateur choisit « ⋯ › Exclure… » et confirme
- **Alors** le DO ferme sa socket et refuse ses reconnexions avec ce jeton ; le téléphone affiche « Votre accès a été
  retiré par la table de marque » ; l'exclusion est inscrite au journal (`AppareilExclu`).

**CA-3 — Saisies d'un exclu**
- **Étant donné** un appareil exclu dont une saisie est encore dans la boîte
- **Quand** le pilote la reçoit
- **Alors** il la refuse : « Appareil exclu ».

**CA-4 — Lever une exclusion**
- **Étant donné** un appareil exclu
- **Quand** l'organisateur choisit « ⋯ › Réadmettre »
- **Alors** l'appareil peut se reconnecter.

**CA-5 — Conforme à la planche 21**
- **Étant donné** la capture de la planche 21
- **Quand** un test E2E affiche la liste avec les données de la planche
- **Alors** sa structure suit la planche ; la recette liste les écarts.

## Comportement hors ligne

Hors ligne, la liste affiche « Hors ligne : les appareils ne peuvent pas se connecter » ; « Exclure » est désactivé
(nécessite le serveur). Testé par un E2E réseau coupé.

## Cas limites et erreurs

- Un utilisateur exclu peut rescanner le QR depuis un autre navigateur : seule la régénération du QR (US-096) coupe
  tout. La confirmation de « Exclure… » le rappelle.
- PC non pilote : liste en lecture seule.

## Hypothèses

- L'exclusion vise l'identifiant d'appareil gardé par le téléphone ; elle dure jusqu'à la fin de l'épreuve.

## Questions bloquantes

Aucune (planche 21 validée le 2026-11-19).

## Notes techniques

- Repris de `exclure` du relais (ADR-0007).

## Suivi

| Date | Événement |
|---|---|
| 2026-11-19 | Créée |
