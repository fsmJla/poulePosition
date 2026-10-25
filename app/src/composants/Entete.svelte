<script lang="ts">
  // Entête des pages réservées (US-014) : bannière « header » qui ramène à l'accueil de l'organisateur, et
  // déconnexion. Les liens de navigation (Compétitions, Résultats) viendront avec leurs US.
  import { CHEMINS } from '../lib/routes';
  import { textes } from '../lib/textes';
  import Banniere from './Banniere.svelte';

  interface Proprietes {
    surDeconnexion: () => void;
    naviguer: (chemin: string) => void;
  }

  let { surDeconnexion, naviguer }: Proprietes = $props();

  function versAccueil(evenement: MouseEvent) {
    if (evenement.button !== 0 || evenement.ctrlKey || evenement.metaKey || evenement.shiftKey) return;
    evenement.preventDefault();
    naviguer(CHEMINS.organisateur);
  }
</script>

<header>
  <a href={CHEMINS.organisateur} onclick={versAccueil} class="marque">
    <Banniere variante="header" surFondSombre hauteur={32} />
  </a>
  <button type="button" onclick={surDeconnexion}>{textes.organisateur.seDeconnecter}</button>
</header>

<style>
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.6rem max(1rem, env(safe-area-inset-left));
    background: var(--marque);
    color: var(--sur-marque);
  }

  .marque {
    display: flex;
    min-width: 0;
    border-radius: 6px;
  }

  .marque:focus-visible {
    outline-color: var(--sur-marque);
  }

  button {
    flex: none;
    min-height: 44px;
    padding: 0 1rem;
    border: 1px solid var(--sur-marque);
    border-radius: var(--rayon);
    background: transparent;
    color: var(--sur-marque);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }

  button:focus-visible {
    outline-color: var(--sur-marque);
  }
</style>
