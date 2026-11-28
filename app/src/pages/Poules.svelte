<script lang="ts">
  // Poules d'une épreuve : constitution (US-086, planche 8), vérification et ajustement (US-087, planche 9).
  // Écrit les événements d'US-085 dans le journal local du PC pilote, hors ligne compris.
  import { onMount } from 'svelte';
  import {
    lignesSaisies,
    poulesDe,
    tableauDe,
    participantsDe,
    trierTireurs,
    type Epreuve,
    type LigneSaisie,
    type Poule,
  } from '@poule-position/domaine';
  import CartesPoules from '../composants/CartesPoules.svelte';
  import ConstitutionPoules from '../composants/ConstitutionPoules.svelte';
  import SaisiePoules from '../composants/SaisiePoules.svelte';
  import SaisiesRecues from '../composants/SaisiesRecues.svelte';
  import BandeauEcartees from '../composants/BandeauEcartees.svelte';
  import type { PresencePilote } from '../lib/presence-pilote';
  import AttenteEnvoi from '../composants/AttenteEnvoi.svelte';
  import GabaritEpreuve from '../composants/GabaritEpreuve.svelte';
  import type { Accueil } from '../lib/accueil';
  import { prendreEcriture, type Journal } from '../lib/journal';
  import type { VerdictArchivage } from '../lib/archivage';
  import { annulerRetrait, composerPoules, lancerPoules, retirerDesPoules, saisirScore } from '../lib/poules';
  import type { MotifRetrait } from '@poule-position/domaine';
  import { cheminEmargementEpreuve, cheminImprimer, cheminParametresEpreuve } from '../lib/routes';
  import type { SessionAppareil } from '../lib/stockage';
  import type { Synchronisation } from '../lib/synchronisation';
  import { textes } from '../lib/textes';

  interface Proprietes {
    session: SessionAppareil;
    epreuveId: string;
    journal: Journal;
    synchronisation: Synchronisation;
    accueil: Accueil;
    naviguer: (chemin: string) => void;
    /** US-100 : smartphones connectés (WebSocket du pilote). */
    presence: PresencePilote;
  }

  let { session, epreuveId, journal, synchronisation, accueil, naviguer, presence }: Proprietes = $props();

  // US-100 : les saisies reçues des smartphones (et celles de ce PC), lues dans le journal local.
  let lignes = $state<LigneSaisie[]>([]);
  // svelte-ignore state_referenced_locally
  let appareils = $state<number | null>(presence.appareils(epreuveId));

  const t = textes.poules;
  const te = textes.epreuves;
  const contexte = $derived({ clubId: session.compte.clubId, auteur: session.compte.email });

  let epreuve = $state<Epreuve | null>(null);
  let chargee = $state(false);
  let pilote = $state(false);
  let ecriture = $state(true);
  let enAttente = $state(0);
  let annonce = $state('');
  let erreur: string | null = $state(null);
  /** CA-7 (US-086) : l'organisateur a demandé à répartir à nouveau. */
  let refaire = $state(false);
  /** US-087 CA-1 : la dernière répartition écrite ici était manuelle. */
  let manuelle = $state(false);

  /** US-150 : par équipes, les poules tirent des équipes. */
  const tireurs = $derived(epreuve ? trierTireurs(participantsDe(epreuve)) : []);
  const presents = $derived(tireurs.filter(({ present }) => present));
  const etat = $derived(epreuve ? poulesDe(epreuve) : null);
  const motifLectureSeule = $derived(
    !epreuve
      ? null
      : !pilote || !ecriture
        ? t.lectureSeule
        : epreuve.statut === 'archivee'
          ? t.archivee
          : tableauDe(epreuve).qualifies
            ? t.tableauCree
            : null,
  );
  const modifiable = $derived(epreuve !== null && motifLectureSeule === null);
  const constitution = $derived(etat !== null && !etat.lancees && modifiable && (etat.poules.length === 0 || refaire));

  async function recharger() {
    epreuve = (await journal.lire(epreuveId)).epreuve;
    lignes = lignesSaisies(await journal.evenements(epreuveId), epreuve);
    appareils = presence.appareils(epreuveId);
    enAttente = pilote ? await synchronisation.enAttente(epreuveId) : 0;
  }

  onMount(() => {
    let liberer: (() => void) | null = null;
    let demonte = false;
    const surEnLigne = () => void synchronisation.envoyer(epreuveId).then(() => recharger());
    const arreterPerte = synchronisation.surPerte(({ epreuveId: id }) => {
      if (id !== epreuveId) return;
      pilote = false;
      liberer?.();
      void recharger();
    });
    // US-099 CA-9 : un score accepté d'un smartphone (écrit hors de cette page) s'affiche dans la feuille.
    const arreterEnvoi = synchronisation.surEnvoi((id) => {
      if (id === epreuveId) void recharger();
    });
    const arreterAppareils = presence.surAppareils((id, connectes) => {
      if (id === epreuveId) appareils = connectes;
    });
    // Hors ligne (ou de retour), le nombre d'appareils n'est plus connu (ou l'est de nouveau).
    const arreterEtat = presence.surEtat(() => (appareils = presence.appareils(epreuveId)));
    void (async () => {
      await synchronisation.telechargerCopie(epreuveId);
      pilote = (await journal.etat(epreuveId))?.pilote ?? false;
      if (pilote) {
        liberer = await prendreEcriture(epreuveId);
        if (demonte) liberer?.();
        ecriture = liberer !== null;
        window.addEventListener('online', surEnLigne);
      }
      await recharger();
      chargee = true;
      if (pilote) void synchronisation.envoyer(epreuveId).then(() => recharger());
    })();
    return () => {
      demonte = true;
      liberer?.();
      arreterPerte();
      arreterEnvoi();
      arreterAppareils();
      arreterEtat();
      window.removeEventListener('online', surEnLigne);
    };
  });

  /** Écrit une composition (US-086, US-087) ; vrai si elle est enregistrée. */
  async function ecrireComposition(poules: Poule[]): Promise<boolean> {
    const resultat = await composerPoules(journal, epreuveId, poules, contexte);
    await recharger();
    if (!resultat.ok) {
      erreur = t.erreurs[resultat.erreur] ?? t.erreurs.AUTRE!;
      return false;
    }
    erreur = null;
    void synchronisation.envoyer(epreuveId).then(() => recharger());
    return true;
  }

  /** US-087 CA-6 : lance les poules (après la confirmation de la carte). */
  async function lancer(): Promise<VerdictArchivage> {
    const resultat = await lancerPoules(journal, epreuveId, contexte);
    await recharger();
    if (!resultat.ok) return { ok: false, message: t.erreurs[resultat.erreur] ?? t.erreurs.AUTRE! };
    annonce = t.lanceesAnnonce;
    void synchronisation.envoyer(epreuveId).then(() => recharger());
    return { ok: true };
  }

  /** US-088 CA-3 et CA-6 : saisit ou corrige un score. */
  async function saisir(score: Parameters<typeof saisirScore>[2]): Promise<boolean> {
    const resultat = await saisirScore(journal, epreuveId, score, contexte);
    await recharger();
    if (!resultat.ok) {
      erreur = t.erreurs[resultat.erreur] ?? t.erreurs.AUTRE!;
      return false;
    }
    erreur = null;
    const nom = (id: string) => tireurs.find((x) => x.id === id)?.nom.toUpperCase() ?? '';
    annonce = t.scoreEnregistre(nom(score.tireurA), score.touchesA, score.touchesB, nom(score.tireurB));
    void synchronisation.envoyer(epreuveId).then(() => recharger());
    return true;
  }

  const nomDe = (id: string) => {
    const tireur = tireurs.find((x) => x.id === id);
    return tireur ? `${tireur.nom.toUpperCase()} ${tireur.prenom}` : '';
  };

  /** US-089 CA-1 et CA-4 : retire un tireur des poules, ou annule ce retrait. */
  async function retirer(tireurId: string, motif: MotifRetrait | null): Promise<VerdictArchivage> {
    const resultat = motif
      ? await retirerDesPoules(journal, epreuveId, tireurId, motif, contexte)
      : await annulerRetrait(journal, epreuveId, tireurId, contexte);
    await recharger();
    if (!resultat.ok) return { ok: false, message: t.erreurs[resultat.erreur] ?? t.erreurs.AUTRE! };
    annonce = motif ? t.retraitAnnonce(nomDe(tireurId), t.motifs[motif]!) : t.retraitAnnuleAnnonce(nomDe(tireurId));
    void synchronisation.envoyer(epreuveId).then(() => recharger());
    return { ok: true };
  }

  async function constituer(poules: Poule[], estManuelle: boolean) {
    if (await ecrireComposition(poules)) {
      manuelle = estManuelle;
      refaire = false;
      annonce = t.repartiesAnnonce(poules.length);
    }
  }
</script>

{#snippet etape()}
  {#if !chargee}
    <p role="status">{te.chargement}</p>
  {:else if !epreuve || !etat}
    <p class="message" role="alert">{te.introuvable}</p>
  {:else}
    {#if constitution}
      <div class="titre-etape">
        <h2>{t.constituerTitre}</h2>
        <span class="pastille">{t.tour}</span>
      </div>
    {/if}
    {#if motifLectureSeule}<p class="avertissement" role="status">{motifLectureSeule}</p>{/if}
    <!-- US-090 : l'attente d'envoi ne décale plus l'écran. -->
    {#if pilote}<AttenteEnvoi nombre={enAttente} />{/if}
    <p class="invisible" role="status" aria-live="polite">{annonce}</p>
    {#if erreur}<p class="message" role="alert">{erreur}</p>{/if}

    {#if constitution}
      <ConstitutionPoules
        {presents}
        inscrits={tireurs.length}
        remplace={etat.poules.length > 0}
        cheminEmargement={cheminEmargementEpreuve(epreuveId)}
        {naviguer}
        valider={constituer}
        annuler={etat.poules.length > 0 ? () => (refaire = false) : undefined}
      />
    {:else if etat.lancees}
      <!-- US-102 CA-7 : les saisies smartphone écartées au retour de la table (le papier fait foi). -->
      <BandeauEcartees
        {lignes}
        {etat}
        touches={epreuve.formule.touchesPoules}
        nomsVersIds={new Map(participantsDe(epreuve).map((x) => [x.nom, x.id]))}
      />
      <SaisiePoules
        imprimerFeuilles={() => naviguer(cheminImprimer(epreuveId, { document: 'poulesVierges' }))}
        {etat}
        {tireurs}
        touches={epreuve.formule.touchesPoules}
        {modifiable}
        figees={tableauDe(epreuve).qualifies !== null}
        priorite={epreuve.typeEpreuve !== 'individuelle'}
        {saisir}
        {retirer}
        annulerRetrait={(id) => retirer(id, null)}
      >
        {#snippet cote()}
          <!-- US-100 (planche 10), US-107 CA-4 : les saisies reçues des smartphones, sous la saisie du match. -->
          <SaisiesRecues
            {lignes}
            {appareils}
            {pilote}
            gererLesAcces={() => naviguer(cheminParametresEpreuve(epreuveId))}
          />
        {/snippet}
      </SaisiePoules>
    {:else if etat.poules.length === 0}
      <div class="titre-etape"><h2>{t.titre}</h2></div>
      <p class="discret">{t.pointezDabord}</p>
    {:else}
      <CartesPoules
        imprimerFeuilles={() => naviguer(cheminImprimer(epreuveId, { document: 'poulesVierges' }))}
        {etat}
        {tireurs}
        {manuelle}
        {modifiable}
        repartirANouveau={() => (refaire = true)}
        composer={ecrireComposition}
        {lancer}
      />
    {/if}
  {/if}
{/snippet}

{#if epreuve}
  <GabaritEpreuve {accueil} {epreuve} courante="poules" suite={t.titre} {naviguer}>
    {@render etape()}
  </GabaritEpreuve>
{:else}
  <main>{@render etape()}</main>
{/if}

<style>
  .titre-etape {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem 0.75rem;
  }

  h2 {
    margin: 0;
    font-family: var(--police-titre, inherit);
    font-size: 1.6rem;
  }

  .pastille {
    padding: 0.15rem 0.75rem;
    border-radius: 999px;
    background: var(--accent-teinte);
    font-size: 0.875rem;
    font-weight: 600;
  }

  .discret {
    margin: 0;
    color: var(--texte-discret);
  }

  .message {
    margin: 0;
    color: var(--etat-erreur);
  }

  .avertissement {
    margin: 0;
    padding: 0.5rem 0.75rem;
    border-left: 4px solid var(--etat-attente);
    background: var(--surface);
  }

  .invisible {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
</style>
