<script lang="ts">
  // Paramètres d'une épreuve (US-032), page réservée : droits des arbitres et des tireurs, correction d'un score et
  // affichage « Prénom N. », écrits dans le journal local (donc aussi hors ligne) et envoyés ensuite. Sur un PC qui n'est
  // pas le pilote, ou une fois l’épreuve archivée, ils sont en lecture seule. Ils sont seulement enregistrés ici :
  // la saisie smartphone (E5) et l'affichage public (E9) les appliqueront.
  import { onMount } from 'svelte';
  import { CORRECTIONS_SCORE, type Epreuve, type Parametres } from '@poule-position/domaine';
  import AccesQr from '../composants/AccesQr.svelte';
  import GabaritEpreuve from '../composants/GabaritEpreuve.svelte';
  import type { AccesQrClient } from '../lib/acces-qr';
  import type { PresencePilote } from '../lib/presence-pilote';
  import AppareilsConnectes from '../composants/AppareilsConnectes.svelte';
  import type { Accueil } from '../lib/accueil';
  import { modifierParametres, type ErreurModificationParametres } from '../lib/epreuves';
  import { prendreEcriture, type Journal } from '../lib/journal';
  import type { SessionAppareil } from '../lib/stockage';
  import type { Synchronisation } from '../lib/synchronisation';
  import { textes } from '../lib/textes';

  interface Proprietes {
    session: SessionAppareil;
    epreuveId: string;
    journal: Journal;
    synchronisation: Synchronisation;
    /** US-054 : hiérarchie du club pour le fil d'Ariane. */
    accueil: Accueil;
    /** US-096 : jetons des QR codes. */
    acces: AccesQrClient;
    /** US-105 : appareils connectés (liste et exclusion). */
    presence: PresencePilote;
    naviguer: (chemin: string) => void;
  }

  let { session, epreuveId, journal, synchronisation, accueil, acces, presence, naviguer }: Proprietes = $props();

  const t = textes.epreuves;
  const tp = t.parametresPage;

  let epreuve = $state<Epreuve | null>(null);
  let chargee = $state(false);
  let pilote = $state(false);
  /** Faux si un autre onglet détient déjà l'écriture de cette épreuve. */
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
  const archivee = $derived(epreuve?.statut === 'archivee');
  const lectureSeule = $derived(!pilote || !ecriture || archivee);

  /** Relit le journal ; la saisie n'est remplacée que sur demande, pour ne pas écraser ce que le pilote coche. */
  async function recharger(remettreSaisie = false) {
    const { epreuve: lue } = await journal.lire(epreuveId);
    epreuve = lue;
    if (lue && remettreSaisie) Object.assign(saisie, { ...lue.parametres });
    enAttente = pilote ? await synchronisation.enAttente(epreuveId) : 0;
  }

  onMount(() => {
    let liberer: (() => void) | null = null;
    let demonte = false;
    const surEnLigne = () => void synchronisation.envoyer(epreuveId).then(() => recharger());
    // US-029 CA-2 : un autre PC a pris la main, les paramètres passent en lecture seule.
    const arreterPerte = synchronisation.surPerte(({ epreuveId: id }) => {
      if (id !== epreuveId) return;
      pilote = false;
      liberer?.();
      void recharger(true);
    });

    void (async () => {
      // Sur un autre PC, la copie du pilote est téléchargée (hors ligne : la dernière copie gardée).
      await synchronisation.telechargerCopie(epreuveId);
      pilote = (await journal.etat(epreuveId))?.pilote ?? false;
      if (pilote) {
        liberer = await prendreEcriture(epreuveId);
        if (demonte) liberer?.();
        ecriture = liberer !== null;
        window.addEventListener('online', surEnLigne);
      }
      await recharger(true);
      chargee = true;
      if (pilote) void synchronisation.envoyer(epreuveId).then(() => recharger());
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
    if (enCours || lectureSeule || !epreuve) return;
    enCours = true;
    erreur = null;
    enregistre = false;
    try {
      const resultat = await modifierParametres(journal, epreuveId, $state.snapshot(saisie), {
        clubId: session.compte.clubId,
        auteur: session.compte.email,
      });
      if (!resultat.ok) erreur = resultat.erreur;
      await recharger(true);
      if (resultat.ok) {
        enregistre = true;
        void synchronisation.envoyer(epreuveId).then(() => recharger());
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

{#snippet etape()}
  <h2 class="titre-etape">{tp.titre}</h2>

  {#if !chargee}
    <p role="status">{t.chargement}</p>
  {:else if !epreuve}
    <p class="message" role="alert">{t.introuvable}</p>
  {:else}
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
    <!-- US-096 (planche 21) : l'accès par QR code, en tête des paramètres. -->
    <AccesQr
      {epreuve}
      {acces}
      pilote={pilote && ecriture}
      contexte={{ clubId: session.compte.clubId, auteur: session.compte.email }}
      apresEcriture={() => void synchronisation.envoyer(epreuveId).then(() => recharger())}
      {naviguer}
    />

    <!-- US-105 (planche 21) : les appareils connectés, sous l'accès par QR code. -->
    <AppareilsConnectes
      {epreuveId}
      dames={epreuve.sexe === 'dames'}
      {journal}
      {presence}
      pilote={pilote && ecriture && !archivee}
      contexte={{ clubId: session.compte.clubId, auteur: session.compte.email }}
      apresEcriture={() => void synchronisation.envoyer(epreuveId).then(() => recharger())}
    />

    <p class="mention" role="note">{tp.mention}</p>

    <form onsubmit={enregistrer} novalidate>
      <!-- US-096 (planche 21) : les réglages en cartes, sous l'accès par QR code. -->
      <section class="carte" aria-labelledby="titre-droits">
        <h3 id="titre-droits">{tp.droits}</h3>
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
      </section>
      <section class="carte" aria-labelledby="titre-affichage">
        <h3 id="titre-affichage">{tp.affichage}</h3>
        <fieldset>
          <legend class="invisible">{tp.affichage}</legend>
          <label class="case">
            <input type="checkbox" bind:checked={saisie.prenomInitiale} disabled={lectureSeule || enCours} />
            {tp.reglages.prenomInitiale}
          </label>
        </fieldset>
      </section>

      {#if erreur}<p class="message" role="alert">{texteErreur(erreur)}</p>{/if}
      {#if enregistre}<p class="succes" role="status">{tp.enregistre}</p>{/if}
      {#if !lectureSeule}
        <button type="submit" class="neutre" disabled={enCours}>{tp.enregistrer}</button>
      {/if}
    </form>
  {/if}
{/snippet}

{#if epreuve}
  <GabaritEpreuve {accueil} {epreuve} courante="parametres" suite={tp.titre} {naviguer}>
    <div class="etape">{@render etape()}</div>
  </GabaritEpreuve>
{:else}
  <main>{@render etape()}</main>
{/if}

<style>
  main {
    display: grid;
    justify-items: center;
    gap: 1.25rem;
    padding: 3rem 1rem;
  }

  .etape {
    display: grid;
    justify-items: center;
    gap: 1.25rem;
  }

  h2 {
    margin: 0;
    font-size: 1.15rem;
    text-align: center;
  }

  form {
    display: grid;
    gap: 1.25rem;
    width: 100%;
  }

  /* US-096 (planche 21) : une carte par groupe de réglages. */
  .carte {
    display: grid;
    gap: 1rem;
    padding: 1.25rem;
    border: 1px solid var(--bordure);
    border-radius: 14px;
    background: var(--surface);
  }

  .carte h3 {
    margin: 0;
    font-size: 1.25rem;
  }

  .invisible {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
  }

  .etape {
    width: 100%;
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

  /* Action neutre : l'action principale de la page est « Imprimer les QR codes » (principe 3). */
  button.neutre {
    justify-self: end;
    min-height: 44px;
    padding: 0 1.1rem;
    border: 1px solid var(--bordure-champ);
    border-radius: var(--rayon);
    background: var(--surface);
    color: var(--texte);
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
