<script lang="ts">
  // Impression des QR codes (US-096 CA-3, ADR-0009) : une page A4 avec le nom de l'épreuve, les deux QR en grand et
  // leur mode d'emploi. Elle s'imprime sans internet, avec les jetons gardés sur ce PC.
  import { onMount, tick } from 'svelte';
  import { lienQr, ROLES_QR, type Epreuve } from '@poule-position/domaine';
  import CodeQr from '../composants/CodeQr.svelte';
  import Icone from '../composants/Icone.svelte';
  import type { AccesQrClient, JetonsQr } from '../lib/acces-qr';
  import type { Journal } from '../lib/journal';
  import { cheminParametresEpreuve } from '../lib/routes';
  import { textes } from '../lib/textes';

  interface Proprietes {
    epreuveId: string;
    journal: Journal;
    acces: AccesQrClient;
    naviguer: (chemin: string) => void;
    /** Lance l'impression du navigateur (remplaçable dans les tests). */
    imprimer?: () => void;
  }

  let { epreuveId, journal, acces, naviguer, imprimer = () => window.print() }: Proprietes = $props();

  const t = textes.epreuves.accesQr;
  const ti = t.impression;

  let epreuve = $state<Epreuve | null>(null);
  let jetons = $state<JetonsQr>({ arbitre: null, tireur: null });
  let charge = $state(false);
  const prets = $derived(Boolean(jetons.arbitre || jetons.tireur));

  onMount(() => {
    void (async () => {
      epreuve = (await journal.lire(epreuveId)).epreuve;
      jetons = await acces.lire(epreuveId);
      charge = true;
      await tick();
      if (epreuve && prets) imprimer();
    })();
  });
</script>

<main class="impression">
  <div class="actions pas-imprime">
    <button type="button" class="neutre" onclick={() => naviguer(cheminParametresEpreuve(epreuveId))}
      >{ti.retour}</button
    >
    {#if prets}
      <button type="button" class="principal" onclick={imprimer}><Icone nom="imprimante" />{ti.imprimer}</button>
    {/if}
  </div>

  {#if charge && epreuve}
    <h1>{epreuve.nom}</h1>
    <p class="sous-titre">{ti.titre}</p>
    {#if !prets}
      <p role="status">{ti.aucun}</p>
    {:else}
      <div class="feuille">
        {#each ROLES_QR as role (role)}
          {@const jeton = jetons[role]}
          {#if jeton}
            <section class="bloc" aria-labelledby={`impression-${role}`}>
              <h2 id={`impression-${role}`}>{t.roles[role]}</h2>
              <CodeQr
                texte={lienQr(location.origin, epreuveId, jeton)}
                nom={t.qrDe(t.roles[role], epreuve.nom)}
                taille={260}
              />
              <p>{ti.modeEmploi[role]}</p>
            </section>
          {/if}
        {/each}
      </div>
    {/if}
  {/if}
</main>

<style>
  .impression {
    display: grid;
    justify-items: center;
    gap: 1rem;
    padding: 2rem 1rem 3rem;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  h1 {
    margin: 0;
    font-size: 2rem;
    text-align: center;
  }

  h2 {
    margin: 0;
    font-size: 1.5rem;
  }

  .sous-titre {
    margin: 0;
    color: var(--texte-discret);
  }

  .feuille {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 2.5rem;
  }

  .bloc {
    display: grid;
    justify-items: center;
    gap: 0.75rem;
    max-width: 18rem;
    text-align: center;
  }

  .bloc p {
    margin: 0;
    font-size: 1.0625rem;
  }

  button {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 44px;
    padding: 0 1rem;
    border-radius: var(--rayon);
    font: inherit;
    cursor: pointer;
  }

  .principal {
    border: none;
    background: var(--accent-fond);
    color: var(--sur-accent);
    font-weight: 600;
  }

  .neutre {
    border: 1px solid var(--bordure-champ);
    background: var(--surface);
    color: var(--texte);
  }

  /* A4, noir sur blanc : seuls le nom de l'épreuve, les QR et leur mode d'emploi s'impriment. */
  @media print {
    @page {
      size: A4;
      margin: 15mm;
    }

    .pas-imprime,
    :global(header) {
      display: none !important;
    }

    .impression {
      padding: 0;
    }
  }
</style>
