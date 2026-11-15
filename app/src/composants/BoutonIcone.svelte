<script lang="ts">
  // Bouton (ou lien) à icône seule (US-054 CA-4 et CA-5) : nom accessible et infobulle identiques, cible d'au moins
  // 44 × 44 px, focus visible. Réservé aux icônes « universelles » du vocabulaire (docs/maquettes/README.md, principe 4).
  import type { HTMLButtonAttributes } from 'svelte/elements';
  import type { NomIcone } from '../lib/icones';
  import Icone from './Icone.svelte';

  interface Proprietes extends Omit<HTMLButtonAttributes, 'children' | 'title'> {
    icone: NomIcone;
    /** Nom accessible, repris en infobulle. */
    nom: string;
    /** Avec un chemin, le composant est un lien interne ; sinon un bouton. */
    chemin?: string;
    naviguer?: (chemin: string) => void;
    /** Sur le fond ardoise de l'entête : couleurs de la marque. */
    surMarque?: boolean;
    /** Contour neutre (boutons « Modifier » et « ⋯ » de la maquette). */
    contour?: boolean;
    element?: HTMLElement;
  }

  let {
    icone,
    nom,
    chemin,
    naviguer,
    surMarque = false,
    contour = false,
    element = $bindable(),
    ...reste
  }: Proprietes = $props();

  function suivre(evenement: MouseEvent) {
    if (!chemin || !naviguer) return;
    if (evenement.button !== 0 || evenement.ctrlKey || evenement.metaKey || evenement.shiftKey) return;
    evenement.preventDefault();
    naviguer(chemin);
  }
</script>

{#if chemin}
  <a
    href={chemin}
    class="bouton-icone"
    class:sur-marque={surMarque}
    class:contour
    aria-label={nom}
    title={nom}
    onclick={suivre}
    bind:this={element}
  >
    <Icone nom={icone} />
  </a>
{:else}
  <button
    type="button"
    class="bouton-icone"
    class:sur-marque={surMarque}
    class:contour
    aria-label={nom}
    title={nom}
    bind:this={element}
    {...reste}
  >
    <Icone nom={icone} />
  </button>
{/if}

<style>
  .bouton-icone {
    display: inline-grid;
    flex: none;
    place-items: center;
    box-sizing: border-box;
    min-width: 44px;
    min-height: 44px;
    padding: 0;
    border: 1px solid transparent;
    border-radius: var(--rayon);
    background: transparent;
    color: var(--texte);
    cursor: pointer;
  }

  .contour {
    border-color: var(--bordure-champ);
    background: var(--surface);
  }

  .bouton-icone:hover,
  .bouton-icone[aria-expanded='true'] {
    background: var(--surface-2);
  }

  .sur-marque {
    color: var(--sur-marque);
  }

  .sur-marque:hover,
  .sur-marque[aria-expanded='true'] {
    background: color-mix(in srgb, var(--sur-marque) 16%, transparent);
  }

  .sur-marque:focus-visible {
    outline-color: var(--sur-marque);
  }
</style>
