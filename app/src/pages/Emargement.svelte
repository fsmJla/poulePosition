<script lang="ts">
  // Émargement d'une épreuve (US-084, planche 19) : pointer les présents le jour J (ligne cliquable, recherche dont
  // Entrée pointe le seul résultat, filtres), inscrire sur place (inscrit et pointé), remettre tout le monde absent.
  // Écrit `PresenceModifiee` dans le journal local du PC pilote (US-081), hors ligne compris.
  import { onMount, tick } from 'svelte';
  import {
    cleTexte,
    inscriptionsOuvertes,
    tireursDe,
    trierTireurs,
    validerTireur,
    type Epreuve,
    type Tireur,
  } from '@poule-position/domaine';
  import ConfirmationArchivage from '../composants/ConfirmationArchivage.svelte';
  import GabaritEpreuve from '../composants/GabaritEpreuve.svelte';
  import Icone from '../composants/Icone.svelte';
  import MenuActions from '../composants/MenuActions.svelte';
  import type { Accueil } from '../lib/accueil';
  import { inscrireTireur, pointerTireur } from '../lib/inscriptions';
  import { prendreEcriture, type Journal } from '../lib/journal';
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
  }

  let { session, epreuveId, journal, synchronisation, accueil, naviguer }: Proprietes = $props();

  const t = textes.emargement;
  const ti = textes.inscriptions;
  const te = textes.epreuves;
  const contexte = $derived({ clubId: session.compte.clubId, auteur: session.compte.email });

  let epreuve = $state<Epreuve | null>(null);
  let chargee = $state(false);
  let pilote = $state(false);
  let ecriture = $state(true);
  let enAttente = $state(0);
  let annonce = $state('');
  let erreur: string | null = $state(null);
  let recherche = $state('');
  let filtre: 'toutes' | 'absentes' | 'presentes' = $state('toutes');
  let surPlaceOuvert = $state(false);
  const saisie = $state({ nom: '', prenom: '', club: '', classement: '' });
  let champNom: HTMLInputElement | undefined = $state();
  let remiseDemandee = $state(false);

  const tireurs = $derived(epreuve ? trierTireurs(tireursDe(epreuve)) : []);
  const presents = $derived(tireurs.filter(({ present }) => present).length);
  const cherches = $derived(
    recherche.trim()
      ? tireurs.filter((tireur) =>
          cleTexte(`${tireur.nom} ${tireur.prenom} ${tireur.club}`).includes(cleTexte(recherche)),
        )
      : tireurs,
  );
  const visibles = $derived(
    cherches.filter(({ present }) => filtre === 'toutes' || (filtre === 'presentes' ? present : !present)),
  );
  /** CA-5 : pourquoi l'écran est en lecture seule, ou null s'il est modifiable. */
  const motifLectureSeule = $derived(
    !epreuve
      ? null
      : !pilote || !ecriture
        ? ti.lectureSeule
        : epreuve.statut === 'archivee'
          ? ti.archivee
          : !inscriptionsOuvertes(epreuve.statut)
            ? ti.closes
            : null,
  );
  const modifiable = $derived(epreuve !== null && motifLectureSeule === null);
  /** CA-4 : le scratch est-il passé (heure locale) ? */
  const scratchPasse = $derived.by(() => {
    const scratch = epreuve?.horaires.scratch;
    if (!scratch || !epreuve?.date) return false;
    const maintenant = new Date();
    const aujourdhui = maintenant.toLocaleDateString('sv-SE');
    return (
      aujourdhui > epreuve.date || (aujourdhui === epreuve.date && maintenant.toTimeString().slice(0, 5) > scratch)
    );
  });

  async function recharger() {
    epreuve = (await journal.lire(epreuveId)).epreuve;
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
      window.removeEventListener('online', surEnLigne);
    };
  });

  const nomAffiche = (tireur: Pick<Tireur, 'nom' | 'prenom'>) => `${tireur.nom.toUpperCase()} ${tireur.prenom}`;

  async function apres(ok: boolean, code?: string) {
    await recharger();
    if (!ok) {
      erreur = ti.erreurs[code ?? ''] ?? ti.erreurs.AUTRE!;
      return false;
    }
    erreur = null;
    void synchronisation.envoyer(epreuveId).then(() => recharger());
    return true;
  }

  /** CA-2 : pointe un absent (avec l'heure), remet absent un présent. */
  async function basculer(tireur: Tireur) {
    if (!modifiable) return;
    const resultat = await pointerTireur(journal, epreuveId, tireur.id, !tireur.present, contexte);
    if (await apres(resultat.ok, resultat.ok ? undefined : resultat.erreur)) {
      annonce = tireur.present ? t.depointe(nomAffiche(tireur)) : t.pointe(nomAffiche(tireur));
    }
  }

  /** CA-3 : Entrée dans la recherche pointe le seul tireur restant. */
  async function surEntreeRecherche(evenement: KeyboardEvent) {
    if (evenement.key !== 'Enter') return;
    evenement.preventDefault();
    const [seul, ...autres] = visibles;
    if (seul && autres.length === 0 && !seul.present) {
      await basculer(seul);
      recherche = '';
    }
  }

  /** CA-4 : inscrit sur place et pointe présent d'un coup. */
  async function inscrireSurPlace(evenement: SubmitEvent) {
    evenement.preventDefault();
    if (!modifiable) return;
    const classement = saisie.classement.trim() ? Number(saisie.classement.trim()) : undefined;
    const invalide = validerTireur({
      nom: saisie.nom,
      prenom: saisie.prenom,
      club: saisie.club,
      classement: Number.isNaN(classement) ? 0.5 : classement,
    });
    if (invalide) {
      erreur = ti.erreurs[invalide] ?? ti.erreurs.AUTRE!;
      return;
    }
    const tireurId = crypto.randomUUID();
    const inscrit = await inscrireTireur(
      journal,
      epreuveId,
      { nom: saisie.nom, prenom: saisie.prenom, club: saisie.club, ...(classement !== undefined && { classement }) },
      contexte,
      tireurId,
    );
    if (!inscrit.ok) {
      await apres(false, inscrit.erreur);
      return;
    }
    const pointe = await pointerTireur(journal, epreuveId, tireurId, true, contexte);
    if (await apres(pointe.ok, pointe.ok ? undefined : pointe.erreur)) {
      annonce = t.pointe(`${saisie.nom.trim().toUpperCase()} ${saisie.prenom.trim()}`);
      Object.assign(saisie, { nom: '', prenom: '', classement: '' });
      await tick();
      champNom?.focus();
    }
  }

  /** CA-6 : remet absents tous les présents, après confirmation. */
  async function remettreAbsents() {
    for (const tireur of tireurs.filter(({ present }) => present)) {
      const resultat = await pointerTireur(journal, epreuveId, tireur.id, false, contexte);
      if (!resultat.ok) {
        await apres(false, resultat.erreur);
        return { ok: false as const, message: erreur ?? ti.erreurs.AUTRE! };
      }
    }
    await apres(true);
    return { ok: true as const };
  }
</script>

{#snippet etape()}
  <div class="titre-etape">
    <div class="identite">
      <div class="ligne">
        <h2>{t.titre}</h2>
        {#if epreuve}<span class="compteur" role="status">{t.compteur(presents, tireurs.length)}</span>{/if}
      </div>
      {#if epreuve && (epreuve.horaires.appel || epreuve.horaires.scratch)}
        <p class="discret">{t.horaires(epreuve.horaires.appel, epreuve.horaires.scratch)}</p>
      {/if}
    </div>
    {#if modifiable}
      <div class="actions">
        <button
          type="button"
          class="secondaire"
          aria-expanded={surPlaceOuvert}
          onclick={async () => {
            surPlaceOuvert = !surPlaceOuvert;
            await tick();
            champNom?.focus();
          }}><Icone nom="personnePlus" taille={20} />{t.surPlace}</button
        >
        <MenuActions
          id="menu-emargement"
          nom={t.titre}
          actions={[
            { libelle: t.imprimer, icone: 'imprimante', indisponible: t.imprimerAVenir },
            {
              libelle: t.remettreAbsents,
              detail: t.remettreAbsentsDetail,
              destructive: true,
              ...(presents === 0 && { indisponible: t.compteur(0, tireurs.length) }),
              surChoix: () => (remiseDemandee = true),
            },
          ]}
          {naviguer}
        />
        <!-- CA-6 : l'action principale mène aux poules (E4) : visible, grisée « À venir » d'ici là. -->
        <button type="button" class="principal" disabled title={t.constituerAVenir}>
          <Icone nom="grille" taille={20} />{t.constituer}
        </button>
      </div>
    {/if}
  </div>

  {#if !chargee}
    <p role="status">{te.chargement}</p>
  {:else if !epreuve}
    <p class="message" role="alert">{te.introuvable}</p>
  {:else}
    {#if motifLectureSeule}<p class="avertissement" role="status">{motifLectureSeule}</p>{/if}
    {#if pilote && enAttente > 0}<p class="avertissement" role="status">{te.enAttente(enAttente)}</p>{/if}
    <p class="invisible" role="status" aria-live="polite">{annonce}</p>
    {#if erreur}<p class="message" role="alert">{erreur}</p>{/if}

    {#if modifiable && surPlaceOuvert}
      <!-- CA-4 : la saisie de la planche 7 en une ligne ; le tireur est inscrit et pointé présent. -->
      <section class="carte sur-place" aria-labelledby="titre-sur-place">
        <h3 id="titre-sur-place">{t.surPlaceTitre}</h3>
        <form class="saisie" onsubmit={inscrireSurPlace} novalidate>
          <label
            >{ti.nom}<input bind:this={champNom} bind:value={saisie.nom} class="majuscules" autocomplete="off" /></label
          >
          <label>{ti.prenom}<input bind:value={saisie.prenom} autocomplete="off" /></label>
          <label>{ti.club}<input bind:value={saisie.club} autocomplete="off" /></label>
          <label>{ti.classement}<input bind:value={saisie.classement} inputmode="numeric" autocomplete="off" /></label>
          <button type="submit" class="secondaire accent">{t.inscrireEtPointer}</button>
          <button type="button" class="secondaire" onclick={() => (surPlaceOuvert = false)}>{ti.annuler}</button>
        </form>
        {#if scratchPasse && epreuve.horaires.scratch}
          <p class="avertissement">{t.apresScratch(epreuve.horaires.scratch)}</p>
        {/if}
      </section>
    {/if}

    <!-- CA-2 et CA-3 : la liste à pointer, avec recherche et filtres. -->
    <section class="carte liste" aria-labelledby="titre-liste">
      <div class="entete-liste">
        <h3 id="titre-liste">{t.liste}</h3>
        <label class="recherche">
          <Icone nom="loupe" taille={18} />
          <input
            type="search"
            bind:value={recherche}
            onkeydown={surEntreeRecherche}
            aria-label={t.rechercher}
            placeholder={t.exempleRecherche}
          />
        </label>
        <div class="filtres" role="group" aria-label={t.afficher}>
          {#each [['toutes', tireurs.length], ['absentes', tireurs.length - presents], ['presentes', presents]] as const as [cle, nombre] (cle)}
            <button type="button" class="pilule" aria-pressed={filtre === cle} onclick={() => (filtre = cle)}
              >{t.filtres[cle]} <span class="nombre">{nombre}</span></button
            >
          {/each}
        </div>
      </div>
      {#if tireurs.length === 0}
        <p class="vide">{t.aucunInscrit}</p>
      {:else if visibles.length === 0}
        <p class="vide">{t.aucunResultat}</p>
      {:else}
        <ul aria-label={t.liste}>
          {#each visibles as tireur (tireur.id)}
            <li>
              <button
                type="button"
                role="checkbox"
                class="ligne-tireur"
                class:present={tireur.present}
                aria-checked={tireur.present}
                aria-label={t.pointer(nomAffiche(tireur))}
                disabled={!modifiable}
                onclick={() => basculer(tireur)}
              >
                <span class="case" aria-hidden="true"
                  >{#if tireur.present}<Icone nom="coche" taille={18} />{/if}</span
                >
                <span class:discret={tireur.classement === null}>{tireur.classement ?? ti.sansClassement}</span>
                <span><strong>{tireur.nom.toUpperCase()}</strong> {tireur.prenom}</span>
                <span class="discret">{tireur.club}</span>
                <span class="etat">{tireur.present ? t.present(tireur.heure) : t.absent}</span>
              </button>
            </li>
          {/each}
        </ul>
      {/if}
      <p class="pied">{t.aide}</p>
    </section>
  {/if}
{/snippet}

{#if remiseDemandee}
  <ConfirmationArchivage
    titre={t.confirmerRemise}
    detail={t.detailRemise(presents)}
    action={t.remettre}
    valider={remettreAbsents}
    fermer={() => (remiseDemandee = false)}
  />
{/if}

{#if epreuve}
  <GabaritEpreuve {accueil} {epreuve} courante="emargement" suite={t.titre} {naviguer}>
    {@render etape()}
  </GabaritEpreuve>
{:else}
  <main>{@render etape()}</main>
{/if}

<style>
  .titre-etape {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.75rem 1rem;
  }

  .identite {
    display: grid;
    gap: 0.25rem;
  }

  .ligne {
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

  h3 {
    margin: 0;
    font-size: 1rem;
  }

  .compteur {
    padding: 0.15rem 0.75rem;
    border-radius: 999px;
    background: var(--etat-ok-fond);
    color: var(--sur-etat-ok-fond);
    font-size: 0.875rem;
    font-weight: 600;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
  }

  .discret,
  .vide,
  .pied {
    margin: 0;
    color: var(--texte-discret);
  }

  .carte {
    display: grid;
    gap: 0.75rem;
    padding: 1rem;
    border: 1px solid var(--bordure);
    border-radius: 14px;
    background: var(--surface);
  }

  .sur-place {
    border: 2px solid var(--accent);
  }

  .saisie {
    display: grid;
    grid-template-columns: minmax(0, 1.2fr) minmax(0, 1.2fr) minmax(0, 1.4fr) minmax(0, 0.8fr) auto auto;
    gap: 0.75rem;
    align-items: end;
  }

  .saisie label {
    display: grid;
    gap: 0.25rem;
    font-size: 0.875rem;
    font-weight: 600;
  }

  input {
    box-sizing: border-box;
    min-height: 2.75rem;
    padding: 0 0.75rem;
    border: 1px solid var(--bordure-champ);
    border-radius: var(--rayon);
    background: var(--surface);
    color: var(--texte);
    font: inherit;
    font-weight: 400;
  }

  .majuscules {
    text-transform: uppercase;
  }

  button {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    min-height: 2.75rem;
    padding: 0 1rem;
    border-radius: var(--rayon);
    font: inherit;
    cursor: pointer;
  }

  button:disabled {
    cursor: not-allowed;
  }

  .principal {
    border: none;
    background: var(--palette-tiffany);
    color: var(--sur-tiffany);
    font-weight: 600;
  }

  .principal:disabled {
    opacity: 0.55;
  }

  .secondaire {
    border: 1px solid var(--bordure-champ);
    background: var(--surface);
    color: var(--texte);
  }

  .secondaire.accent {
    border-color: var(--accent);
    background: var(--accent-teinte);
    color: var(--accent);
    font-weight: 600;
  }

  .liste {
    gap: 0;
    padding: 0;
    overflow: hidden;
  }

  .entete-liste {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.6rem 1rem;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--bordure);
  }

  .recherche {
    flex: 1 1 16rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0 0.75rem;
    border: 2px solid var(--accent);
    border-radius: var(--rayon);
    color: var(--texte-discret);
  }

  .recherche input {
    flex: 1;
    min-width: 0;
    border: none;
    padding: 0;
  }

  .filtres {
    display: flex;
    gap: 0.4rem;
  }

  .pilule {
    min-height: 2.5rem;
    padding: 0 0.9rem;
    border: 1px solid var(--bordure);
    border-radius: 999px;
    background: var(--surface);
    color: var(--texte);
    font-size: 0.875rem;
    font-weight: 600;
  }

  .pilule[aria-pressed='true'] {
    border-color: var(--marque);
    background: var(--marque);
    color: var(--sur-marque);
  }

  .nombre {
    font-weight: 400;
  }

  ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li + li {
    border-top: 1px solid var(--bordure);
  }

  .ligne-tireur {
    display: grid;
    grid-template-columns: 2.75rem 4.5rem minmax(0, 1fr) minmax(0, 1fr) 10rem;
    gap: 0.75rem;
    align-items: center;
    width: 100%;
    min-height: 3.25rem;
    padding: 0.25rem 1rem;
    border: none;
    border-radius: 0;
    background: var(--surface);
    color: var(--texte);
    text-align: left;
  }

  .ligne-tireur.present {
    background: var(--accent-teinte);
  }

  .case {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.75rem;
    height: 1.75rem;
    border: 2px solid var(--bordure-champ);
    border-radius: 8px;
    color: var(--sur-marque);
  }

  .present .case {
    border-color: var(--etat-ok);
    background: var(--etat-ok);
  }

  .etat {
    justify-self: end;
    color: var(--texte-discret);
    font-size: 0.875rem;
    font-weight: 600;
  }

  .present .etat {
    color: var(--sur-etat-ok-fond);
  }

  .vide,
  .pied {
    padding: 0.75rem 1rem;
    font-size: 0.875rem;
  }

  .pied {
    border-top: 1px solid var(--bordure);
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

  /* Principe 13 : sur un écran étroit, une colonne ; la ligne garde la case, le nom et l'état. */
  @media (max-width: 40rem) {
    .saisie {
      grid-template-columns: minmax(0, 1fr);
    }

    .ligne-tireur {
      grid-template-columns: 2.75rem minmax(0, 1fr) auto;
    }

    .ligne-tireur > :nth-child(2),
    .ligne-tireur > :nth-child(4) {
      display: none;
    }
  }
</style>
