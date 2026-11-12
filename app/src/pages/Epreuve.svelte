<script lang="ts">
  // Page d'une épreuve (US-025 CA-2), réservée : ses informations, son statut, sa publication et son pilote. Sur
  // le PC pilote, l'écriture est réservée à un seul onglet (US-021) et les modifications en attente d'envoi sont
  // comptées (US-022) ; sur un autre PC, c'est une copie en lecture seule, datée.
  import { onMount } from 'svelte';
  import { prochaineEtape, type Epreuve } from '@poule-position/domaine';
  import FichiersJoints from '../composants/FichiersJoints.svelte';
  import Lien from '../composants/Lien.svelte';
  import GabaritEpreuve from '../composants/GabaritEpreuve.svelte';
  import BandeauProchaineEtape from '../composants/BandeauProchaineEtape.svelte';
  import Icone from '../composants/Icone.svelte';
  import MenuActions from '../composants/MenuActions.svelte';
  import type { Accueil } from '../lib/accueil';
  import type { ClientCompetitions } from '../lib/competitions';
  import type { ClientFichiers } from '../lib/fichiers';
  import { modifierPublication } from '../lib/epreuves';
  import { prendreEcriture, type Journal } from '../lib/journal';
  import { contenuExport, libellePilote } from '../lib/pilotage';
  import type { Ecart, SessionAppareil } from '../lib/stockage';
  import {
    cheminDirect,
    cheminDupliquerEpreuve,
    cheminFormuleEpreuve,
    cheminModificationEpreuve,
    CHEMINS,
  } from '../lib/routes';
  import { nomConfirme, peutSupprimer } from '../lib/suppression';
  import type { Synchronisation } from '../lib/synchronisation';
  import { textes } from '../lib/textes';

  interface Proprietes {
    /** US-029 : compte et club qui signent le changement de pilote. */
    session: SessionAppareil;
    epreuveId: string;
    journal: Journal;
    synchronisation: Synchronisation;
    /** US-030 : affiche et feuille de route de l'épreuve, reprises de sa compétition puis de sa manifestation. */
    fichiers: ClientFichiers;
    /** US-030 : retrouve la manifestation de la compétition de l'épreuve, pour l'héritage. */
    clientCompetitions: ClientCompetitions;
    /** US-054 : hiérarchie du club pour le fil d'Ariane. */
    accueil: Accueil;
    naviguer: (chemin: string) => void;
  }

  let { session, epreuveId, journal, synchronisation, fichiers, clientCompetitions, accueil, naviguer }: Proprietes =
    $props();

  const t = textes.epreuves;
  const tpe = textes.pageEpreuve;

  let epreuve: Epreuve | null = $state(null);
  let chargee = $state(false);
  let pilote = $state(false);
  let copieLe: number | null = $state(null);
  /** Faux si un autre onglet détient déjà l'écriture de cette épreuve. */
  let ecriture = $state(true);
  let enAttente = $state(0);
  let jamaisEnvoyee = $state(false);

  async function compterEnAttente() {
    enAttente = await synchronisation.enAttente(epreuveId);
    jamaisEnvoyee = await synchronisation.jamaisEnvoyee(epreuveId);
  }

  /** Envoie ce qui attend (sans effet hors ligne), puis met l'indicateur à jour. */
  async function envoyer() {
    await synchronisation.envoyer(epreuveId);
    await compterEnAttente();
  }

  /** US-029 CA-3 : modifications d'un ancien pilote que le serveur n'a pas reprises. */
  let ecartes: Ecart[] = $state([]);
  /** US-029 CA-2 : celui qui vient de prendre la main, annoncé à l'ancien pilote. */
  let perteLibelle: string | null = $state(null);
  let enLigne = $state(navigator.onLine);

  /** US-030 CA-4 : manifestation de la compétition de l'épreuve (en ligne, ou d'après la dernière copie). */
  async function trouverManifestation(competitionId: string | undefined) {
    if (!competitionId) return null;
    const reponse = await clientCompetitions.lister();
    const competitions = reponse.ok ? reponse.competitions : (reponse.copie?.competitions ?? []);
    return competitions.find(({ id }) => id === competitionId)?.manifestationId ?? null;
  }

  let liberer: (() => void) | null = null;
  let demonte = false;

  /** Lit l’épreuve (copie à jour si ce PC n'est pas le pilote) et réserve l'écriture si ce PC la pilote. */
  async function charger() {
    liberer?.();
    liberer = null;
    const resultat = await synchronisation.telechargerCopie(epreuveId);
    const copie = resultat.ok ? resultat : resultat.copie;
    epreuve = copie?.projection.epreuve ?? null;
    copieLe = copie?.copieLe ?? null;
    pilote = (await journal.etat(epreuveId))?.pilote ?? false;
    ecartes = await journal.lireEcartes(epreuveId);
    if (pilote) {
      liberer = await prendreEcriture(epreuveId);
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
      if (perte.epreuveId !== epreuveId) return;
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
    const reponse = await synchronisation.pilote(epreuveId);
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

  /** CA-1 : prend la main, puis recharge l’épreuve, désormais modifiable ici. */
  async function confirmerPrise() {
    if (!piloteEnPlace || priseEnCours) return;
    priseEnCours = true;
    try {
      const reponse = await synchronisation.prendreLaMain(epreuveId, piloteEnPlace.appareil, {
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
    lien.href = URL.createObjectURL(new Blob([contenuExport(epreuveId, ecartes)], { type: 'application/json' }));
    lien.download = `modifications-ecartees-${epreuveId}.json`;
    lien.click();
    URL.revokeObjectURL(lien.href);
  }

  async function comprendre() {
    await journal.effacerEcartes(epreuveId);
    ecartes = [];
    perteLibelle = null;
  }

  /** US-039 : suppression définitive, proposée aux seuls administrateurs. */
  const ts = t.suppression;
  const tsu = textes.suppressionUnique;
  let etapeSuppression: 'aucune' | 'confirmation' = $state('aucune');
  let saisieNom = $state('');
  let suppressionEnCours = $state(false);
  let erreurSuppression: string | null = $state(null);
  const droitSuppression = $derived(droit());

  /** US-057 : la confirmation s'ouvre sous la page, loin du menu « ⋯ » : on l'amène à l'écran. */
  $effect(() => {
    if (etapeSuppression === 'confirmation')
      document.getElementById('confirmation-suppression')?.scrollIntoView({ block: 'center' });
  });

  function droit() {
    return epreuve ? peutSupprimer(session.compte.role, epreuve.statut) : null;
  }

  /** CA-1 : supprime sur le serveur, puis revient à la liste ; CA-8 : le nom saisi doit être exact. */
  async function supprimer() {
    if (!epreuve || suppressionEnCours || !nomConfirme(saisieNom, epreuve.nom)) return;
    suppressionEnCours = true;
    erreurSuppression = null;
    try {
      const reponse = await synchronisation.supprimerEpreuve(epreuveId);
      if (reponse.ok) naviguer(CHEMINS.organisateur);
      else erreurSuppression = ts.erreurs[reponse.erreur];
    } finally {
      suppressionEnCours = false;
    }
  }

  const tpub = textes.publication;
  let publicationEnCours = $state(false);
  let erreurPublication: string | null = $state(null);
  /** Valeur demandée à la dernière publication, tant que le serveur n'a pas reçu l'événement. */
  let publicationAttendue: boolean | null = $state(null);

  /** US-031 CA-2 et CA-4 : publie ou dépublie, sans réseau (journal local), puis envoie dès que possible. */
  async function changerPublication(publiee: boolean) {
    if (publicationEnCours) return;
    publicationEnCours = true;
    erreurPublication = null;
    try {
      const resultat = await modifierPublication(journal, epreuveId, publiee, {
        clubId: session.compte.clubId,
        auteur: session.compte.email,
      });
      if (!resultat.ok) {
        erreurPublication = tpub.erreurs[resultat.erreur];
        return;
      }
      await charger();
      publicationAttendue = publiee;
      void envoyer().then(() => {
        if (enAttente === 0) publicationAttendue = null;
      });
    } finally {
      publicationEnCours = false;
    }
  }

  /** US-064 : la règle du domaine choisit l'étape ; le bandeau ne s'affiche que s'il y en a une. */
  const etapeSuivante = $derived(etapeDe());

  function etapeDe() {
    return epreuve ? prochaineEtape({ statut: epreuve.statut, publiee: epreuve.publiee }) : null;
  }
  let retourCopie: { ok: boolean; message: string } | null = $state(null);

  /** CA-3 : copie l'adresse publique de l'épreuve ; sans presse-papiers, le motif s'affiche. */
  async function copierLien() {
    try {
      await navigator.clipboard.writeText(location.origin + cheminDirect(epreuveId));
      retourCopie = { ok: true, message: tpe.prochaineEtape.lienCopie };
    } catch {
      retourCopie = { ok: false, message: tpe.prochaineEtape.copieImpossible };
    }
  }

  /** Clic sur un lien de l'entête ou d'une carte : navigation interne, sauf Ctrl, Maj ou clic milieu. */
  function suivre(evenement: MouseEvent, chemin: string) {
    if (evenement.button !== 0 || evenement.ctrlKey || evenement.metaKey || evenement.shiftKey) return;
    evenement.preventDefault();
    naviguer(chemin);
  }

  const nombreEcartes = $derived(ecartes.reduce((total, { evenements }) => total + evenements.length, 0));
  const annonceEcart = $derived(
    ecartes[0]?.piloteNom ? libellePilote(ecartes[0].piloteNom, ecartes[0].piloteAppareil ?? '') : null,
  );
</script>

{#if !chargee}
  <main>
    <p role="status">{t.chargement}</p>
  </main>
{:else if !epreuve}
  <main>
    <p class="message" role="alert">{t.introuvable}</p>
    <Lien chemin={CHEMINS.organisateur} {naviguer}>{t.retour}</Lien>
  </main>
{:else}
  <GabaritEpreuve {accueil} {epreuve} courante="resume" {naviguer}>
    {#snippet actions()}
      {#if epreuve}
        <!-- US-027 CA-3 : seul le PC pilote modifie ; ailleurs l’épreuve reste en lecture seule. -->
        {#if pilote && ecriture && epreuve.statut !== 'archivee'}
          <a
            class="bouton-contour"
            href={cheminModificationEpreuve(epreuveId)}
            onclick={(e) => suivre(e, cheminModificationEpreuve(epreuveId))}
          >
            <Icone nom="crayon" />{t.modifier}
          </a>
        {/if}
        <!-- US-058 CA-6 : actions secondaires de l'épreuve ; Archiver (US-033) et Exporter (US-034) s'y ajouteront. -->
        <MenuActions
          id="menu-epreuve"
          nom={epreuve.nom}
          {naviguer}
          actions={[
            ...(epreuve.rattachement
              ? [
                  {
                    libelle: tpe.dupliquer,
                    icone: 'plus' as const,
                    detail: tpe.dupliquerDetail,
                    chemin: cheminDupliquerEpreuve({ ...epreuve, rattachement: epreuve.rattachement }),
                  },
                ]
              : []),
            // US-057 : l'unique « Supprimer… », dernier du menu ; la confirmation (nom à saisir) s'ouvre sous la page.
            ...(session.compte.role === 'administrateur'
              ? [
                  {
                    libelle: tsu.action,
                    icone: 'corbeille' as const,
                    detail: tsu.sousTitre({ type: 'epreuve', competitions: 0, epreuves: 0 }),
                    destructive: true,
                    surChoix: () => (etapeSuppression = 'confirmation'),
                    indisponible: !enLigne
                      ? tsu.horsLigne
                      : droitSuppression && !droitSuppression.ok
                        ? tsu.enCours
                        : undefined,
                  },
                ]
              : []),
          ]}
        />
      {/if}
    {/snippet}
    {#if etapeSuivante}
      <BandeauProchaineEtape
        etape={etapeSuivante}
        peutAgir={pilote && ecriture}
        enCours={publicationEnCours}
        surPublier={() => changerPublication(true)}
        surCopier={copierLien}
        {retourCopie}
        erreur={erreurPublication}
      />
    {/if}
    <div class="cartes">
      <!-- US-029 : pilote, mains prises par un autre PC, modifications écartées et prise de main. -->
      <section class="carte" aria-label={tpe.cartes.pilote}>
        <h2><Icone nom="ecran" />{tpe.cartes.pilote}</h2>
        {#if pilote}
          <p class="etat-pilote"><span class="pastille-ok" aria-hidden="true"></span>{t.pilote}</p>
          <p class="discret">{enLigne ? tpe.piloteEnvoye : tpe.piloteHorsLigne}</p>
        {:else}
          <p class="avertissement" role="status">
            {t.lectureSeule}{#if copieLe !== null}<br />{t.copieDu(copieLe)}{/if}
          </p>
        {/if}
        {#if pilote && !ecriture}
          <p class="avertissement" role="status">{t.autreOnglet}</p>
        {/if}
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
        {#if pilote && enAttente > 0}
          <p class="envoi" role="status">
            {jamaisEnvoyee ? `${t.enAttente(enAttente)} · ${t.pasEncoreEnvoyee}` : t.enAttente(enAttente)}
          </p>
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
            <div class="actions">
              <button
                type="button"
                onclick={demanderPrise}
                disabled={!enLigne || etapePrise === 'recherche'}
                aria-describedby={enLigne ? undefined : 'prise-hors-ligne'}
                >{etapePrise === 'recherche' ? tp.chargement : tp.bouton}</button
              >
            </div>
            {#if !enLigne}<small id="prise-hors-ligne">{tp.horsLigne}</small>{/if}
          {/if}
          {#if erreurPrise}<p class="message" role="alert">{erreurPrise}</p>{/if}
        {/if}
      </section>

      <!-- US-031 : publier ou dépublier à tout moment, depuis le PC pilote (hors ligne comprise). -->
      <section class="carte publication" aria-label={tpub.titre}>
        <h2><Icone nom={epreuve.publiee ? 'oeil' : 'oeilBarre'} />{tpub.titre}</h2>
        <p class="etat">{epreuve.publiee ? t.publiee : t.nonPubliee}</p>
        <p class="discret">{epreuve.publiee ? tpub.aidePubliee : tpub.aideNonPubliee}</p>
        {#if pilote && ecriture && epreuve.statut !== 'archivee'}
          <div class="actions">
            <button
              type="button"
              class={epreuve.publiee ? 'secondaire' : undefined}
              onclick={() => changerPublication(!epreuve!.publiee)}
              disabled={publicationEnCours}>{epreuve.publiee ? tpub.depublier : tpub.publier}</button
            >
          </div>
        {/if}
        {#if epreuve.publiee}
          <Lien chemin={cheminDirect(epreuveId)} {naviguer}>{tpub.lienPublic}</Lien>
        {/if}
        {#if pilote && publicationAttendue !== null && enAttente > 0}
          <p class="envoi" role="status">{tpub.enAttente}</p>
        {/if}
        {#if erreurPublication}<p class="message" role="alert">{erreurPublication}</p>{/if}
      </section>

      <section class="carte" aria-label={tpe.cartes.informations}>
        <h2>
          <Icone nom="calendrier" />{tpe.cartes.informations}
          {#if pilote && ecriture && epreuve.statut !== 'archivee'}
            <a
              class="crayon"
              href={cheminModificationEpreuve(epreuveId)}
              aria-label={tpe.modifierInformations}
              title={tpe.modifierInformations}
              onclick={(e) => suivre(e, cheminModificationEpreuve(epreuveId))}><Icone nom="crayon" /></a
            >
          {/if}
        </h2>
        <dl>
          <dt>{tpe.informations.lieu}</dt>
          <dd>{epreuve.lieu || tpe.vide}</dd>
          <dt>{tpe.informations.appel}</dt>
          <dd>{epreuve.horaires.appel || tpe.vide}</dd>
          <dt>{tpe.informations.scratch}</dt>
          <dd>{epreuve.horaires.scratch || tpe.vide}</dd>
          <dt>{tpe.informations.debut}</dt>
          <dd>{epreuve.horaires.debutPoules || tpe.vide}</dd>
          {#if epreuve.typeEpreuve !== 'individuelle'}
            <dt>{t.type}</dt>
            <dd>{t.types[epreuve.typeEpreuve]}</dd>
          {/if}
          {#if epreuve.commentaire}
            <dt>{t.commentaire}</dt>
            <dd class="commentaire">{epreuve.commentaire}</dd>
          {/if}
        </dl>
      </section>

      <!-- US-028 : la formule se règle sur son étape, lisible aussi en lecture seule. -->
      <section class="carte" aria-label={tpe.cartes.formule}>
        <h2>
          <Icone nom="arbre" />{tpe.cartes.formule}
          <a
            class="crayon"
            href={cheminFormuleEpreuve(epreuveId)}
            aria-label={tpe.modifierFormule}
            title={tpe.modifierFormule}
            onclick={(e) => suivre(e, cheminFormuleEpreuve(epreuveId))}><Icone nom="crayon" /></a
          >
        </h2>
        <p>
          {epreuve.formule.touchesRelais === null
            ? t.formule(epreuve.formule.touchesPoules, epreuve.formule.touchesTableau, epreuve.formule.matchTroisieme)
            : t.relais(epreuve.formule.touchesRelais)}
        </p>
      </section>
    </div>

    <!-- US-030 : affiche et feuille de route, avec l'héritage de la compétition puis de la manifestation (CA-4). -->
    <div class="carte large">
      {#await trouverManifestation(epreuve.rattachement?.competitionId) then manifestationId}
        <FichiersJoints
          client={fichiers}
          chaine={[
            { proprietaire: 'epreuve', id: epreuveId },
            { proprietaire: 'competition', id: epreuve.rattachement?.competitionId },
            { proprietaire: 'manifestation', id: manifestationId },
          ]}
          garder
        />
      {/await}
    </div>

    <!-- US-039 : suppression définitive, réservée aux administrateurs, en ligne, hors épreuve en cours. -->
    {#if session.compte.role === 'administrateur'}
      {#if etapeSuppression === 'confirmation'}
        <div class="prise carte" id="confirmation-suppression" role="group" aria-label={ts.titre}>
          <p>{ts.titre}</p>
          <p class="avertissement" role="status">{ts.avertissement}</p>
          <label>
            {ts.saisie(epreuve.nom)}
            <input type="text" bind:value={saisieNom} autocomplete="off" />
          </label>
          <div class="actions">
            <button
              type="button"
              class="danger"
              onclick={supprimer}
              disabled={suppressionEnCours || !enLigne || !nomConfirme(saisieNom, epreuve.nom)}
              >{suppressionEnCours ? ts.suppression : ts.valider}</button
            >
            <button
              type="button"
              class="secondaire"
              onclick={() => ((etapeSuppression = 'aucune'), (saisieNom = ''), (erreurSuppression = null))}
              >{ts.annuler}</button
            >
          </div>
        </div>
      {/if}
      {#if erreurSuppression}<p class="message" role="alert">{erreurSuppression}</p>{/if}
    {/if}
  </GabaritEpreuve>
{/if}

<style>
  main {
    display: grid;
    justify-items: center;
    gap: 1.25rem;
    padding: 3rem 1rem;
  }

  .cartes {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
    gap: 1rem;
    align-items: stretch;
  }

  .carte {
    display: grid;
    gap: 0.6rem;
    align-content: start;
    padding: 1rem 1.25rem;
    border: 1px solid var(--bordure);
    border-radius: 14px;
    background: var(--surface);
  }

  .carte.large {
    padding: 0.5rem 1.25rem;
  }

  .carte h2 {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    margin: 0;
    font-size: 1rem;
  }

  .carte p {
    margin: 0;
  }

  .crayon {
    display: inline-grid;
    place-items: center;
    width: 2rem;
    height: 2rem;
    margin-left: auto;
    border-radius: 8px;
    color: var(--texte);
  }

  .crayon:hover {
    background: var(--surface-2);
  }

  .etat-pilote {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--etat-ok);
    font-weight: 600;
  }

  .pastille-ok {
    width: 0.6rem;
    height: 0.6rem;
    border-radius: 50%;
    background: var(--etat-ok);
  }

  .etat {
    font-weight: 600;
  }

  dl {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 0.4rem 1.25rem;
    margin: 0;
  }

  dt {
    color: var(--texte-discret);
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
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .bouton-contour {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    min-height: 2.75rem;
    padding: 0 1rem;
    border: 1px solid var(--bordure-champ);
    border-radius: var(--rayon);
    background: var(--surface);
    color: var(--texte);
    font-weight: 500;
    text-decoration: none;
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

  button.danger {
    background: var(--etat-erreur);
  }

  label {
    display: grid;
    gap: 0.25rem;
  }

  input {
    padding: 0.55rem 0.65rem;
    border: 1px solid var(--bordure-champ);
    border-radius: var(--rayon);
    background: var(--surface);
    color: var(--texte);
    font: inherit;
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

  .discret {
    color: var(--texte-discret);
    font-size: 0.9rem;
  }

  .avertissement,
  .envoi,
  .message {
    padding: 0.6rem 0.75rem;
    background: var(--surface-2);
  }

  .avertissement,
  .envoi {
    border-left: 4px solid var(--etat-attente);
  }

  .message {
    border-left: 4px solid var(--etat-erreur);
  }

  /* Smartphone (US-061 CA-6) : toute commande de la page fait au moins 44 × 44 px. */
  @media (max-width: 39.99rem) {
    button,
    .bouton-contour {
      min-height: 44px;
    }

    .crayon {
      width: 44px;
      height: 44px;
    }
  }
</style>
