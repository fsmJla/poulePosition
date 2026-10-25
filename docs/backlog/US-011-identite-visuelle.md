# US-011 — Appliquer l'identité visuelle (palette, polices, icônes)

- **Epic :** E0 — Socle technique
- **Fonctionnalité :** PWA, qualité d'usage (exigences §6)
- **Priorité :** P1
- **Type :** technique
- **Statut :** Prête
- **Dépend de :** US-001
- **Branche / PR :** —

## Récit

**En tant qu'**utilisateur de poulePosition (organisateur, arbitre, tireur, spectateur), **je veux** une application
au style cohérent et reconnaissable, avec sa propre icône, **afin de** la retrouver facilement sur mon appareil et de
l'utiliser avec plaisir.

## Critères d'acceptation

**CA-1 — Palette « Calme rétro »**
- **Étant donné** la combinaison de couleurs 78 « Calme rétro » choisie par l'utilisateur : bleu Tiffany `#0ABAB5`,
  lavande `#B7A6D9`, sarcelle foncé `#078A86`, sable `#D9B99B`, vert ardoise `#2F4B4A`
- **Quand** j'ouvre n'importe quelle page de l'application
- **Alors** ses couleurs viennent d'un **jeu unique de variables** (rôles : fond, surface, texte, texte discret,
  bordure, primaire, accent, succès, attente, erreur), construit sur cette palette et sur des neutres légèrement
  teintés, et aucun composant ne définit de couleur en dur.

**CA-2 — Clair ou sombre selon l'appareil**
- **Étant donné** un appareil réglé en mode clair, puis en mode sombre
- **Quand** j'ouvre l'application
- **Alors** elle suit ce réglage, avec la même palette adaptée (neutres sombres du démonstrateur en mode sombre).

**CA-3 — Lisibilité**
- **Étant donné** chaque couple texte / fond défini par la charte, dans les deux modes
- **Quand** on mesure leur contraste
- **Alors** il atteint au moins 4,5:1 pour le texte courant et 3:1 pour les grands textes, les bordures de champs et
  les éléments d'interface (WCAG 2.1, niveau AA).

**CA-4 — Polices embarquées**
- **Étant donné** les polices du démonstrateur : Bricolage Grotesque (titres) et Figtree (texte)
- **Quand** une page s'affiche
- **Alors** ces polices sont servies par l'application elle-même (aucune requête vers Google Fonts ni vers un autre
  domaine que l'application et son serveur), et une police du système les remplace en attendant leur chargement.

**CA-5 — Icônes de l'application**
- **Étant donné** le pack d'icônes poulePosition (icône « feuille de poule »)
- **Quand** j'ouvre l'application dans un navigateur, puis que je l'installe sur un PC ou un smartphone
- **Alors** l'onglet affiche le favicon, l'icône installée est celle du pack (variante « maskable » sur Android,
  `apple-touch-icon` sur iOS), et la couleur de thème est le vert ardoise `#2F4B4A`, avec un fond de démarrage sable
  clair `#F7F4EF`.

**CA-6 — Pages existantes**
- **Étant donné** les pages déjà réalisées : accueil public, accueil de l'organisateur, changement de mot de passe
- **Quand** je les ouvre
- **Alors** elles utilisent la nouvelle charte (couleurs, polices, boutons, champs, messages) et l'accueil public
  affiche la nouvelle icône à la place de l'ancienne. Leurs textes et leur fonctionnement sont inchangés.

## Comportement hors ligne

Les polices, les icônes et le manifeste font partie des fichiers précachés par le service worker : après une
première visite, l'application s'affiche hors ligne avec exactement le même style (même polices, mêmes icônes).

## Cas limites et erreurs

- Police pas encore chargée (première visite en 4G lente) : le texte s'affiche tout de suite dans la police du
  système (`font-display: swap`), puis bascule. La page reste affichée en moins de 1 s en 4G (exigences §6).
- Utilisateur qui a demandé à réduire les animations : aucune animation (icône animée comprise) ne joue.
- Ancien navigateur sans prise en charge du SVG en favicon : le `favicon.ico` prend le relais.

## Hypothèses

- Validées par l'utilisateur le 2026-10-25 : polices embarquées, mode sombre selon l'appareil, charte appliquée à
  tout l'existant.
- Rôles des couleurs : primaire = sarcelle (`#078A86`, ou une nuance plus foncée si le contraste l'exige), accent =
  bleu Tiffany, fond foncé et marque = vert ardoise, chaud = sable, secondaire = lavande. Les nuances exactes sont
  ajustées pour respecter CA-3.
- Polices limitées au sous-ensemble latin et à deux graisses chacune, soit environ 100 Ko au plus.
- L'écran géant et la saisie smartphone, qui n'existent pas encore, utiliseront cette même charte.

## Questions bloquantes

- Aucune.

## Notes techniques

- Pack d'icônes fourni par l'utilisateur (`poulePosition-icons.zip`) : `favicon.ico`, `favicon.svg`,
  `apple-touch-icon.png`, `icons/` (PNG 16 à 1024, maskable 192 et 512, SVG dont `icon-animated.svg`),
  `site.webmanifest`. Le manifeste est généré par `vite-plugin-pwa` à partir de ces valeurs. Le composant
  `PoulePositionLoader.tsx` (React) n'est pas repris tel quel : l'icône animée est utilisée en SVG ou en composant
  Svelte (US-012).
- Polices : paquets `@fontsource` (licence OFL, gratuits), servis et précachés par l'application, pas de CDN.
- CA-3 vérifiable par un test unitaire qui calcule le contraste des couples de la charte.
- ADR-0002 (Svelte, PWA), ADR-0008 (Vercel). Pas d'impact sur le protocole ni le journal.
- **Impact sur des US terminées** : US-001 (icône `icone.svg` et page minimale), US-003 (styles de la connexion,
  refaite par US-012), US-010 (styles du changement de mot de passe). Leurs tests E2E doivent rester verts.

## Suivi

| Date | Événement |
|---|---|
| 2026-10-25 | Créée (spécification identité visuelle) |
