<script lang="ts">
  // Page d'une compétition (US-025 CA-2), réservée : ses informations, son statut, sa publication et son pilote. Sur
  // le PC pilote, l'écriture est réservée à un seul onglet (US-021) et les modifications en attente d'envoi sont
  // comptées (US-022) ; sur un autre PC, c'est une copie en lecture seule, datée.
  import { onMount } from 'svelte';
  import type { Competition } from '@poule-position/domaine';
  import Lien from '../composants/Lien.svelte';
  import { prendreEcriture, type Journal } from '../lib/journal';
  import { CHEMINS } from '../lib/routes';
  import type { Synchronisation } from '../lib/synchronisation';
  import { textes } from '../lib/textes';

  interface Proprietes {
    competitionId: string;
    journal: Journal;
    synchronisation: Synchronisation;
    naviguer: (chemin: string) => void;
  }

  let { competitionId, journal, synchronisation, naviguer }: Proprietes = $props();

  const t = textes.competitions;

  let competition: Competition | null = $state(null);
  let chargee = $state(false);
  let pilote = $state(false);
  let copieLe: number | null = $state(null);
  /** Faux si un autre onglet détient déjà l'écriture de cette compétition. */
  let ecriture = $state(true);
  let enAttente = $state(0);
  let jamaisEnvoyee = $state(false);

  async function compterEnAttente() {
    enAttente = await synchronisation.enAttente(competitionId);
    jamaisEnvoyee = await synchronisation.jamaisEnvoyee(competitionId);
  }

  /** Envoie ce qui attend (sans effet hors ligne), puis met l'indicateur à jour. */
  async function envoyer() {
    await synchronisation.envoyer(competitionId);
    await compterEnAttente();
  }

  onMount(() => {
    let liberer: (() => void) | null = null;
    let demonte = false;
    const surEnLigne = () => void envoyer();

    void (async () => {
      const resultat = await synchronisation.telechargerCopie(competitionId);
      const copie = resultat.ok ? resultat : resultat.copie;
      competition = copie?.projection.competition ?? null;
      copieLe = copie?.copieLe ?? null;
      pilote = (await journal.etat(competitionId))?.pilote ?? false;
      if (pilote) {
        liberer = await prendreEcriture(competitionId);
        if (demonte) liberer?.();
        ecriture = liberer !== null;
        await compterEnAttente();
        window.addEventListener('online', surEnLigne);
        void envoyer();
      }
      chargee = true;
    })();

    return () => {
      demonte = true;
      liberer?.();
      window.removeEventListener('online', surEnLigne);
    };
  });
</script>

<main>
  {#if !chargee}
    <p role="status">{t.chargement}</p>
  {:else if !competition}
    <p class="message" role="alert">{t.introuvable}</p>
  {:else}
    <h1>{competition.nom}</h1>
    <ul class="etiquettes">
      <li>{t.statuts[competition.statut]}</li>
      <li>{competition.publiee ? t.publiee : t.nonPubliee}</li>
      {#if pilote}<li class="pilote">{t.pilote}</li>{/if}
    </ul>

    {#if !pilote}
      <p class="avertissement" role="status">
        {t.lectureSeule}{#if copieLe !== null}<br />{t.copieDu(copieLe)}{/if}
      </p>
    {:else if !ecriture}
      <p class="avertissement" role="status">{t.autreOnglet}</p>
    {/if}
    {#if pilote && enAttente > 0}
      <p class="envoi" role="status">
        {jamaisEnvoyee ? `${t.enAttente(enAttente)} · ${t.pasEncoreEnvoyee}` : t.enAttente(enAttente)}
      </p>
    {/if}

    <dl>
      <dt>{t.arme}</dt>
      <dd>{t.armes[competition.arme]}</dd>
      <dt>{t.type}</dt>
      <dd>{t.types[competition.typeCompetition]}</dd>
      {#if competition.categorie}
        <dt>{t.categorie}</dt>
        <dd>{competition.categorie}</dd>
      {/if}
      {#if competition.sexe}
        <dt>{t.sexe}</dt>
        <dd>{t.sexes[competition.sexe]}</dd>
      {/if}
      {#if competition.date}
        <dt>{t.date}</dt>
        <dd>{t.dateLongue(competition.date)}</dd>
      {/if}
      {#each ['appel', 'scratch', 'debutPoules'] as const as champ (champ)}
        {#if competition.horaires[champ]}
          <dt>{t[champ]}</dt>
          <dd>{competition.horaires[champ]}</dd>
        {/if}
      {/each}
      {#if competition.lieu}
        <dt>{t.lieu}</dt>
        <dd>{competition.lieu}</dd>
      {/if}
      {#if competition.commentaire}
        <dt>{t.commentaire}</dt>
        <dd class="commentaire">{competition.commentaire}</dd>
      {/if}
      <dt>{t.formuleTitre}</dt>
      <dd>
        {competition.formule.touchesRelais === null
          ? t.formule(competition.formule.touchesPoules, competition.formule.touchesTableau)
          : t.relais(competition.formule.touchesRelais)}
      </dd>
    </dl>
  {/if}

  <Lien chemin={CHEMINS.organisateur} {naviguer}>{t.retour}</Lien>
</main>

<style>
  main {
    display: grid;
    justify-items: center;
    gap: 1.25rem;
    padding: 3rem 1rem;
  }

  h1 {
    margin: 0;
    text-align: center;
  }

  .etiquettes {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.5rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .etiquettes li {
    padding: 0.2rem 0.8rem;
    border-radius: 999px;
    background: var(--surface);
    color: var(--texte-discret);
  }

  .etiquettes .pilote {
    background: var(--accent-fond);
    color: var(--sur-accent);
  }

  dl {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 0.4rem 1.25rem;
    width: min(100%, 32rem);
    margin: 0;
  }

  dt {
    font-weight: 600;
  }

  dd {
    margin: 0;
    overflow-wrap: anywhere;
  }

  .commentaire {
    white-space: pre-line;
  }

  .avertissement,
  .envoi,
  .message {
    margin: 0;
    padding: 0.6rem 0.75rem;
    background: var(--surface);
  }

  .avertissement,
  .envoi {
    border-left: 4px solid var(--etat-attente);
  }

  .message {
    border-left: 4px solid var(--etat-erreur);
  }
</style>
