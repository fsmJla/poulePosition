# US-053 — Voir l'état du serveur dans l'entête

- **Epic :** E1 — Comptes et authentification
- **Fonctionnalité :** F1 (exigences §3)
- **Priorité :** P2
- **Type :** fonctionnelle
- **Statut :** Prête
- **Dépend de :** US-001, US-014, US-017
- **Branche / PR :** — (renseignés par `/debut-impl-US` et `/fin-impl-US`)

## Récit

**En tant qu'**organisateur connecté, **je veux** voir d'un coup d'œil, dans l'entête, si le serveur est joignable,
**afin de** savoir si mon travail part au serveur ou reste sur mon appareil, sans quitter la page où je suis.

Aujourd'hui l'état du serveur n'est affiché que sur l'accueil public (pastille et « Serveur connecté »).

## Critères d'acceptation

**CA-1 — Une pastille dans l'entête**

- **Étant donné** une page réservée (avec l'entête)
- **Quand** elle s'affiche
- **Alors** l'entête montre une petite pastille de couleur, avec la même charte que celle de l'accueil : verte quand le
  serveur est connecté, rouge quand il est injoignable ou non configuré, orange le temps de la connexion.

**CA-2 — Le libellé au survol**

- **Étant donné** la pastille
- **Quand** l'utilisateur la survole, la touche ou lui donne le focus au clavier
- **Alors** son libellé s'affiche (« Serveur connecté », « Serveur injoignable », « Serveur non configuré »,
  « Connexion au serveur… », les mêmes que l'accueil). Les lecteurs d'écran lisent ce libellé, qui n'est donc pas porté
  par la couleur seule.

**CA-3 — Sur l'écran de connexion**

- **Étant donné** la page de connexion, qui n'a pas d'entête
- **Quand** elle s'affiche
- **Alors** la même pastille, avec le même libellé au survol, est affichée dans la petite barre en haut à droite de la
  page (US-052 CA-2).

**CA-4 — Pas ailleurs**

- **Étant donné** l'accueil public, « Mot de passe oublié » et « Réinitialisation »
- **Quand** elles s'affichent
- **Alors** elles n'ont pas cette pastille : l'accueil garde son propre état, déjà affiché, et les deux autres pages n'en
  ont pas besoin.

**CA-5 — L'état suit la réalité**

- **Étant donné** une page où la pastille est affichée
- **Quand** la connexion au serveur se perd, ou revient, pendant que la page est ouverte
- **Alors** la pastille passe au rouge, ou revient au vert, sans recharger la page.

## Comportement hors ligne

Hors ligne, la pastille est rouge avec « Serveur injoignable » : elle le dit sans bloquer rien, et le travail continue
sur l'appareil comme avant (le bandeau « connexion locale » d'US-005 reste distinct). Au retour du réseau, elle repasse
au vert d'elle-même (CA-5).

## Cas limites et erreurs

- Serveur non configuré (développement sans adresse) : pastille rouge, « Serveur non configuré ».
- Navigation d'une page réservée à une autre : l'état n'est pas recalculé de zéro ni clignotant à chaque page ; la
  pastille garde l'état connu.
- Smartphone étroit (320 px) : la pastille tient dans l'entête avec la bannière, le sélecteur de thème (US-052) et le
  menu de compte, sans défilement horizontal.
- La pastille ne se confond pas avec l'avatar rond du menu de compte : elle est plus petite, sans initiales.

## Hypothèses

- « Comme celle du panneau d'accueil » (décision de l'utilisateur) : mêmes quatre états, mêmes couleurs de la charte
  (`--etat-ok`, `--etat-attente`, `--etat-erreur`) et mêmes libellés que la pastille de l'accueil.
- L'accueil public garde sa pastille avec son libellé écrit, qui n'est pas dans un entête.
- La pastille est dans l'entête des pages réservées, avant le menu de compte, et à gauche du sélecteur de thème sur
  l'écran de connexion.

## Questions bloquantes

- Aucune.

## Notes techniques

- Pas d'impact sur le protocole ni le journal.
- L'état vient de `demarrerConnexion` (`lib/connexion.ts`), aujourd'hui lancé par la seule page d'accueil, vers
  l'épreuve de démonstration. Il faut une **seule** connexion pour toute l'application, tenue au niveau de `App.svelte`
  et partagée par l'accueil, l'entête et la page de connexion, et non une par page. À vérifier avec `/quotas` : le
  nombre de connexions ouvertes vers le Worker de preview et de production ne doit pas augmenter avec la navigation.
- Un composant `PastilleServeur` partagé, qui reprend les libellés de `textes.etats`.
- Tests : E2E Playwright (pastille verte, libellé au survol, rouge hors ligne puis verte au retour, page de connexion,
  absente de « Mot de passe oublié »).

## Suivi

| Date | Événement |
|---|---|
| 2026-11-10 | Créée : demande de la pastille d'état du serveur dans l'entête ; spécifiée avec les réponses de l'utilisateur |
