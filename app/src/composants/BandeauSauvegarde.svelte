<script lang="ts">
  // Bandeau de la sauvegarde automatique (US-131) : en pause après un redémarrage du navigateur (CA-6), ou dossier
  // inaccessible (CA-5). L'épreuve continue ; un clic relance la sauvegarde.
  import { onMount } from 'svelte';
  import type { EtatSauvegarde, SauvegardeAuto } from '../lib/sauvegarde-auto';
  import { textes } from '../lib/textes';

  let { sauvegarde }: { sauvegarde: SauvegardeAuto } = $props();
  const t = textes.sauvegardeAuto;
  let etat = $state<EtatSauvegarde>({ etat: 'inactive' });

  onMount(() => {
    etat = sauvegarde.etat();
    return sauvegarde.surEtat((nouvel) => (etat = nouvel));
  });
</script>

{#if etat.etat === 'pause' || etat.etat === 'erreur'}
  <div class="bandeau" role="status">
    <span>{etat.etat === 'pause' ? t.bandeauPause : t.bandeauErreur}</span>
    {#if etat.etat === 'pause'}
      <button type="button" onclick={() => void sauvegarde.reprendre()}>{t.reprendre}</button>
    {:else}
      <button type="button" onclick={() => void sauvegarde.choisir()}>{t.choisir}</button>
    {/if}
  </div>
{/if}

<style>
  .bandeau {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem 0.75rem;
    margin: 0.5rem 1rem 0;
    padding: 0.6rem 0.75rem;
    border-left: 4px solid var(--etat-attente);
    background: var(--etat-attente-fond);
    color: var(--sur-etat-attente-fond);
  }

  button {
    padding: 0.3rem 0.7rem;
    border: 1px solid var(--bordure-champ);
    border-radius: var(--rayon);
    background: var(--surface);
    color: var(--texte);
    font: inherit;
    cursor: pointer;
  }
</style>
