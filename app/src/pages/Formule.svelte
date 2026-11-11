<script lang="ts">
  // Formule d'une épreuve (US-028), page réservée : réglage des touches et du match pour la 3e place, écrit dans le
  // journal local (donc aussi hors ligne) et envoyé ensuite ; historique des changements tiré du journal. Sur un PC qui
  // n'est pas le pilote, ou une fois l’épreuve terminée ou archivée, la formule est en lecture seule.
  import { onMount } from 'svelte';
  import {
    historiqueFormule,
    TOUCHES_POULES_MAX,
    TOUCHES_POULES_MIN,
    TOUCHES_TABLEAU,
    type Epreuve,
    type EntreeHistoriqueFormule,
    type ModificationFormule,
  } from '@poule-position/domaine';
  import Lien from '../composants/Lien.svelte';
  import FilEpreuve from '../composants/FilEpreuve.svelte';
  import type { Accueil } from '../lib/accueil';
  import { confirmationFormule, modifierFormule, type ErreurModificationFormule } from '../lib/epreuves';
  import { prendreEcriture, type Journal } from '../lib/journal';
  import { cheminEpreuve } from '../lib/routes';
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
    /**
     * US-028 CA-4 : matchs déjà joués, annoncés avant de changer la formule d'une épreuve en cours. Aucun match
     * n'existe tant que les poules et le tableau ne sont pas saisis (E4, E6).
     */
    matchsJoues?: number;
    naviguer: (chemin: string) => void;
  }

  let { session, epreuveId, journal, synchronisation, accueil, matchsJoues = 0, naviguer }: Proprietes = $props();

  const t = textes.epreuves;
  const tf = t.formulePage;

  let epreuve = $state<Epreuve | null>(null);
  let historique: EntreeHistoriqueFormule[] = $state([]);
  let chargee = $state(false);
  let pilote = $state(false);
  /** Faux si un autre onglet détient déjà l'écriture de cette épreuve. */
  let ecriture = $state(true);
  let enAttente = $state(0);
  let enCours = $state(false);
  let erreur: ErreurModificationFormule | null = $state(null);
  /** CA-4 : la confirmation demandée est affichée et attend le choix du pilote. */
  let aConfirmer: string | null = $state(null);

  const saisie = $state({ touchesPoules: 5, touchesTableau: 15, matchTroisieme: false });
  const figee = $derived(epreuve?.statut === 'terminee' || epreuve?.statut === 'archivee');
  const lectureSeule = $derived(!pilote || !ecriture || figee);

  /** Relit le journal ; la saisie n'est remplacée que sur demande, pour ne pas écraser ce que le pilote tape. */
  async function recharger(remettreSaisie = false) {
    const { epreuve: lue } = await journal.lire(epreuveId);
    epreuve = lue;
    if (lue && remettreSaisie) Object.assign(saisie, { ...lue.formule });
    historique = historiqueFormule(await journal.evenements(epreuveId));
    enAttente = pilote ? await synchronisation.enAttente(epreuveId) : 0;
  }

  onMount(() => {
    let liberer: (() => void) | null = null;
    let demonte = false;
    const surEnLigne = () => void synchronisation.envoyer(epreuveId).then(() => recharger());
    // US-029 CA-2 : un autre PC a pris la main, la formule passe en lecture seule.
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

  /** CA-4 : en cours d’épreuve, le pilote confirme avant que la formule change. */
  async function enregistrer(evenement: SubmitEvent) {
    evenement.preventDefault();
    if (enCours || lectureSeule || !epreuve) return;
    const confirmation = aConfirmer === null ? confirmationFormule(epreuve.statut, matchsJoues) : null;
    if (confirmation !== null) {
      aConfirmer = confirmation;
      return;
    }
    enCours = true;
    erreur = null;
    try {
      const resultat = await modifierFormule(
        journal,
        epreuveId,
        { ...epreuve.formule, ...$state.snapshot(saisie) },
        { clubId: session.compte.clubId, auteur: session.compte.email },
      );
      if (!resultat.ok) erreur = resultat.erreur;
      aConfirmer = null;
      await recharger(true);
      if (resultat.ok) void synchronisation.envoyer(epreuveId).then(() => recharger());
    } finally {
      enCours = false;
    }
  }

  const texteErreur = (code: ErreurModificationFormule) =>
    code in tf.erreurs ? tf.erreurs[code as keyof typeof tf.erreurs] : t.erreurs[code as keyof typeof t.erreurs];

  const decrire = (changements: ModificationFormule) =>
    [
      changements.touchesPoules !== undefined ? tf.changement.touchesPoules(changements.touchesPoules) : null,
      changements.touchesTableau !== undefined ? tf.changement.touchesTableau(changements.touchesTableau) : null,
      changements.matchTroisieme !== undefined ? tf.changement.matchTroisieme(changements.matchTroisieme) : null,
    ]
      .filter((texte) => texte !== null)
      .join(' · ');
</script>

<main>
  {#if epreuve}<FilEpreuve {accueil} {epreuve} suite={tf.titre} {naviguer} />{/if}
  <h1>{tf.titre}</h1>

  {#if !chargee}
    <p role="status">{t.chargement}</p>
  {:else if !epreuve}
    <p class="message" role="alert">{t.introuvable}</p>
  {:else}
    <h2>{epreuve.nom}</h2>
    <p class="resume">
      {t.formule(epreuve.formule.touchesPoules, epreuve.formule.touchesTableau, epreuve.formule.matchTroisieme)}
    </p>
    {#if epreuve.formule.touchesRelais !== null}
      <p class="resume">{tf.relaisFixe(epreuve.formule.touchesRelais)}</p>
    {/if}

    {#if !pilote}
      <p class="avertissement" role="status">{t.lectureSeule}</p>
    {:else if !ecriture}
      <p class="avertissement" role="status">{t.autreOnglet}</p>
    {:else if figee}
      <p class="avertissement" role="status">{tf.erreurs.FORMULE_FIGEE}</p>
    {/if}
    {#if pilote && enAttente > 0}
      <p class="avertissement" role="status">{t.enAttente(enAttente)}</p>
    {/if}

    <form onsubmit={enregistrer} novalidate>
      <div class="champ">
        <label for="touches-poules">{tf.touchesPoules}</label>
        <input
          id="touches-poules"
          type="number"
          inputmode="numeric"
          min={TOUCHES_POULES_MIN}
          max={TOUCHES_POULES_MAX}
          bind:value={saisie.touchesPoules}
          disabled={lectureSeule || enCours}
        />
      </div>
      <div class="champ">
        <label for="touches-tableau">{tf.touchesTableau}</label>
        <select id="touches-tableau" bind:value={saisie.touchesTableau} disabled={lectureSeule || enCours}>
          {#each TOUCHES_TABLEAU as touches (touches)}
            <option value={touches}>{touches}</option>
          {/each}
        </select>
      </div>
      <label class="case">
        <input type="checkbox" bind:checked={saisie.matchTroisieme} disabled={lectureSeule || enCours} />
        {tf.matchTroisieme}
      </label>

      {#if aConfirmer}<p class="avertissement" role="alert">{aConfirmer}</p>{/if}
      {#if erreur}<p class="message" role="alert">{texteErreur(erreur)}</p>{/if}
      {#if !lectureSeule}
        <button type="submit" disabled={enCours}>{aConfirmer ? tf.confirmer : tf.enregistrer}</button>
      {/if}
    </form>

    <p class="resume">{tf.autresFormules}</p>

    <section>
      <h2>{tf.historique}</h2>
      {#if historique.length === 0}
        <p>{tf.historiqueVide}</p>
      {:else}
        <ol>
          {#each historique as entree (entree.seq)}
            <li>{tf.le(entree.date)} · {entree.auteur} · {decrire(entree.changements)}</li>
          {/each}
        </ol>
      {/if}
    </section>
  {/if}

  <Lien chemin={cheminEpreuve(epreuveId)} {naviguer}>{tf.retour}</Lien>
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

  form,
  section {
    display: grid;
    gap: 1.1rem;
    width: min(100%, 32rem);
  }

  section {
    gap: 0.5rem;
  }

  ol {
    display: grid;
    gap: 0.4rem;
    margin: 0;
    padding-left: 1.25rem;
  }

  .champ {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 0.3rem;
  }

  label {
    font-weight: 600;
  }

  .case {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  input[type='number'],
  select {
    max-width: 100%;
    padding: 0.6rem 0.75rem;
    border: 1px solid var(--bordure-champ);
    border-radius: var(--rayon);
    background: var(--fond);
    color: var(--texte);
    font: inherit;
  }

  .resume {
    margin: 0;
    text-align: center;
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
  .avertissement {
    margin: 0;
    padding: 0.6rem 0.75rem;
    border-left: 4px solid var(--etat-erreur);
    background: var(--surface);
  }

  .avertissement {
    border-left-color: var(--etat-attente);
  }
</style>
