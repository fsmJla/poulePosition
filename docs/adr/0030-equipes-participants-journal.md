# ADR-0030 — Équipes dans le journal ; poules et tableau tirés par des « participants »

- **Statut :** Acceptée (2026-11-22, sur instruction de l'utilisateur d'enchaîner l'Epic 10)
- **Date :** 2026-11-22
- **Complète :** ADR-0001 (journal d'événements) ; US-085 (poules dans le journal) et US-108 (tableau dans le journal).

## Contexte

L'Epic 10 ajoute les épreuves par équipes (F15). Décisions de l'utilisateur du 2026-11-22 :

- les équipes se constituent **à partir des tireurs inscrits** (2 ou 3 titulaires, un remplaçant facultatif, équipes
  mixtes entre clubs permises) ;
- elles sont **rangées par la somme des classements** de leurs titulaires, tirage au sort à égalité, corrigeable à la main ;
- formule au choix : **tableau direct** (par défaut) ou **poules puis tableau** ;
- seul le **score final** d'une rencontre est saisi (pas le détail des relais).

Les poules (composition, scores, classement, retraits) et le tableau (placement, scores, tours, classement final)
existent pour des tireurs. Leurs règles ne dépendent, d'un tireur, que de son identifiant, de sa présence, de son club et
de son classement.

## Décision

1. **Quatre événements** s'ajoutent au journal d'une épreuve par équipes :
   - `EquipeCreee { equipeId, nom, titulaires, remplacant, tirage }` : `tirage` est un nombre tiré par le pilote à la
     création, qui départage les équipes à égalité de rang ; l'enregistrer garde la projection déterministe ;
   - `EquipeModifiee { equipeId, nom?, titulaires?, remplacant? }` ;
   - `EquipeSupprimee { equipeId }` ;
   - `RangsEquipesModifies { ordre }` : l'ordre corrigé à la main, ou `null` pour revenir au rang calculé.
   Ils sont refusés dans une épreuve individuelle et, sauf le remplaçant, une fois les poules lancées ou le tableau créé.
2. **Participants.** Les poules et le tableau ne changent pas de forme : leurs événements (`PoulesComposees`,
   `ScorePouleSaisi`, `TableauCree`, `ScoreTableauSaisi`, retraits…) portent, par équipes, des **identifiants
   d'équipes** là où ils portent des identifiants de tireurs en individuel. Le domaine fournit `participantsDe(epreuve)` :
   les tireurs en individuel ; par équipes, une entrée par équipe de même forme qu'un tireur (identifiant de l'équipe,
   nom, club commun ou « Mixte », classement = rang de l'équipe, présente = complète d'après l'émargement).
3. **La présence reste par tireur** (`PresenceModifiee`) ; l'état « complète » d'une équipe est calculé. Une équipe qui
   devient incomplète, ou qui est supprimée, sort de la composition des poules non lancées.
4. **Pas de nouvelle version du format** (`VERSION_JOURNAL` reste à 1) : aucun événement existant ne change de forme.
   Les nouveaux types sont validés par `paquets/protocole` ; le serveur, qui relit et réplique le journal, doit être
   redéployé avec cette validation.

## Alternatives écartées

- **Des événements propres aux équipes** (`PoulesEquipesComposees`, `ScoreRencontreSaisi`…) : ils dupliquaient toutes les
  règles des poules et du tableau, et chaque correction future aurait dû être faite deux fois.
- **Un champ `equipeId` sur chaque tireur** (`TireurModifie`) : il rendait l'ordre des titulaires, le remplaçant et le
  nom de l'équipe difficiles à exprimer, et mêlait inscription et constitution.
- **Rang tiré au sort à l'affichage** : non déterministe d'un appareil à l'autre ; le tirage est donc enregistré.

## Conséquences

- ➕ Toute la mécanique des poules, du tableau, de la saisie smartphone, des impressions et de la vue en direct sert aux
  équipes, avec des noms d'équipes à l'affichage.
- ➕ Les journaux existants se relisent sans migration.
- ➖ Les identifiants « tireurA », « tireurB », « tireurIds » des événements des poules et du tableau désignent, par
  équipes, des équipes : le nom des champs n'est plus exact. Le glossaire le précise (« Participant »).
- ➖ Un ancien client (avant cette ADR) ne lit pas un journal qui contient des équipes : sans effet pratique, le PC pilote
  et le serveur sont mis à jour ensemble.
