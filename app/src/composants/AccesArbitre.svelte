<script lang="ts">
  // Accès arbitre (US-097, planche 12) : le nom de l'arbitre et le choix de sa piste, parmi celles qui ont une poule.
  // « Commencer » reste inactif tant que le nom ou la piste manque.
  import type { VueSaisie } from '@poule-position/domaine';
  import { LONGUEUR_MAX_NOM, pistesDeLaVue } from '../lib/saisie-smartphone';
  import { textes } from '../lib/textes';

  interface Proprietes {
    vue: VueSaisie | null;
    nom: string;
    piste: number | null;
    commencer: (nom: string, piste: number) => void;
  }

  let { vue, nom: nomInitial, piste: pisteInitiale, commencer }: Proprietes = $props();

  const t = textes.saisie;
  const ta = t.arbitre;

  // Valeurs de départ : le nom et la piste déjà donnés sur ce téléphone (changement de piste).
  // svelte-ignore state_referenced_locally
  let nom = $state(nomInitial);
  // svelte-ignore state_referenced_locally
  let piste = $state<number | null>(pisteInitiale);

  const pistes = $derived(pistesDeLaVue(vue));
  const nomValide = $derived(nom.trim().length >= 2);
  const pret = $derived(nomValide && piste !== null && pistes.some((p) => p.piste === piste));
  const contexte = $derived(vue ? t.contexte(vue.competition, vue.date) : '');

  function valider(evenement: SubmitEvent) {
    evenement.preventDefault();
    if (pret && piste !== null) commencer(nom.trim(), piste);
  }
</script>

<form class="acces" onsubmit={valider} novalidate>
  <div class="titre">
    <h1>{ta.titre}</h1>
    {#if contexte}<p class="discret">{contexte}</p>{/if}
  </div>

  <label class="champ">
    {ta.nom}
    <input bind:value={nom} autocomplete="name" maxlength={LONGUEUR_MAX_NOM} />
  </label>

  <fieldset>
    <legend>{ta.piste}</legend>
    {#if vue && !vue.lancees}
      <p class="discret" role="status">{t.poulesNonLancees}</p>
    {:else}
      <div class="pistes">
        {#each pistes as choix (choix.piste)}
          <label class="piste" class:choisie={piste === choix.piste}>
            <span class="ligne">
              <input type="radio" name="piste" value={choix.piste} bind:group={piste} />
              {ta.nomPiste(choix.piste)}
            </span>
            <span class="detail">{ta.poules(choix.poules)}</span>
          </label>
        {/each}
      </div>
      <span class="discret petit">{ta.changerPlusTard}</span>
    {/if}
  </fieldset>

  <div class="bas">
    <p class="discret petit">{ta.signature(nom.trim())}</p>
    <button type="submit" disabled={!pret}>{ta.commencer}</button>
  </div>
</form>

<style>
  .acces {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 22px;
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

  .petit {
    font-size: 0.875rem;
  }

  .champ {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-weight: 600;
  }

  input:not([type]) {
    height: 48px;
    box-sizing: border-box;
    padding: 0 14px;
    border: 2px solid var(--accent);
    border-radius: var(--rayon);
    background: var(--surface);
    color: var(--texte);
    font: inherit;
    font-weight: 400;
  }

  fieldset {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin: 0;
    padding: 0;
    border: none;
  }

  legend {
    padding: 0;
    margin-bottom: 6px;
    font-weight: 600;
  }

  .pistes {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .piste {
    display: flex;
    flex-direction: column;
    min-height: 44px;
    padding: 12px 14px;
    border: 1px solid var(--bordure-champ);
    border-radius: var(--rayon);
    background: var(--surface);
    cursor: pointer;
  }

  .piste.choisie {
    border: 2px solid var(--accent);
    background: var(--accent-teinte);
  }

  .ligne {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;
  }

  .ligne input {
    width: 18px;
    height: 18px;
    margin: 0;
    accent-color: var(--accent);
  }

  .detail {
    padding-left: 26px;
    color: var(--texte-discret);
    font-size: 0.875rem;
  }

  .bas {
    margin-top: auto;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  button {
    height: 52px;
    border: none;
    border-radius: var(--rayon);
    background: var(--palette-tiffany);
    color: var(--sur-tiffany);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }

  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
