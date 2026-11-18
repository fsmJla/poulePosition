<script lang="ts">
  // Attente d'envoi au serveur (US-090) : une pastille flottante, qui ne pousse pas le contenu, et qui n'apparaît
  // qu'après 3 secondes d'attente — un envoi en ligne, presque immédiat, ne fait donc rien clignoter.
  import { textes } from '../lib/textes';

  interface Proprietes {
    nombre: number;
    /** Délai avant d'afficher la pastille, en millisecondes. */
    delai?: number;
  }

  let { nombre, delai = 3000 }: Proprietes = $props();

  let visible = $state(false);
  const enAttente = $derived(nombre > 0);

  $effect(() => {
    if (!enAttente) {
      visible = false;
      return;
    }
    const minuterie = setTimeout(() => (visible = true), delai);
    return () => clearTimeout(minuterie);
  });
</script>

<p class="attente" class:visible role="status" aria-live="polite">
  {visible && enAttente ? textes.epreuves.enAttente(nombre) : ''}
</p>

<style>
  .attente {
    position: fixed;
    right: 1rem;
    bottom: 1rem;
    z-index: 20;
    margin: 0;
    padding: 0.5rem 0.9rem;
    border: 1px solid var(--etat-attente-bordure);
    border-radius: 999px;
    background: var(--etat-attente-fond);
    color: var(--sur-etat-attente-fond);
    box-shadow: var(--ombre-flottante);
    font-size: 0.875rem;
    font-weight: 600;
    visibility: hidden;
  }

  .attente.visible {
    visibility: visible;
  }
</style>
