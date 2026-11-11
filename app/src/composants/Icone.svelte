<script lang="ts">
  // Icône de la charte (US-054 CA-4) : SVG au trait, `currentColor`, décorative (masquée des lecteurs d'écran). Une
  // icône seule se pose dans un `BoutonIcone`, qui lui donne son nom accessible et son infobulle.
  import { ICONES, type NomIcone } from '../lib/icones';

  interface Proprietes {
    nom: NomIcone;
    /** Côté en pixels : 20 dans un bouton, 24 seule. */
    taille?: number;
  }

  let { nom, taille = 20 }: Proprietes = $props();
</script>

<svg
  viewBox="0 0 24 24"
  width={taille}
  height={taille}
  fill="none"
  stroke="currentColor"
  stroke-width="1.75"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
  focusable="false"
  data-icone={nom}
>
  <!-- eslint-disable-next-line svelte/no-at-html-tags -- tracés statiques de lib/icones.ts, jamais une saisie -->
  {@html ICONES[nom]}
</svg>

<style>
  svg {
    flex: none;
  }
</style>
