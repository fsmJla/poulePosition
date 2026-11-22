<script lang="ts" module>
  import type { EpreuveListee } from '@poule-position/domaine';

  /** Les épreuves qu'un écran peut afficher, groupées par compétition. */
  export interface GroupeEpreuves {
    competition: { id: string; nom: string };
    epreuves: readonly EpreuveListee[];
  }
</script>

<script lang="ts">
  // Fenêtre de réglage d'un écran géant (US-133 CA-2 et CA-5, planche 37) : nom, épreuves cochées par compétition
  // (publiées ou non), durée d'une page, vues à afficher, style (US-140) et bandeau des derniers scores (US-141). « Enregistrer » est l'action principale ; Échap ou « Annuler »
  // la ferment.
  import { onMount } from 'svelte';
  import {
    BANDEAU_DEFAUT,
    BANDEAU_MINUTES_MAX,
    BANDEAU_MINUTES_MIN,
    STYLES_ECRAN,
    type StyleEcran,
    DUREE_PAGE_DEFAUT,
    DUREE_PAGE_MAX,
    DUREE_PAGE_MIN,
    VUES_ECRAN,
    type ReglagesEcran,
    type VueEcran,
  } from '@poule-position/protocole';
  import { textes } from '../lib/textes';

  interface Proprietes {
    /** Écran modifié, ou null pour un nouvel écran. */
    initial: ReglagesEcran | null;
    groupes: readonly GroupeEpreuves[];
    /** Enregistre ; renvoie un message d'erreur à afficher, ou null si c'est fait. */
    enregistrer: (reglages: ReglagesEcran) => Promise<string | null>;
    fermer: () => void;
  }

  let { initial, groupes, enregistrer, fermer }: Proprietes = $props();
  const t = textes.ecrans;
  const tf = t.fenetre;

  let dialogue: HTMLDialogElement | undefined = $state();
  let nom = $state('');
  let epreuves = $state<string[]>([]);
  let duree = $state(DUREE_PAGE_DEFAUT);
  let masquees = $state<VueEcran[]>([]);
  let style = $state<StyleEcran>('sombre');
  let bandeauActif = $state(BANDEAU_DEFAUT.actif);
  let minutes = $state(BANDEAU_DEFAUT.minutes);
  let erreur: string | null = $state(null);
  let enCours = $state(false);

  onMount(() => {
    nom = initial?.nom ?? tf.nomDefaut;
    epreuves = [...(initial?.epreuves ?? [])];
    duree = initial?.dureePage ?? DUREE_PAGE_DEFAUT;
    masquees = [...(initial?.vuesMasquees ?? [])];
    style = initial?.style ?? 'sombre';
    bandeauActif = initial?.bandeau.actif ?? BANDEAU_DEFAUT.actif;
    minutes = initial?.bandeau.minutes ?? BANDEAU_DEFAUT.minutes;
    dialogue?.showModal();
  });

  const basculer = <T,>(liste: T[], valeur: T): T[] =>
    liste.includes(valeur) ? liste.filter((v) => v !== valeur) : [...liste, valeur];

  async function valider(evenement: SubmitEvent) {
    evenement.preventDefault();
    if (enCours) return;
    if (nom.trim() === '') {
      erreur = t.erreurs.NOM_VIDE;
      return;
    }
    if (!Number.isInteger(duree) || duree < DUREE_PAGE_MIN || duree > DUREE_PAGE_MAX) {
      erreur = t.erreurs.DUREE;
      return;
    }
    if (!Number.isInteger(minutes) || minutes < BANDEAU_MINUTES_MIN || minutes > BANDEAU_MINUTES_MAX) {
      erreur = t.erreurs.MINUTES;
      return;
    }
    enCours = true;
    erreur = await enregistrer({
      nom: nom.trim(),
      epreuves,
      dureePage: duree,
      vuesMasquees: masquees,
      style,
      bandeau: { actif: bandeauActif, minutes },
    });
    enCours = false;
    if (erreur === null) fermer();
  }
</script>

<dialog
  bind:this={dialogue}
  aria-labelledby="titre-ecran"
  oncancel={(evenement) => {
    evenement.preventDefault();
    if (!enCours) fermer();
  }}
>
  <form onsubmit={valider}>
    <h2 id="titre-ecran">{initial ? initial.nom : tf.titreNouveau}</h2>

    <label class="champ">
      {tf.nom}
      <input type="text" bind:value={nom} maxlength="60" required />
    </label>

    <fieldset>
      <legend>{tf.epreuves}</legend>
      <span class="aide">{tf.epreuvesAide}</span>
      <div class="cases">
        {#each groupes as { competition, epreuves: liste } (competition.id)}
          <span class="competition">{competition.nom}</span>
          {#each liste as epreuve (epreuve.id)}
            <label>
              <input
                type="checkbox"
                checked={epreuves.includes(epreuve.id)}
                onchange={() => (epreuves = basculer(epreuves, epreuve.id))}
              />
              {epreuve.nom}
              <span class="etat">· {epreuve.publiee ? t.statuts[epreuve.statut] : tf.nonPubliee}</span>
            </label>
          {/each}
        {:else}
          <span class="aide">{tf.aucuneEpreuve}</span>
        {/each}
      </div>
    </fieldset>

    <label class="champ">
      {tf.duree}
      <span class="duree">
        <input type="number" bind:value={duree} min={DUREE_PAGE_MIN} max={DUREE_PAGE_MAX} step="1" />
        {tf.secondes}
      </span>
    </label>

    <fieldset>
      <legend>{tf.vues}</legend>
      <div class="vues">
        {#each VUES_ECRAN as vue (vue)}
          <label>
            <input
              type="checkbox"
              checked={!masquees.includes(vue)}
              onchange={() => (masquees = basculer(masquees, vue))}
            />
            {t.vues[vue]}
          </label>
        {/each}
      </div>
    </fieldset>

    <fieldset>
      <legend>{tf.style}</legend>
      <div class="vues">
        {#each STYLES_ECRAN as valeur (valeur)}
          <label>
            <input type="radio" name="style" value={valeur} bind:group={style} />
            {tf.styles[valeur]}
          </label>
        {/each}
      </div>
    </fieldset>

    <fieldset>
      <legend>{tf.bandeau}</legend>
      <div class="vues">
        <label>
          <input type="checkbox" bind:checked={bandeauActif} />
          {tf.bandeau}
        </label>
        <label class="duree">
          {tf.bandeauMinutes}
          <input
            type="number"
            bind:value={minutes}
            min={BANDEAU_MINUTES_MIN}
            max={BANDEAU_MINUTES_MAX}
            step="1"
            disabled={!bandeauActif}
          />
          {tf.minutes}
        </label>
      </div>
    </fieldset>

    {#if erreur}<p class="erreur" role="alert">{erreur}</p>{/if}

    <div class="boutons">
      <button type="submit" class="principal" disabled={enCours}>{enCours ? tf.enCours : tf.enregistrer}</button>
      <button type="button" class="secondaire" disabled={enCours} onclick={fermer}>{tf.annuler}</button>
    </div>
  </form>
</dialog>

<style>
  dialog {
    width: min(40rem, calc(100% - 2rem));
    max-height: calc(100% - 2rem);
    padding: 1.75rem;
    overflow-y: auto;
    border: none;
    border-radius: 16px;
    background: var(--fond);
    color: var(--texte);
    box-shadow: var(--ombre-flottante);
  }

  dialog::backdrop {
    background: var(--voile);
  }

  form {
    display: grid;
    gap: 1.25rem;
  }

  h2 {
    margin: 0;
    font-family: var(--police-titre);
    font-size: 1.6rem;
    overflow-wrap: anywhere;
  }

  .champ {
    display: grid;
    gap: 0.4rem;
    font-weight: 600;
  }

  input[type='text'],
  input[type='number'] {
    min-height: 44px;
    padding: 0 0.75rem;
    border: 1px solid var(--bordure-champ);
    border-radius: var(--rayon);
    background: var(--surface);
    color: var(--texte);
    font: inherit;
    font-weight: 400;
  }

  input[type='number'] {
    width: 6rem;
  }

  .duree {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 400;
  }

  fieldset {
    display: grid;
    gap: 0.4rem;
    margin: 0;
    padding: 0;
    border: none;
  }

  legend {
    margin-bottom: 0.4rem;
    padding: 0;
    font-weight: 600;
  }

  .aide,
  .etat {
    color: var(--texte-discret);
    font-size: 0.9rem;
  }

  .cases {
    display: grid;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--bordure);
    border-radius: var(--rayon);
    background: var(--surface);
  }

  .competition {
    padding-top: 0.4rem;
    color: var(--texte-discret);
    font-size: 0.875rem;
  }

  .competition:not(:first-child) {
    margin-top: 0.25rem;
    border-top: 1px solid var(--bordure);
  }

  .cases label,
  .vues label {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    min-height: 40px;
  }

  input[type='checkbox'] {
    width: 20px;
    height: 20px;
    accent-color: var(--lien, var(--accent));
  }

  .vues {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr));
    gap: 0.25rem 0.75rem;
  }

  .erreur {
    margin: 0;
    color: var(--etat-erreur);
  }

  .boutons {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    padding-top: 0.75rem;
    border-top: 1px solid var(--bordure);
  }

  button {
    min-height: 44px;
    padding: 0 1.1rem;
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
</style>
