<script lang="ts">
  // Fenêtre « Nouvelle équipe » ou « Modifier l'équipe » (US-146 CA-2 à CA-4, planche 40 bis) : nom proposé d'après le
  // club du premier tireur choisi, puis chaque tireur sans équipe marqué « Titulaire » ou « Remplaçant ». Une fois les
  // équipes figées (poules lancées ou tableau créé), seul le remplaçant se change. « Enregistrer » est l'action principale.
  import { onMount } from 'svelte';
  import {
    clubEquipe,
    equipeDuTireur,
    equipesDe,
    sommeClassements,
    tailleEquipe,
    tireursDe,
    trierTireurs,
    type Epreuve,
    type Equipe,
  } from '@poule-position/domaine';
  import { nomPropose, type ChampsEquipe } from '../lib/equipes';
  import { textes } from '../lib/textes';

  interface Proprietes {
    epreuve: Epreuve;
    /** L'équipe modifiée, ou null pour une nouvelle équipe. */
    equipe: Equipe | null;
    /** Seul le remplaçant se change (US-146 CA-4). */
    figee: boolean;
    /** Enregistre ; renvoie le message d'erreur à afficher, ou null si c'est fait. */
    enregistrer: (champs: ChampsEquipe) => Promise<string | null>;
    fermer: () => void;
  }

  let { epreuve, equipe, figee, enregistrer, fermer }: Proprietes = $props();
  const t = textes.equipes;
  const tf = t.fenetre;

  let dialogue: HTMLDialogElement | undefined = $state();
  let nom = $state('');
  /** Le nom a été tapé : il n'est plus proposé d'après le club. */
  let nomTouche = $state(false);
  let titulaires = $state<string[]>([]);
  let remplacant = $state<string | null>(null);
  let erreur: string | null = $state(null);
  let enCours = $state(false);

  const taille = $derived(tailleEquipe(epreuve.typeEpreuve));
  const tireurs = $derived(tireursDe(epreuve));
  /** Les tireurs proposés : sans équipe, plus ceux de l'équipe modifiée. */
  const proposes = $derived(
    trierTireurs(tireurs).filter((tireur) => {
      const sienne = equipeDuTireur(equipesDe(epreuve), tireur.id);
      return sienne === null || sienne.id === equipe?.id;
    }),
  );
  const bilan = $derived(
    tf.bilan(
      titulaires.length,
      taille,
      remplacant !== null,
      sommeClassements({ titulaires }, tireurs),
      clubEquipe({ titulaires, remplacant }, tireurs),
    ),
  );

  onMount(() => {
    nom = equipe?.nom ?? '';
    nomTouche = equipe !== null;
    titulaires = [...(equipe?.titulaires ?? [])];
    remplacant = equipe?.remplacant ?? null;
    dialogue?.showModal();
  });

  function role(id: string): 'titulaire' | 'remplacant' | null {
    if (titulaires.includes(id)) return 'titulaire';
    return remplacant === id ? 'remplacant' : null;
  }

  function choisir(id: string, voulu: 'titulaire' | 'remplacant') {
    const actuel = role(id);
    titulaires = titulaires.filter((t) => t !== id);
    if (remplacant === id) remplacant = null;
    if (actuel === voulu) return;
    if (voulu === 'titulaire') titulaires = [...titulaires, id];
    else remplacant = id;
    if (!nomTouche && titulaires.length > 0) {
      nom = nomPropose(
        epreuve,
        tireurs.find(({ id: tid }) => tid === titulaires[0]),
      );
    }
  }

  async function valider(evenement: SubmitEvent) {
    evenement.preventDefault();
    if (enCours) return;
    enCours = true;
    erreur = await enregistrer({ nom, titulaires, remplacant });
    enCours = false;
    if (erreur === null) fermer();
  }
</script>

<dialog
  bind:this={dialogue}
  aria-labelledby="titre-equipe"
  oncancel={(evenement) => {
    evenement.preventDefault();
    if (!enCours) fermer();
  }}
>
  <form onsubmit={valider}>
    <h2 id="titre-equipe">{equipe ? t.modifier(equipe.nom) : tf.titreNouvelle}</h2>

    <label class="champ">
      {tf.nom}
      <input type="text" bind:value={nom} oninput={() => (nomTouche = true)} maxlength="60" disabled={figee} required />
      <span class="aide">{tf.nomAide}</span>
    </label>

    <fieldset>
      <legend>{tf.tireurs(taille)}</legend>
      {#each proposes as tireur (tireur.id)}
        {@const choisi = role(tireur.id)}
        {@const libelle = `${tireur.nom.toUpperCase()} ${tireur.prenom}`}
        <div class="tireur" class:choisi={choisi !== null}>
          <span
            ><strong>{tireur.nom.toUpperCase()}</strong>
            {tireur.prenom}
            <span class="aide">· {tireur.club} · {tireur.classement ?? t.nonClasse}</span></span
          >
          <span class="roles" role="group" aria-label={tf.role(libelle)}>
            <button
              type="button"
              aria-pressed={choisi === 'titulaire'}
              disabled={figee || enCours || (choisi !== 'titulaire' && titulaires.length >= taille)}
              onclick={() => choisir(tireur.id, 'titulaire')}>{t.titulaire}</button
            >
            <button
              type="button"
              aria-pressed={choisi === 'remplacant'}
              disabled={enCours || (figee && choisi === 'titulaire')}
              onclick={() => choisir(tireur.id, 'remplacant')}>{t.remplacant}</button
            >
          </span>
        </div>
      {:else}
        <p class="aide">{tf.aucunLibre}</p>
      {/each}
    </fieldset>

    <p class="bilan" role="status">{bilan}</p>
    {#if erreur}<p class="erreur" role="alert">{erreur}</p>{/if}

    <div class="boutons">
      <button type="submit" class="principal" disabled={enCours}>{equipe ? tf.enregistrer : tf.creer}</button>
      <button type="button" class="secondaire" disabled={enCours} onclick={fermer}>{tf.annuler}</button>
    </div>
  </form>
</dialog>

<style>
  dialog {
    width: min(42rem, calc(100% - 2rem));
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
    gap: 1.1rem;
  }

  h2 {
    margin: 0;
    font-family: var(--police-titre);
    font-size: 1.6rem;
  }

  .champ {
    display: grid;
    gap: 0.4rem;
    font-weight: 600;
  }

  input[type='text'] {
    min-height: 44px;
    padding: 0 0.75rem;
    border: 1px solid var(--bordure-champ);
    border-radius: var(--rayon);
    background: var(--surface);
    color: var(--texte);
    font: inherit;
    font-weight: 400;
  }

  fieldset {
    display: grid;
    gap: 0.5rem;
    margin: 0;
    padding: 0;
    border: none;
  }

  legend {
    margin-bottom: 0.5rem;
    font-weight: 600;
  }

  .tireur {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem 1rem;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--bordure);
    border-radius: var(--rayon);
    background: var(--surface);
  }

  .tireur.choisi {
    border-color: var(--accent);
  }

  .roles {
    display: flex;
    gap: 0.35rem;
  }

  .roles button {
    min-height: 36px;
    padding: 0 0.8rem;
    border: 1px solid var(--bordure);
    border-radius: 999px;
    background: var(--surface);
    color: var(--texte);
    font: inherit;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
  }

  .roles button[aria-pressed='true'] {
    border-color: var(--texte);
    background: var(--texte);
    color: var(--fond);
  }

  .roles button:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }

  .aide {
    color: var(--texte-discret);
    font-size: 0.9rem;
    font-weight: 400;
  }

  .bilan {
    margin: 0;
    font-weight: 600;
  }

  .erreur {
    margin: 0;
    color: var(--etat-erreur);
  }

  .boutons {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
</style>
