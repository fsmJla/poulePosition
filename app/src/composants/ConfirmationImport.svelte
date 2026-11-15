<script lang="ts">
  // Résumé et confirmation de l'import d'une épreuve (US-035 CA-1), en fenêtre modale : Échap ou « Annuler » la ferme (sauf
  // pendant l'écriture). Un fichier refusé (CA-4) n'affiche que sa raison. Des journaux qui divergent proposent l'import
  // comme nouvelle épreuve ; un fichier que l'appareil a déjà n'a rien à confirmer.
  import { onMount } from 'svelte';
  import type { ErreurImport, ResumeImport } from '../lib/import-sauvegarde';
  import { textes } from '../lib/textes';

  interface Proprietes {
    /** Le fichier examiné : son résumé, ou la raison de son refus. */
    examen: { ok: true; resume: ResumeImport } | { ok: false; erreur: ErreurImport };
    /** Lance l'import (`copie` : comme nouvelle épreuve) ; renvoie l'erreur à afficher, ou null si c'est fait. */
    valider: (copie: boolean) => Promise<ErreurImport | null>;
    /** Appelé quand la fenêtre se ferme. */
    fermer: () => void;
  }

  let { examen, valider, fermer }: Proprietes = $props();

  const t = textes.importation;
  let dialogue: HTMLDialogElement | undefined = $state();
  let enCours = $state(false);
  let erreur: ErreurImport | null = $state(null);

  onMount(() => dialogue?.showModal());

  const resume = $derived(examen.ok ? examen.resume : null);

  async function confirmer(copie: boolean) {
    if (enCours) return;
    enCours = true;
    erreur = null;
    erreur = await valider(copie);
    enCours = false;
  }

  function annuler() {
    if (!enCours) fermer();
  }
</script>

<dialog
  bind:this={dialogue}
  aria-labelledby="titre-import"
  oncancel={(evenement) => {
    evenement.preventDefault();
    annuler();
  }}
>
  <h2 id="titre-import">{t.titre}</h2>

  {#if !examen.ok}
    <p class="erreur" role="alert">{t.erreurs[examen.erreur]}</p>
  {:else if resume}
    <dl>
      <dt>{t.resume.nom}</dt>
      <dd>{resume.nom}</dd>
      {#if resume.date}
        <dt>{t.resume.date}</dt>
        <dd>{t.resume.dateEpreuve(resume.date)}</dd>
      {/if}
      <dt>{t.resume.evenements}</dt>
      <dd>{resume.evenements}</dd>
      <dt>{t.resume.exporteLe}</dt>
      <dd>{t.resume.dateExport(resume.exporteLe)}</dd>
      {#if resume.fichiers > 0}
        <dt>{t.resume.fichiers}</dt>
        <dd>{resume.fichiers}</dd>
      {/if}
    </dl>
    <p data-plan={resume.plan}>
      {#if resume.plan === 'nouvelle'}{t.plans.nouvelle}
      {:else if resume.plan === 'prolonge'}{t.plans.prolonge(resume.ajouts)}
      {:else if resume.plan === 'a-jour'}{t.plans.aJour}
      {:else}{t.plans.divergent}{/if}
    </p>
    {#if resume.plan === 'nouvelle' || resume.plan === 'prolonge'}
      <p class="discret">{t.rappelEnLigne}</p>
    {/if}
  {/if}

  {#if erreur}<p class="erreur" role="alert">{t.erreurs[erreur]}</p>{/if}

  <div class="boutons">
    {#if resume && (resume.plan === 'nouvelle' || resume.plan === 'prolonge')}
      <button type="button" onclick={() => confirmer(false)} disabled={enCours}
        >{enCours ? t.boutons.enCours : t.boutons.importer}</button
      >
      <button type="button" class="secondaire" onclick={annuler} disabled={enCours}>{t.boutons.annuler}</button>
    {:else if resume?.plan === 'divergent'}
      <button type="button" onclick={() => confirmer(true)} disabled={enCours}
        >{enCours ? t.boutons.enCours : t.boutons.commeNouvelle}</button
      >
      <button type="button" class="secondaire" onclick={annuler} disabled={enCours}>{t.boutons.annuler}</button>
    {:else}
      <button type="button" class="secondaire" onclick={annuler}>{t.boutons.fermer}</button>
    {/if}
  </div>
</dialog>

<style>
  dialog {
    width: min(32rem, calc(100% - 2rem));
    max-height: calc(100% - 2rem);
    padding: 1.25rem;
    overflow-y: auto;
    border: 1px solid var(--bordure);
    border-radius: var(--rayon);
    background: var(--fond);
    box-shadow: var(--ombre-flottante);
    color: var(--texte);
  }

  dialog::backdrop {
    background: var(--voile);
  }

  dialog[open] {
    display: grid;
    gap: 0.75rem;
  }

  h2 {
    margin: 0;
    font-size: 1.15rem;
  }

  p {
    margin: 0;
  }

  dl {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 0.35rem 1rem;
    margin: 0;
  }

  dt {
    color: var(--texte-discret);
  }

  dd {
    margin: 0;
    overflow-wrap: anywhere;
  }

  .discret {
    color: var(--texte-discret);
    font-size: 0.9rem;
  }

  .erreur {
    color: var(--etat-erreur);
  }

  .boutons {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 0.75rem;
  }

  button {
    min-height: 2.75rem;
    padding: 0.5rem 0.9rem;
    border: none;
    border-radius: var(--rayon);
    background: var(--accent-fond);
    color: var(--sur-accent);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }

  button.secondaire {
    border: 1px solid var(--bordure-champ);
    background: var(--surface);
    color: var(--texte);
    font-weight: 400;
  }

  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
