<script lang="ts">
  // Imposer une vue à un écran (US-135, planche 36) : « Afficher sur l'écran » ouvre un choix (épreuve, page, durée) ;
  // une vue imposée s'annonce dans un bandeau avec le temps qui reste et « Reprendre le défilement ». Hors ligne, ou
  // écran déconnecté, la commande est grisée avec son motif.
  import { onMount } from 'svelte';
  import { VUES_ECRAN, type Ecran, type VueEcran, type VueImposee } from '@poule-position/protocole';
  import type { ClientEcrans } from '../lib/ecrans';
  import { textes } from '../lib/textes';
  import Icone from './Icone.svelte';

  interface Proprietes {
    client: ClientEcrans;
    ecran: Ecran;
    connecte: boolean;
    horsLigne: boolean;
    nomsEpreuves: ReadonlyMap<string, string>;
    recharger: () => Promise<void>;
    /** CA-4 (US-136) : la fenêtre locale de ce PC reçoit aussi la vue imposée, avec ou sans réseau. */
    imposerLocalement?: ((ecranId: string, vue: VueImposee | null) => void) | undefined;
  }

  let { client, ecran, connecte, horsLigne, nomsEpreuves, recharger, imposerLocalement }: Proprietes = $props();
  /** Hors ligne, la vue imposée à la seule fenêtre locale (le serveur ne la connaît pas). */
  let imposeeHorsLigne = $state<{ vue: VueImposee | null } | null>(null);
  const t = textes.ecrans;
  const tc = textes.ecrans.commande;

  let ouvert = $state(false);
  let epreuveId = $state('');
  let vue = $state<VueEcran>('appel');
  let poule = $state<number | null>(null);
  let duree = $state<'1' | '5' | 'reprise'>('5');
  let erreur: string | null = $state(null);
  let maintenant = $state(Date.now());

  onMount(() => {
    const minuteur = setInterval(() => (maintenant = Date.now()), 15_000);
    return () => clearInterval(minuteur);
  });

  // Hors ligne, seule la fenêtre locale de ce PC peut recevoir une vue imposée (US-136 CA-4).
  const motif = $derived(
    horsLigne ? (imposerLocalement ? undefined : t.horsLigne) : !connecte ? t.erreurs.ECRAN_DECONNECTE : undefined,
  );
  const courante = $derived(horsLigne && imposeeHorsLigne ? imposeeHorsLigne.vue : ecran.vueImposee);
  const imposee = $derived(courante && (courante.jusqua === null || courante.jusqua > maintenant) ? courante : null);

  function ouvrir() {
    epreuveId = ecran.epreuves[0] ?? '';
    vue = 'appel';
    poule = null;
    duree = '5';
    erreur = null;
    ouvert = true;
  }

  async function imposer(evenement: SubmitEvent) {
    evenement.preventDefault();
    const jusqua = duree === 'reprise' ? null : Date.now() + Number(duree) * 60_000;
    const choisie: VueImposee = { epreuveId, vue, poule: vue === 'poules' && poule ? poule : null, jusqua };
    imposerLocalement?.(ecran.id, choisie);
    if (horsLigne) {
      imposeeHorsLigne = { vue: choisie };
      ouvert = false;
      return;
    }
    const resultat = await client.imposer(ecran.id, choisie);
    if (!resultat.ok) {
      erreur = t.erreurs[resultat.erreur];
      return;
    }
    ouvert = false;
    await recharger();
  }

  async function reprendre() {
    imposerLocalement?.(ecran.id, null);
    if (horsLigne) {
      imposeeHorsLigne = { vue: null };
      return;
    }
    const resultat = await client.imposer(ecran.id, null);
    if (resultat.ok) await recharger();
  }
</script>

<span class="commande">
  <button
    type="button"
    class="secondaire"
    aria-expanded={ouvert}
    disabled={motif !== undefined || ecran.epreuves.length === 0}
    title={motif}
    onclick={() => (ouvert ? (ouvert = false) : ouvrir())}
  >
    <Icone nom="lecture" taille={18} />{t.afficher}
  </button>
  {#if ouvert}
    <form class="choix" aria-label={tc.etiquette(ecran.nom)} onsubmit={imposer}>
      <strong>{t.afficher}</strong>
      <label>
        {tc.epreuve}
        <select bind:value={epreuveId}>
          {#each ecran.epreuves as id (id)}<option value={id}>{nomsEpreuves.get(id) ?? id}</option>{/each}
        </select>
      </label>
      <fieldset>
        <legend>{tc.page}</legend>
        {#each VUES_ECRAN as choix (choix)}
          <label><input type="radio" name="vue-{ecran.id}" value={choix} bind:group={vue} /> {t.vues[choix]}</label>
        {/each}
        {#if vue === 'poules'}
          <label class="poule">
            {tc.poule}
            <input type="number" min="1" bind:value={poule} placeholder={tc.toutes} />
          </label>
        {/if}
      </fieldset>
      <label>
        {tc.pendant}
        <select bind:value={duree}>
          <option value="1">{tc.uneMinute}</option>
          <option value="5">{tc.cinqMinutes}</option>
          <option value="reprise">{tc.jusquaReprise}</option>
        </select>
      </label>
      {#if erreur}<p class="erreur" role="alert">{erreur}</p>{/if}
      <div class="boutons">
        <button type="submit" class="principal">{tc.afficher}</button>
        <button type="button" class="secondaire" onclick={() => (ouvert = false)}>{tc.annuler}</button>
      </div>
    </form>
  {/if}
</span>

{#if imposee}
  <div class="imposee" role="status">
    <Icone nom="pause" taille={20} />
    <span class="texte">
      {tc.imposee(t.vues[imposee.vue], nomsEpreuves.get(imposee.epreuveId) ?? '', imposee.poule)}
      {#if imposee.jusqua !== null}· {tc.encore(Math.max(1, Math.ceil((imposee.jusqua - maintenant) / 60_000)))}{/if}
    </span>
    <button type="button" class="secondaire" disabled={horsLigne && !imposerLocalement} onclick={() => void reprendre()}
      >{tc.reprendre}</button
    >
  </div>
{/if}

<style>
  .commande {
    position: relative;
  }

  .principal,
  .secondaire {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    min-height: 44px;
    padding: 0 0.9rem;
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

  .secondaire {
    border: 1px solid var(--bordure-champ);
    background: var(--surface);
    color: var(--texte);
  }

  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .choix {
    position: absolute;
    z-index: 5;
    top: calc(100% + 0.5rem);
    right: 0;
    display: grid;
    gap: 0.75rem;
    width: min(22rem, 80vw);
    padding: 1rem;
    border: 1px solid var(--bordure);
    border-radius: 12px;
    background: var(--surface);
    box-shadow: var(--ombre-flottante);
  }

  label {
    display: grid;
    gap: 0.25rem;
    font-size: 0.95rem;
  }

  fieldset {
    display: grid;
    gap: 0.25rem;
    margin: 0;
    padding: 0;
    border: none;
    font-size: 0.95rem;
  }

  legend {
    margin-bottom: 0.25rem;
    padding: 0;
  }

  fieldset label {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    min-height: 32px;
  }

  fieldset label.poule {
    display: grid;
  }

  select,
  input[type='number'] {
    min-height: 40px;
    padding: 0 0.5rem;
    border: 1px solid var(--bordure-champ);
    border-radius: 8px;
    background: var(--surface);
    color: var(--texte);
    font: inherit;
  }

  .boutons {
    display: flex;
    gap: 0.5rem;
  }

  .erreur {
    margin: 0;
    color: var(--etat-erreur);
  }

  .imposee {
    display: flex;
    flex-basis: 100%;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem 1rem;
    padding: 0.6rem 0.9rem;
    border: 1px solid var(--etat-attente-bordure);
    border-radius: 10px;
    background: var(--etat-attente-fond);
    color: var(--sur-etat-attente-fond);
  }

  .texte {
    flex: 1 1 18rem;
  }
</style>
