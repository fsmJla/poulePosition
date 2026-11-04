<script lang="ts">
  // Paramètres d'une compétition (US-032), page réservée : droits des arbitres et des tireurs, correction d'un score et
  // affichage « Prénom N. », écrits dans le journal local (donc aussi hors ligne) et envoyés ensuite. Sur un PC qui n'est
  // pas le pilote, ou une fois la compétition archivée, ils sont en lecture seule. Ils sont seulement enregistrés ici :
  // la saisie smartphone (E5) et l'affichage public (E9) les appliqueront.
  import { onMount } from 'svelte';
  import { CORRECTIONS_SCORE, type Competition, type Parametres } from '@poule-position/domaine';
  import Lien from '../composants/Lien.svelte';
  import { modifierParametres, type ErreurModificationParametres } from '../lib/competitions';
  import { prendreEcriture, type Journal } from '../lib/journal';
  import { cheminCompetition } from '../lib/routes';
  import type { SessionAppareil } from '../lib/stockage';
  import type { Synchronisation } from '../lib/synchronisation';
  import { textes } from '../lib/textes';

  interface Proprietes {
    session: SessionAppareil;
    competitionId: string;
    journal: Journal;
    synchronisation: Synchronisation;
    naviguer: (chemin: string) => void;
  }

  let { session, competitionId, journal, synchronisation, naviguer }: Proprietes = $props();

  const t = textes.competitions;
  const tp = t.parametresPage;

  let competition = $state<Competition | null>(null);
  let chargee = $state(false);
  let pilote = $state(false);
  /** Faux si un autre onglet détient déjà l'écriture de cette compétition. */
  let ecriture = $state(true);
  let enAttente = $state(0);
  let enCours = $state(false);
  let enregistre = $state(false);
  let erreur: ErreurModificationParametres | null = $state(null);

  const saisie: Parametres = $state({
    arbitreSaisitScores: true,
    arbitreDeplace: true,
    tireurSaisitPoule: true,
    tireurSaisitTableau: true,
    correctionScore: 'arbitre',
    prenomInitiale: false,
  });
  const archivee = $derived(competition?.statut === 'archivee');
  const lectureSeule = $derived(!pilote || !ecriture || archivee);

  /** Relit le journal ; la saisie n'est remplacée que sur demande, pour ne pas écraser ce que le pilote coche. */
  async function recharger(remettreSaisie = false) {
    const { competition: lue } = await journal.lire(competitionId);
    competition = lue;
    if (lue && remettreSaisie) Object.assign(saisie, { ...lue.parametres });
    enAttente = pilote ? await synchronisation.enAttente(competitionId) : 0;
  }

  onMount(() => {
    let liberer: (() => void) | null = null;
    let demonte = false;
    const surEnLigne = () => void synchronisation.envoyer(competitionId).then(() => recharger());
    // US-029 CA-2 : un autre PC a pris la main, les paramètres passent en lecture seule.
    const arreterPerte = synchronisation.surPerte(({ competitionId: id }) => {
      if (id !== competitionId) return;
      pilote = false;
      liberer?.();
      void recharger(true);
    });

    void (async () => {
      // Sur un autre PC, la copie du pilote est téléchargée (hors ligne : la dernière copie gardée).
      await synchronisation.telechargerCopie(competitionId);
      pilote = (await journal.etat(competitionId))?.pilote ?? false;
      if (pilote) {
        liberer = await prendreEcriture(competitionId);
        if (demonte) liberer?.();
        ecriture = liberer !== null;
        window.addEventListener('online', surEnLigne);
      }
      await recharger(true);
      chargee = true;
      if (pilote) void synchronisation.envoyer(competitionId).then(() => recharger());
    })();

    return () => {
      demonte = true;
      liberer?.();
      arreterPerte();
      window.removeEventListener('online', surEnLigne);
    };
  });

  async function enregistrer(evenement: SubmitEvent) {
    evenement.preventDefault();
    if (enCours || lectureSeule || !competition) return;
    enCours = true;
    erreur = null;
    enregistre = false;
    try {
      const resultat = await modifierParametres(journal, competitionId, $state.snapshot(saisie), {
        clubId: session.compte.clubId,
        auteur: session.compte.email,
      });
      if (!resultat.ok) erreur = resultat.erreur;
      await recharger(true);
      if (resultat.ok) {
        enregistre = true;
        void synchronisation.envoyer(competitionId).then(() => recharger());
      }
    } finally {
      enCours = false;
    }
  }

  const texteErreur = (code: ErreurModificationParametres) =>
    code in tp.erreurs ? tp.erreurs[code as keyof typeof tp.erreurs] : t.erreurs[code as keyof typeof t.erreurs];

  const reglagesArbitre = ['arbitreSaisitScores', 'arbitreDeplace'] as const;
  const reglagesTireur = ['tireurSaisitPoule', 'tireurSaisitTableau'] as const;
</script>

{#snippet casesAcocher(
  reglages: readonly ('arbitreSaisitScores' | 'arbitreDeplace' | 'tireurSaisitPoule' | 'tireurSaisitTableau')[],
)}
  {#each reglages as reglage (reglage)}
    <label class="case">
      <input type="checkbox" bind:checked={saisie[reglage]} disabled={lectureSeule || enCours} />
      {tp.reglages[reglage]}
    </label>
  {/each}
{/snippet}

<main>
  <h1>{tp.titre}</h1>

  {#if !chargee}
    <p role="status">{t.chargement}</p>
  {:else if !competition}
    <p class="message" role="alert">{t.introuvable}</p>
  {:else}
    <h2>{competition.nom}</h2>

    {#if !pilote}
      <p class="avertissement" role="status">{t.lectureSeule}</p>
    {:else if !ecriture}
      <p class="avertissement" role="status">{t.autreOnglet}</p>
    {:else if archivee}
      <p class="avertissement" role="status">{tp.archivee}</p>
    {/if}
    {#if pilote && enAttente > 0}
      <p class="avertissement" role="status">{t.enAttente(enAttente)}</p>
    {/if}
    <p class="mention" role="note">{tp.mention}</p>

    <form onsubmit={enregistrer} novalidate>
      <fieldset>
        <legend>{tp.arbitres}</legend>
        {@render casesAcocher(reglagesArbitre)}
      </fieldset>
      <fieldset>
        <legend>{tp.tireurs}</legend>
        {@render casesAcocher(reglagesTireur)}
      </fieldset>
      <div class="champ">
        <label for="correction-score">{tp.reglages.correctionScore}</label>
        <select id="correction-score" bind:value={saisie.correctionScore} disabled={lectureSeule || enCours}>
          {#each CORRECTIONS_SCORE as valeur (valeur)}
            <option value={valeur}>{tp.corrections[valeur]}</option>
          {/each}
        </select>
      </div>
      <fieldset>
        <legend>{tp.affichage}</legend>
        <label class="case">
          <input type="checkbox" bind:checked={saisie.prenomInitiale} disabled={lectureSeule || enCours} />
          {tp.reglages.prenomInitiale}
        </label>
      </fieldset>

      {#if erreur}<p class="message" role="alert">{texteErreur(erreur)}</p>{/if}
      {#if enregistre}<p class="succes" role="status">{tp.enregistre}</p>{/if}
      {#if !lectureSeule}
        <button type="submit" disabled={enCours}>{tp.enregistrer}</button>
      {/if}
    </form>
  {/if}

  <Lien chemin={cheminCompetition(competitionId)} {naviguer}>{tp.retour}</Lien>
</main>

<style>
  main {
    display: grid;
    justify-items: center;
    gap: 1.25rem;
    padding: 3rem 1rem;
  }

  h1,
  h2 {
    margin: 0;
    text-align: center;
  }

  h2 {
    font-size: 1.15rem;
  }

  form {
    display: grid;
    gap: 1.1rem;
    width: min(100%, 32rem);
  }

  fieldset {
    display: grid;
    gap: 0.5rem;
    margin: 0;
    padding: 0;
    border: none;
  }

  legend {
    padding: 0;
    margin-bottom: 0.4rem;
    font-weight: 600;
  }

  .champ {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 0.3rem;
  }

  .champ label {
    font-weight: 600;
  }

  .case {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  select {
    max-width: 100%;
    padding: 0.6rem 0.75rem;
    border: 1px solid var(--bordure-champ);
    border-radius: var(--rayon);
    background: var(--fond);
    color: var(--texte);
    font: inherit;
  }

  .mention {
    margin: 0;
    max-width: 32rem;
    text-align: center;
    color: var(--texte-discret);
  }

  button {
    padding: 0.7rem;
    border: none;
    border-radius: var(--rayon);
    background: var(--accent-fond);
    color: var(--sur-accent);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }

  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .message,
  .avertissement,
  .succes {
    margin: 0;
    padding: 0.6rem 0.75rem;
    border-left: 4px solid var(--etat-erreur);
    background: var(--surface);
  }

  .avertissement {
    border-left-color: var(--etat-attente);
  }

  .succes {
    border-left-color: var(--accent);
  }
</style>
