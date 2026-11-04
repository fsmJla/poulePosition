<script lang="ts">
  // Page d'une compétition (US-025 CA-2), réservée : ses informations, son statut, sa publication et son pilote. Sur
  // le PC pilote, l'écriture est réservée à un seul onglet (US-021) et les modifications en attente d'envoi sont
  // comptées (US-022) ; sur un autre PC, c'est une copie en lecture seule, datée.
  import { onMount } from 'svelte';
  import type { Competition } from '@poule-position/domaine';
  import Lien from '../composants/Lien.svelte';
  import { prendreEcriture, type Journal } from '../lib/journal';
  import { contenuExport, libellePilote } from '../lib/pilotage';
  import type { Ecart, SessionAppareil } from '../lib/stockage';
  import {
    cheminFormuleCompetition,
    cheminModificationCompetition,
    cheminParametresCompetition,
    CHEMINS,
  } from '../lib/routes';
  import type { Synchronisation } from '../lib/synchronisation';
  import { textes } from '../lib/textes';

  interface Proprietes {
    /** US-029 : compte et club qui signent le changement de pilote. */
    session: SessionAppareil;
    competitionId: string;
    journal: Journal;
    synchronisation: Synchronisation;
    naviguer: (chemin: string) => void;
  }

  let { session, competitionId, journal, synchronisation, naviguer }: Proprietes = $props();

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

  /** US-029 CA-3 : modifications d'un ancien pilote que le serveur n'a pas reprises. */
  let ecartes: Ecart[] = $state([]);
  /** US-029 CA-2 : celui qui vient de prendre la main, annoncé à l'ancien pilote. */
  let perteLibelle: string | null = $state(null);
  let enLigne = $state(navigator.onLine);

  let liberer: (() => void) | null = null;
  let demonte = false;

  /** Lit la compétition (copie à jour si ce PC n'est pas le pilote) et réserve l'écriture si ce PC la pilote. */
  async function charger() {
    liberer?.();
    liberer = null;
    const resultat = await synchronisation.telechargerCopie(competitionId);
    const copie = resultat.ok ? resultat : resultat.copie;
    competition = copie?.projection.competition ?? null;
    copieLe = copie?.copieLe ?? null;
    pilote = (await journal.etat(competitionId))?.pilote ?? false;
    ecartes = await journal.lireEcartes(competitionId);
    if (pilote) {
      liberer = await prendreEcriture(competitionId);
      if (demonte) liberer?.();
      ecriture = liberer !== null;
      await compterEnAttente();
      void envoyer();
    } else {
      ecriture = true;
      enAttente = 0;
    }
    chargee = true;
  }

  onMount(() => {
    const surEnLigne = () => {
      enLigne = true;
      if (pilote) void envoyer();
    };
    const surHorsLigne = () => (enLigne = false);
    window.addEventListener('online', surEnLigne);
    window.addEventListener('offline', surHorsLigne);
    // US-029 CA-2 : un autre PC a pris la main, cette page passe aussitôt en lecture seule.
    const arreterPerte = synchronisation.surPerte((perte) => {
      if (perte.competitionId !== competitionId) return;
      perteLibelle = libellePilote(perte.piloteNom, perte.piloteAppareil);
      void charger();
    });
    void charger();

    return () => {
      demonte = true;
      liberer?.();
      arreterPerte();
      window.removeEventListener('online', surEnLigne);
      window.removeEventListener('offline', surHorsLigne);
    };
  });

  const tp = t.prise;
  let etapePrise: 'aucune' | 'recherche' | 'confirmation' = $state('aucune');
  let piloteEnPlace: { appareil: string; libelle: string; connecte: boolean } | null = $state(null);
  let erreurPrise: string | null = $state(null);
  let priseEnCours = $state(false);

  /** CA-4 : cherche le pilote en place pour que la confirmation dise s'il est connecté. */
  async function demanderPrise() {
    etapePrise = 'recherche';
    erreurPrise = null;
    const reponse = await synchronisation.pilote(competitionId);
    if (!reponse.ok) {
      etapePrise = 'aucune';
      erreurPrise = tp.erreurs[reponse.erreur];
      return;
    }
    piloteEnPlace = {
      appareil: reponse.piloteAppareil,
      libelle: libellePilote(reponse.piloteNom, reponse.piloteAppareil),
      connecte: reponse.connecte,
    };
    etapePrise = 'confirmation';
  }

  /** CA-1 : prend la main, puis recharge la compétition, désormais modifiable ici. */
  async function confirmerPrise() {
    if (!piloteEnPlace || priseEnCours) return;
    priseEnCours = true;
    try {
      const reponse = await synchronisation.prendreLaMain(competitionId, piloteEnPlace.appareil, {
        clubId: session.compte.clubId ?? '',
        auteur: session.compte.email,
      });
      etapePrise = 'aucune';
      if (reponse.ok) {
        perteLibelle = null;
        await charger();
      } else if (reponse.erreur === 'MAIN_DEJA_PRISE') {
        erreurPrise = tp.mainDejaPrise(libellePilote(reponse.piloteNom, reponse.piloteAppareil));
      } else {
        erreurPrise = tp.erreurs[reponse.erreur];
      }
    } finally {
      priseEnCours = false;
    }
  }

  /** CA-3 : télécharge les modifications écartées au format du journal. */
  function exporter() {
    const lien = document.createElement('a');
    lien.href = URL.createObjectURL(new Blob([contenuExport(competitionId, ecartes)], { type: 'application/json' }));
    lien.download = `modifications-ecartees-${competitionId}.json`;
    lien.click();
    URL.revokeObjectURL(lien.href);
  }

  async function comprendre() {
    await journal.effacerEcartes(competitionId);
    ecartes = [];
    perteLibelle = null;
  }

  const nombreEcartes = $derived(ecartes.reduce((total, { evenements }) => total + evenements.length, 0));
  const annonceEcart = $derived(
    ecartes[0]?.piloteNom ? libellePilote(ecartes[0].piloteNom, ecartes[0].piloteAppareil ?? '') : null,
  );
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
    <!-- US-029 : mains prises par un autre PC, modifications écartées et prise de main. -->
    {#if perteLibelle ?? annonceEcart}
      <p class="avertissement" role="status">{tp.perte(perteLibelle ?? annonceEcart ?? '')}</p>
    {/if}
    {#if nombreEcartes > 0}
      <p class="avertissement" role="alert">{tp.ecartes(nombreEcartes)}</p>
      <div class="actions">
        <button type="button" onclick={exporter}>{tp.exporter}</button>
        <button type="button" class="secondaire" onclick={comprendre}>{tp.compris}</button>
      </div>
    {/if}
    {#if !pilote}
      {#if etapePrise === 'confirmation' && piloteEnPlace}
        <div class="prise" role="group" aria-label={tp.confirmer}>
          <p>{tp.confirmer}</p>
          <p class="avertissement" role="status">
            {piloteEnPlace.connecte
              ? tp.piloteConnecte(piloteEnPlace.libelle)
              : tp.piloteHorsLigne(piloteEnPlace.libelle)}
          </p>
          <div class="actions">
            <button type="button" onclick={confirmerPrise} disabled={priseEnCours || !enLigne}>{tp.valider}</button>
            <button type="button" class="secondaire" onclick={() => (etapePrise = 'aucune')}>{tp.annuler}</button>
          </div>
        </div>
      {:else}
        <button
          type="button"
          onclick={demanderPrise}
          disabled={!enLigne || etapePrise === 'recherche'}
          aria-describedby={enLigne ? undefined : 'prise-hors-ligne'}
          >{etapePrise === 'recherche' ? tp.chargement : tp.bouton}</button
        >
        {#if !enLigne}<small id="prise-hors-ligne">{tp.horsLigne}</small>{/if}
      {/if}
      {#if erreurPrise}<p class="message" role="alert">{erreurPrise}</p>{/if}
    {/if}
    <!-- US-027 CA-3 : seul le PC pilote modifie ; ailleurs la compétition reste en lecture seule. -->
    {#if pilote && ecriture && competition.statut !== 'archivee'}
      <Lien chemin={cheminModificationCompetition(competitionId)} {naviguer}>{t.modifier}</Lien>
    {/if}
    <!-- US-028 : la formule se règle sur une page à part, lisible aussi en lecture seule. -->
    <Lien chemin={cheminFormuleCompetition(competitionId)} {naviguer}>{t.modifierFormule}</Lien>
    <!-- US-032 : paramètres (droits, noms au public), lisibles aussi en lecture seule. -->
    <Lien chemin={cheminParametresCompetition(competitionId)} {naviguer}>{t.lienParametres}</Lien>
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
          ? t.formule(
              competition.formule.touchesPoules,
              competition.formule.touchesTableau,
              competition.formule.matchTroisieme,
            )
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

  .prise {
    display: grid;
    gap: 0.75rem;
    width: min(100%, 32rem);
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.5rem;
  }

  button {
    padding: 0.6rem 1rem;
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

  small {
    color: var(--texte-discret);
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
