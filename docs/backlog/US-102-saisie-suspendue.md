# US-102 — Suspendre la saisie quand la table est déconnectée et récupérer les saisies en route

- **Epic :** E5 — Saisie smartphone
- **Fonctionnalité :** F8, F12 (exigences §1 « Scénario de perte totale de connexion »)
- **Priorité :** P1
- **Type :** fonctionnelle
- **Statut :** Prête
- **Dépend de :** US-099
- **Branche / PR :** —

## Récit

**En tant qu'**arbitre ou tireur, **je veux** voir clairement que la saisie est suspendue quand la table n'est plus
connectée, et que mes saisies parties juste avant ne se perdent pas, **afin de** basculer sur la feuille papier sans
doute, comme le prévoit le scénario de coupure.

Maquette : planche 16 « Smartphone : saisie suspendue » (`docs/maquettes/deroule/16-smartphone-saisie-suspendue.png`,
source `deroule/MobileSuspendue.dc.html`), icône Pause.

## Critères d'acceptation

**CA-1 — Suspension**
- **Étant donné** des téléphones connectés et le pilote qui perd internet (absent pour le DO, US-094)
- **Quand** le DO constate son absence
- **Alors** il en informe les téléphones ; l'entête passe à « Table déconnectée » et le bandeau « Saisie suspendue »
  (icône Pause) dit : « La table de marque n'est plus connectée. Notez les scores sur la feuille de poule et
  rapportez-la à la table. Dernier échange à 10 h 47 · la saisie reprendra d'elle-même. »

**CA-2 — Actions désactivées**
- **Étant donné** la saisie suspendue
- **Quand** l'écran s'affiche
- **Alors** « Saisir le score » devient un bouton grisé « Saisie suspendue », les crayons sont grisés, et la liste des
  matchs reste lisible avec la dernière vue reçue.

**CA-3 — Refus du serveur**
- **Étant donné** le pilote absent
- **Quand** une saisie arrive quand même au DO
- **Alors** il la refuse avec `SAISIE_SUSPENDUE` (ADR-0005) et le téléphone affiche le bandeau du CA-1.

**CA-4 — Téléphone sans réseau**
- **Étant donné** le téléphone qui perd lui-même le réseau
- **Quand** sa socket tombe
- **Alors** le même état s'affiche, avec « Pas de connexion sur ce téléphone » à la place de « La table de marque
  n'est plus connectée ».

**CA-5 — Reprise**
- **Étant donné** la saisie suspendue
- **Quand** le pilote (ou le téléphone) retrouve la connexion
- **Alors** le bandeau disparaît, l'entête repasse à « Table connectée », la vue se met à jour et la saisie reprend,
  sans action de l'arbitre.

**CA-6 — Saisies en route récupérées**
- **Étant donné** une saisie acceptée dans la boîte du DO juste avant la perte du pilote, ou restée « en attente » sur
  le téléphone
- **Quand** le pilote revient
- **Alors** le DO lui livre la boîte, le téléphone renvoie ses saisies en attente avec le même `id`, et le pilote
  applique chaque saisie dont le match n'a pas de score (ADR-0005) ; un doublon est ignoré.

**CA-7 — Le papier fait foi**
- **Étant donné** un match saisi au PC depuis la feuille papier pendant la coupure
- **Quand** la saisie du téléphone pour ce match arrive au retour
- **Alors** elle est rejetée et inscrite au journal ; le PC affiche le bandeau « N saisies smartphone écartées »,
  qui ouvre la liste (match, score proposé, score retenu, auteur), et le téléphone affiche « Écartée : la table avait
  déjà ce score ».

**CA-8 — Conforme à la planche 16**
- **Étant donné** la capture de la planche 16
- **Quand** un test E2E affiche l'écran suspendu à 390 × 844 avec les données de la planche
- **Alors** sa structure suit la planche ; la recette liste les écarts.

## Comportement hors ligne

C'est l'objet de l'US : le PC pilote hors ligne continue seul (saisie au PC, US-088) ; les téléphones sont suspendus
même avec la 4G (exigences §1). Testé par des E2E Playwright avec coupure du pilote, coupure du téléphone et saisie
papier concurrente (ADR-0005).

## Cas limites et erreurs

- Détection tardive (quelques dizaines de secondes) : une saisie acceptée par le DO pendant ce délai reste dans la
  boîte et s'applique au retour (comportement voulu, ADR-0005).
- Pilote qui ne revient pas mais un autre PC prend la main (US-029) : la boîte est livrée au nouveau pilote.
- Tour clôturé entre-temps (tableau lancé, E6) : saisie rejetée « sans objet », comme CA-7.
- Saisie en attente sur un téléphone dont le jeton a été régénéré : refusée, le téléphone affiche « Ce lien n'est
  plus valable » et la saisie reste visible comme « non transmise ».

## Hypothèses

- « Dernier échange à… » est l'heure du dernier message reçu de la table par le téléphone.
- Le bandeau « saisies écartées » du PC se place sous l'entête de l'étape Poules et se ferme une fois consulté.

## Questions bloquantes

Aucune.

## Notes techniques

- ADR-0005 (boîte SQLite du DO, `SAISIE_SUSPENDUE`, idempotence, rejet si score existant), exigences §9 tranchée le
  2026-10-24 (récupération automatique).
- La boîte du DO doit respecter le quota d'écritures (une ligne par saisie, supprimée à l'accusé).

## Suivi

| Date | Événement |
|---|---|
| 2026-11-19 | Créée |
