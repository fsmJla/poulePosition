<script lang="ts">
  // « Qui êtes-vous ? » (US-103, planche 17) : le tireur entré par le QR code des tireurs cherche son nom parmi ceux des
  // poules et le choisit ; ses saisies seront signées à son nom.
  import { chercherTireurs, type VueSaisie } from '@poule-position/domaine';
  import { textes } from '../lib/textes';
  import Icone from './Icone.svelte';

  interface Proprietes {
    vue: VueSaisie | null;
    epreuveId: string;
    choisir: (tireurId: string) => void;
  }

  let { vue, epreuveId, choisir }: Proprietes = $props();

  const t = textes.saisie.tireur;

  let recherche = $state('');
  const dames = $derived(vue?.sexe === 'dames');
  const trouves = $derived(recherche.trim() ? chercherTireurs(vue, recherche) : []);
</script>

<main class="qui">
  <div class="titre">
    <h1>{t.quiEtesVous}</h1>
    <p class="discret">{t.explication(dames)}</p>
  </div>

  {#if vue && !vue.lancees}
    <p class="discret" role="status">{textes.saisie.poulesNonLancees}</p>
  {:else}
    <label class="recherche">
      <Icone nom="loupe" />
      <input type="search" aria-label={t.recherche} bind:value={recherche} autocomplete="off" />
    </label>

    {#if trouves.length > 0}
      <ul aria-label={t.trouves(dames)}>
        {#each trouves as tireur (tireur.id)}
          <li>
            <button type="button" aria-label={t.choisir(`${tireur.nom} ${tireur.prenom}`)} onclick={() => choisir(tireur.id)}>
              <span class="identite">
                <span><strong>{tireur.nom}</strong> {tireur.prenom}</span>
                <span class="discret">{t.detail(tireur.club, tireur.poule)}</span>
              </span>
              <Icone nom="chevron" />
            </button>
          </li>
        {/each}
      </ul>
    {/if}
    <p class="discret">{t.absent}</p>
  {/if}

  <div class="bas">
    <span class="discret">{t.pasTireur}</span>
    <a href={`/direct/${epreuveId}`}>{t.spectateur}</a>
  </div>
</main>

<style>
  .qui {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 18px;
    padding: 24px 16px;
  }

  .titre {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  h1 {
    margin: 0;
    font-size: 1.625rem;
    line-height: 1.2;
  }

  p {
    margin: 0;
  }

  .discret {
    color: var(--texte-discret);
    font-size: 0.9375rem;
  }

  .recherche {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 48px;
    padding: 0 14px;
    border: 2px solid var(--accent);
    border-radius: var(--rayon);
    background: var(--surface);
    color: var(--texte-discret);
  }

  .recherche input {
    flex: 1;
    min-width: 0;
    border: none;
    outline: none;
    background: transparent;
    color: var(--texte);
    font: inherit;
  }

  ul {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  li button {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 64px;
    padding: 8px 14px;
    border: 1px solid var(--bordure);
    border-radius: 12px;
    background: var(--surface);
    color: var(--texte);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .identite {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .identite strong {
    font-weight: 600;
  }

  .bas {
    margin-top: auto;
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding-top: 16px;
    border-top: 1px solid var(--bordure);
  }

  .bas a {
    min-height: 44px;
    display: inline-flex;
    align-items: center;
    color: var(--accent);
    font-weight: 600;
  }
</style>
