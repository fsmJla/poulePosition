# Glossaire

Vocabulaire à employer **tel quel** dans le code (identifiants en français, sans accents dans les noms de
variables : `competition`, `piste`, `poule`), dans les docs et dans l'interface. Si un terme manque, on
l'ajoute ici avant de l'utiliser.

## Escrime

| Terme | Définition | Dans le code |
|---|---|---|
| Arme | Sabre, épée, fleuret ou sabre laser. | `arme` : `sabre`, `epee`, `fleuret`, `sabreLaser` |
| Tireur | Compétiteur. | `tireur` |
| Équipe | 2 ou 3 tireurs (et un remplaçant éventuel) d'une épreuve par équipes. | `equipe` |
| Manifestation | Rassemblement organisé par le club sur un ou plusieurs jours (souvent un week-end), qui regroupe des épreuves et des compétitions : nom, dates de début et de fin, lieu. Ce mot est employé dans l'interface comme dans le code ; on évite « évènement », qui se confondrait avec l'événement du journal. | `manifestation` |
| Épreuve | Ensemble de compétitions d'une manifestation présentées sous un même nom et une même affiche, éventuellement sur plusieurs jours (ex. « Championnats de Nouvelle-Aquitaine de sabre »). Appartient toujours à une manifestation. | `epreuve` |
| Compétition | Unité qui se déroule (inscriptions, poules, tableau) : nom, arme, type, catégorie, sexe, date, horaires, lieu, formule. Une par arme × catégorie × sexe ; isolée ou rattachée à une manifestation, éventuellement dans une épreuve. | `competition` |
| Type de compétition | Individuelle, équipes de 2 (relais à 20 touches) ou équipes de 3 (relais à 45 touches). | `typeCompetition` : `individuelle`, `equipes2`, `equipes3` |
| Horaires | Heure d'appel (pointage des tireurs), de scratch (clôture des inscriptions sur place) et de début des poules. | `appel`, `scratch`, `debutPoules` |
| Statut d'une compétition | En préparation → En cours → Terminée ; Archivée (réversible). | `statut` : `preparation`, `enCours`, `terminee`, `archivee` |
| Match pour la 3e place | Match facultatif entre les perdants des demi-finales ; sans lui, deux 3es ex æquo. | `matchTroisieme` |
| Formule | Enchaînement des tours (ex. un tour de poules puis un tableau à élimination directe). | `formule` |
| Tour | Étape de la formule : tour de poules ou tableau. | `tour` |
| Poule | Groupe de tireurs qui se rencontrent tous (en général 5 à 7), sur une piste. | `poule` |
| Match | Rencontre entre deux tireurs (5 touches en poule, 15 en tableau). Aussi appelé assaut. | `match` |
| Touche | Point marqué. | `touche` |
| Victoire / défaite | Résultat d'un match (V / D). En poule, le vainqueur est noté V et son score. | `victoire`, `defaite` |
| Touches données / reçues | TD : touches marquées ; TR : touches reçues. | `touchesDonnees`, `touchesRecues` |
| Indice | TD − TR. Sert à départager les tireurs. | `indice` |
| Classement après poules | Tri par V / matchs, puis indice, puis TD. | `classementPoules` |
| Tableau | Élimination directe (tableau de 64, 32, 16…), avec exempts si l'effectif n'est pas une puissance de 2. | `tableau` |
| Exempt | Tireur qualifié d'office pour le tour suivant du tableau, faute d'adversaire. | `exempt` |
| Piste | Aire de combat numérotée, où se tient une poule ou un match. | `piste` |
| Arbitre | Personne qui dirige les matchs d'une piste et note les scores. | `arbitre` |
| Feuille de poule | Grille imprimée des matchs et résultats d'une poule. | `feuillePoule` |
| Feuille de match | Feuille d'un match de tableau. | `feuilleMatch` |
| Émargement | Pointage de la présence des tireurs le jour J. | `emargement` |
| Catégorie | Tranche d'âge (M15, Senior, Vétéran 1…), ou catégorie libre pour un challenge. | `categorie` |
| Sexe d'une compétition | Hommes, Dames ou Mixte. | `sexe` : `hommes`, `dames`, `mixte` |

## Application

| Terme | Définition | Dans le code |
|---|---|---|
| Pilote | Appareil (le PC de l'organisateur) qui détient la compétition et fait foi. | `pilote` |
| Journal | Suite ordonnée des événements d'une compétition, source de vérité. | `journal` |
| Événement | Fait enregistré dans le journal (`ScoreSaisi`…), avec un numéro de séquence. | `evenement`, `seq` |
| Projection | État calculé à partir du journal. | `projection` |
| Vue | Données d'affichage publiées par le pilote pour l'écran ou les spectateurs. | `vue` |
| Saisie | Proposition de score envoyée par un smartphone, que le pilote accepte ou refuse. | `saisie` |
| Accusé | Réponse du pilote à une saisie : acceptée, refusée ou doublon. | `accuse` |
| Boîte | Saisies stockées par le serveur en attente d'accusé. | `boite` |
| Jeton QR | Secret de 128 bits contenu dans le lien QR des arbitres ou des tireurs. | `jetonQr` |
| Publication | Réglage d'une compétition : publiée, elle est visible du public sur la page d'accueil (affiche, dates…) ; non publiée, seuls les organisateurs la voient. Sans rapport avec le réseau : « en ligne / hors ligne » est réservé à l'état du réseau. | `publiee` |
| Prendre la main | Faire de ce PC le pilote d'une compétition (en ligne) ; l'ancien pilote passe en lecture seule (US-029). | `prendreLaMain`, `PiloteChange` |
| Suppression définitive | Effacement irréversible d'une compétition sur le serveur et sur les PC, réservé aux administrateurs, interdit pour une compétition en cours (US-039). Distincte de l'archivage. | `supprimee` |
| Pierre tombale | Trace gardée par le serveur d'une compétition supprimée (identifiant et date) : elle empêche son retour par un PC qui en garde une copie et lui fait effacer cette copie. | `pierreTombale` |
| Archivage | Mise de côté réversible d'une compétition ou d'une manifestation : lecture seule, masqué des listes et de la page publique (US-033). | `archivee` |
| Écran | Affichage géant (distant ou fenêtre locale). | `ecran` |
| Spectateur | Accès public en lecture seule. | `spectateur` |
| Club | Organisation propriétaire des données (`clubId`). | `club` |
| Compte | Accès nominatif à l'application (e-mail, nom, rôle, état), pour les administrateurs et les organisateurs. Les arbitres et les tireurs n'en ont pas (accès par QR code). | `compte` |
| Rôle | Profil d'un compte : administrateur (tout, y compris la gestion des comptes) ou organisateur (compétitions). | `role` : `administrateur`, `organisateur` |
| Session | Preuve de connexion d'un compte sur un appareil, valable 30 jours et prolongée à chaque usage en ligne. | `session` |
| Appareil connu | Appareil sur lequel un compte s'est déjà connecté en ligne : il peut s'y reconnecter hors ligne. | `appareilConnu` |
| Vérificateur local | Empreinte du mot de passe gardée sur un appareil connu pour la connexion hors ligne (ADR-0006). | `verificateurLocal` |
| Session locale | Session ouverte hors ligne avec le vérificateur local, sans jeton du serveur ; revalidée au retour en ligne (US-005). | `SessionLocale` |
| Frein local | Limite des mots de passe faux de la connexion hors ligne, mesurée par l'appareil (US-005). | `essaisLocaux` |
| Mon profil | Page où l'utilisateur connecté modifie son nom et son avatar, et accède au changement de son mot de passe (US-016). À ne pas confondre avec le rôle, que les exigences (F1) appellent aussi « profil ». | `/profil` |
| Avatar | Pastille ronde aux initiales du nom, sur une couleur choisie dans une palette de la charte (US-016). | `avatar` |
| Menu de compte | Menu ouvert depuis l'avatar en haut à droite : nom, e-mail, « Éditer le profil » et déconnexions (US-017). | `MenuCompte` |
| Lien de réinitialisation | Lien envoyé par e-mail depuis `no-reply@pessac-escrime.fr`, à usage unique et valable 1 heure, pour choisir un nouveau mot de passe sans administrateur (US-019). | `/reinitialisation#<jeton>`, `jetonDuFragment` |
| Blocage (trop d'essais) | Refus des connexions à un e-mail ou depuis une adresse IP après trop d'échecs, mesuré par le serveur (US-004). | `TROP_D_ESSAIS`, `RegleEssais` |
| Charte graphique | Palette « Calme rétro », polices et styles communs à toutes les pages, définis une seule fois sous forme de variables (US-011). | `charte`, variables CSS |
| Version du mot de passe | Numéro d'un compte qui augmente à chaque changement de mot de passe ; une session d'une version dépassée est refusée (US-010). | `versionMdp`, `v` |
| Mot de passe temporaire | Mot de passe généré par un administrateur à la création ou à la réinitialisation d'un compte, à changer à la première connexion. | `motDePasseTemporaire` |
| Secret d'installation | Secret du déploiement qui autorise la création du premier administrateur. | `SECRET_INSTALLATION` |
