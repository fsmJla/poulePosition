<script lang="ts">
  // Bannière « Poule Position » (US-014), SVG vectorisés du pack d'icônes (public/brand) : aucune police à charger,
  // rendu identique hors ligne. Variante claire ou sombre selon le thème (US-052), ou toujours sombre sur la marque.
  import { textes } from '../lib/textes';
  import { theme } from '../lib/theme';

  interface Proprietes {
    /** login : icône, nom et filet · header : petite icône et nom · wordmark : nom seul. */
    variante: 'login' | 'header' | 'wordmark';
    /** Fond toujours foncé (entête ardoise) : variante sombre quel que soit le mode de l'appareil. */
    surFondSombre?: boolean;
    /** Hauteur affichée, en pixels ; la largeur suit. */
    hauteur: number;
  }

  let { variante, surFondSombre = false, hauteur }: Proprietes = $props();

  /** Dimensions des SVG du pack (viewBox). */
  const TAILLES = { login: [321, 190], header: [222, 40], wordmark: [343, 64] } as const;
  /** US-052 : la variante suit le thème effectif (choix manuel ou système), pas seulement le réglage du système. */
  const effectif = theme.effectif;
  const largeur = $derived(Math.round((TAILLES[variante][0] * hauteur) / TAILLES[variante][1]));
</script>

<picture>
  <img
    src="/brand/{variante}-{surFondSombre || $effectif === 'sombre' ? 'dark' : 'light'}.svg"
    alt={textes.nomApplication}
    width={largeur}
    height={hauteur}
    decoding="async"
  />
</picture>

<style>
  picture {
    display: contents;
  }

  img {
    display: block;
    max-width: 100%;
    height: auto;
  }
</style>
