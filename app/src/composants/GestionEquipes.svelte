<script lang="ts">
  // Équipes d'une épreuve par équipes (US-146, US-147, planche 40) : alerte des tireurs sans équipe, liste rangée par la
  // somme des classements des titulaires (tirage au sort à égalité), flèches « Monter » et « Descendre » pour corriger le
  // rang, crayon pour modifier, « ⋯ » pour supprimer ou revenir au rang calculé, « Nouvelle équipe ».
  import {
    clubEquipe,
    equipeDuTireur,
    equipesDe,
    poulesDe,
    rangCalcule,
    analyserImportEquipes,
    rangEquipes,
    sommeClassements,
    tableauDe,
    tailleEquipe,
    tireursDe,
    type AnalyseImportEquipes,
    type Epreuve,
    type Equipe,
    type Tireur,
  } from '@poule-position/domaine';
  import {
    creerEquipe,
    deplacer,
    importerEquipes,
    modifierEquipe,
    rangerEquipes,
    supprimerEquipe,
    type ChampsEquipe,
  } from '../lib/equipes';
  import type { Contexte, ResultatInscription } from '../lib/inscriptions';
  import type { Journal } from '../lib/journal';
  import { lireFichierEquipes } from '../lib/fichier-equipes';
  import { textes } from '../lib/textes';
  import ApercuImportEquipes from './ApercuImportEquipes.svelte';
  import ConfirmationArchivage from './ConfirmationArchivage.svelte';
  import FenetreEquipe from './FenetreEquipe.svelte';
  import Icone from './Icone.svelte';
  import MenuActions from './MenuActions.svelte';

  interface Proprietes {
    epreuve: Epreuve;
    journal: Journal;
    contexte: Contexte;
    /** Faux en lecture seule (autre PC pilote, épreuve archivée…). */
    modifiable: boolean;
    /** Après une écriture : relit et envoie ; renvoie vrai si elle a réussi. */
    apres: (resultat: ResultatInscription) => Promise<boolean>;
  }

  let { epreuve, journal, contexte, modifiable, apres }: Proprietes = $props();
  const t = textes.equipes;

  let fenetre: { equipe: Equipe | null } | null = $state(null);
  let suppression: Equipe | null = $state(null);
  let erreur: string | null = $state(null);

  // US-156 : import des équipes depuis un CSV, lu sur l'appareil puis montré dans un aperçu.
  const ti = textes.importEquipes;
  let champFichier: HTMLInputElement | undefined = $state();
  let apercu: AnalyseImportEquipes | null = $state(null);
  let annonce = $state('');

  /** CA-1, CA-2 et CA-5 : lit le fichier choisi et ouvre l'aperçu, ou dit pourquoi il est refusé. */
  async function choisirFichier(evenement: Event & { currentTarget: HTMLInputElement }) {
    const fichier = evenement.currentTarget.files?.[0];
    evenement.currentTarget.value = '';
    if (!fichier) return;
    erreur = null;
    annonce = '';
    const lu = lireFichierEquipes(new Uint8Array(await fichier.arrayBuffer()));
    if (!lu.ok) {
      erreur = [ti.erreurs[lu.erreur], lu.manquantes ? ti.colonnesManquantes(lu.manquantes) : null]
        .filter(Boolean)
        .join(' · ');
      return;
    }
    apercu = analyserImportEquipes(lu.lignes, { typeEpreuve: epreuve.typeEpreuve, tireurs, equipes });
  }

  /** CA-3 : importe, relit la liste et dit le résultat. */
  async function importer() {
    const encours = apercu;
    if (!encours) return;
    const rendu = await importerEquipes(journal, epreuve.id, encours.importables, contexte);
    await apres({ ok: true });
    annonce = ti.resultat(rendu.equipes, rendu.tireurs, encours.ecartees.length, rendu.echecs);
    apercu = null;
  }

  const tireurs = $derived(tireursDe(epreuve));
  const equipes = $derived(equipesDe(epreuve));
  const ordre = $derived(epreuve.ordreEquipes ?? null);
  const rangees = $derived(rangEquipes(equipes, tireurs, ordre));
  const calcule = $derived(rangCalcule(equipes, tireurs));
  /** US-146 CA-4 : après le lancement des poules ou la création du tableau, seul le remplaçant se change. */
  const figee = $derived(poulesDe(epreuve).lancees || tableauDe(epreuve).qualifies !== null);
  const sansEquipe = $derived(tireurs.filter((tireur) => !equipeDuTireur(equipes, tireur.id)));
  const nomDe = (id: string) => {
    const tireur = tireurs.find((x) => x.id === id);
    return tireur ? `${tireur.nom.toUpperCase()} ${tireur.prenom}` : '';
  };
  const peutCreer = $derived(sansEquipe.length >= tailleEquipe(epreuve.typeEpreuve));

  /** US-147 CA-2 : « tirage au sort » si une voisine a la même somme ; CA-3 : « rang modifié » si corrigé à la main. */
  function note(equipe: Equipe, i: number): string | null {
    if (ordre && calcule[i]?.id !== equipe.id) return t.rangModifie;
    const somme = sommeClassements(equipe, tireurs);
    const egale = equipes.some((autre) => autre.id !== equipe.id && sommeClassements(autre, tireurs) === somme);
    return egale ? t.tirage : null;
  }

  const message = (resultat: ResultatInscription) =>
    resultat.ok ? null : (t.erreurs[resultat.erreur] ?? t.erreurs.AUTRE!);

  async function enregistrer(equipe: Equipe | null, champs: ChampsEquipe): Promise<string | null> {
    const ecriture = equipe
      ? modifierEquipe(journal, epreuve.id, equipe, champs, contexte)
      : creerEquipe(journal, epreuve.id, champs, contexte);
    if (!ecriture) return null;
    const resultat = await ecriture;
    await apres(resultat);
    return message(resultat);
  }

  async function bouger(equipe: Equipe, sens: -1 | 1) {
    const nouvel = deplacer(
      rangees.map(({ id }) => id),
      equipe.id,
      sens,
    );
    if (!nouvel) return;
    const resultat = await rangerEquipes(journal, epreuve.id, nouvel, contexte);
    erreur = message(resultat);
    await apres(resultat);
  }

  async function revenirAuCalcul() {
    const resultat = await rangerEquipes(journal, epreuve.id, null, contexte);
    erreur = message(resultat);
    await apres(resultat);
  }

  async function validerSuppression() {
    const equipe = suppression;
    if (!equipe) return { ok: true as const };
    const resultat = await supprimerEquipe(journal, epreuve.id, equipe.id, contexte);
    await apres(resultat);
    const texte = message(resultat);
    return texte ? { ok: false as const, message: texte } : { ok: true as const };
  }

  const titulairesDe = (equipe: Equipe): Tireur[] =>
    equipe.titulaires.map((id) => tireurs.find((x) => x.id === id)).filter((x): x is Tireur => x !== undefined);
</script>

{#if sansEquipe.length > 0}
  <!-- CA-5 : les tireurs sans équipe ne tireront pas. -->
  <div class="alerte" role="status">
    <Icone nom="alerte" taille={20} />
    <span>{t.sansEquipe(sansEquipe.map((x) => `${x.nom.toUpperCase()} ${x.prenom} (${x.club})`))}</span>
  </div>
{/if}
{#if figee}<p class="avertissement" role="status">{t.figees}</p>{/if}

<section class="carte" aria-labelledby="titre-equipes">
  <div class="entete">
    <h3 id="titre-equipes">{t.titreListe}</h3>
    {#if modifiable && !figee}
      <button
        type="button"
        class="secondaire"
        disabled={!peutCreer}
        title={peutCreer ? undefined : t.pasAssez}
        onclick={() => (fenetre = { equipe: null })}
      >
        <Icone nom="plus" taille={20} />{t.nouvelle}
      </button>
      <!-- US-156 : « Importer un fichier… » (bouton neutre) ouvre le choix d'un CSV d'équipes. -->
      <button type="button" class="secondaire" onclick={() => champFichier?.click()}>
        <Icone nom="televerser" taille={20} />{ti.importerFichier}
      </button>
      <input
        bind:this={champFichier}
        class="invisible"
        type="file"
        accept=".csv,text/csv,text/plain"
        aria-label={ti.choisir}
        tabindex="-1"
        onchange={choisirFichier}
      />
      {#if ordre}
        <MenuActions
          id="menu-equipes"
          etiquette={t.revenirAuCalcul}
          contour
          actions={[{ libelle: t.revenirAuCalcul, icone: 'flechesCroisees', surChoix: () => void revenirAuCalcul() }]}
        />
      {/if}
    {/if}
  </div>
  {#if erreur}<p class="erreur" role="alert">{erreur}</p>{/if}
  <p class="invisible" role="status" aria-live="polite">{annonce}</p>
  {#if rangees.length === 0}
    <p class="vide">{t.aucune}</p>
  {:else}
    <ol class="equipes">
      {#each rangees as equipe, i (equipe.id)}
        {@const remarque = note(equipe, i)}
        <li aria-label={equipe.nom}>
          <span class="fleches">
            {#if modifiable && !figee}
              <button
                type="button"
                class="fleche haut"
                aria-label={t.monter(equipe.nom)}
                title={t.monter(equipe.nom)}
                disabled={i === 0}
                onclick={() => void bouger(equipe, -1)}><Icone nom="chevron" taille={16} /></button
              >
              <button
                type="button"
                class="fleche bas"
                aria-label={t.descendre(equipe.nom)}
                title={t.descendre(equipe.nom)}
                disabled={i === rangees.length - 1}
                onclick={() => void bouger(equipe, 1)}><Icone nom="chevron" taille={16} /></button
              >
            {/if}
          </span>
          <span class="rang"
            ><strong>{i + 1}</strong><span class="discret">{t.somme(sommeClassements(equipe, tireurs))}</span></span
          >
          <span class="identite">
            <strong>{equipe.nom}</strong>
            <span class="discret"
              >{clubEquipe(equipe, tireurs)}{#if remarque}
                · <em>{remarque}</em>{/if}</span
            >
          </span>
          <span class="tireurs">
            {#each titulairesDe(equipe) as tireur (tireur.id)}
              <span
                ><strong>{tireur.nom.toUpperCase()}</strong>
                {tireur.prenom} <span class="discret">{tireur.classement ?? t.nonClasse}</span></span
              >
            {/each}
            {#if equipe.remplacant}<span class="discret">{t.remplacant} : {nomDe(equipe.remplacant)}</span>{/if}
          </span>
          <span class="actions">
            {#if modifiable}
              <button
                type="button"
                class="icone"
                aria-label={t.modifier(equipe.nom)}
                title={t.modifier(equipe.nom)}
                onclick={() => (fenetre = { equipe })}><Icone nom="crayon" taille={18} /></button
              >
              {#if !figee}
                <MenuActions
                  id="menu-equipe-{equipe.id}"
                  nom={equipe.nom}
                  contour
                  actions={[
                    {
                      libelle: t.supprimer,
                      icone: 'corbeille',
                      destructive: true,
                      surChoix: () => (suppression = equipe),
                    },
                  ]}
                />
              {/if}
            {/if}
          </span>
        </li>
      {/each}
    </ol>
  {/if}
  <p class="pied">{t.aide}</p>
</section>

{#if apercu}
  <ApercuImportEquipes analyse={apercu} {importer} fermer={() => (apercu = null)} />
{/if}

{#if fenetre}
  {@const modifiee = fenetre.equipe}
  <FenetreEquipe
    {epreuve}
    equipe={modifiee}
    {figee}
    enregistrer={(champs) => enregistrer(modifiee, champs)}
    fermer={() => (fenetre = null)}
  />
{/if}

{#if suppression}
  <ConfirmationArchivage
    titre={t.confirmerSuppression(suppression.nom)}
    detail={t.detailSuppression}
    action={t.supprimerAction}
    valider={validerSuppression}
    fermer={() => (suppression = null)}
  />
{/if}

<style>
  .invisible {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }

  .alerte {
    display: flex;
    gap: 0.6rem;
    align-items: flex-start;
    padding: 0.75rem 1rem;
    border: 1px solid var(--etat-attente-bordure);
    border-radius: 12px;
    background: var(--etat-attente-fond);
    color: var(--sur-etat-attente-fond);
  }

  .carte {
    border: 1px solid var(--bordure);
    border-radius: 14px;
    background: var(--surface);
    overflow: hidden;
  }

  .entete {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--bordure);
  }

  /* Boutons neutres de l'en-tête (« Nouvelle équipe », « Importer un fichier… »), comme ceux de l'étape (planche 40). */
  .secondaire {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    min-height: 2.75rem;
    padding: 0 1rem;
    border: 1px solid var(--bordure-champ);
    border-radius: var(--rayon);
    background: var(--surface);
    color: var(--texte);
    font: inherit;
    cursor: pointer;
  }

  .secondaire:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }

  h3 {
    flex: 1;
    margin: 0;
    font-size: 1rem;
  }

  .equipes {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .equipes li {
    display: grid;
    grid-template-columns: 2.5rem 4rem minmax(0, 1.1fr) minmax(0, 2.4fr) auto;
    gap: 0.75rem;
    align-items: center;
    padding: 0.6rem 1rem;
  }

  .equipes li + li {
    border-top: 1px solid var(--bordure);
  }

  .fleches {
    display: grid;
    gap: 2px;
  }

  .fleche {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 1.5rem;
    border: 1px solid var(--bordure);
    border-radius: 6px;
    background: var(--surface);
    color: var(--texte);
    cursor: pointer;
  }

  .fleche:disabled {
    cursor: not-allowed;
    opacity: 0.35;
  }

  .fleche.haut :global(svg) {
    transform: rotate(-90deg);
  }

  .fleche.bas :global(svg) {
    transform: rotate(90deg);
  }

  .rang,
  .identite {
    display: flex;
    flex-direction: column;
  }

  .rang strong {
    font-family: var(--police-titre);
    font-size: 1.25rem;
  }

  .identite em {
    color: var(--etat-attente);
    font-style: normal;
  }

  .tireurs {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 1rem;
  }

  .actions {
    display: flex;
    gap: 0.4rem;
    justify-self: end;
  }

  .icone {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border: 1px solid var(--bordure-champ);
    border-radius: var(--rayon);
    background: var(--surface);
    color: var(--texte);
    cursor: pointer;
  }

  .discret,
  .pied,
  .vide {
    color: var(--texte-discret);
    font-size: 0.9rem;
  }

  .pied,
  .vide {
    margin: 0;
    padding: 0.75rem 1rem;
  }

  .pied {
    border-top: 1px solid var(--bordure);
  }

  .erreur {
    margin: 0;
    padding: 0.5rem 1rem;
    color: var(--etat-erreur);
  }

  .avertissement {
    margin: 0;
  }

  @media (max-width: 40rem) {
    .equipes li {
      grid-template-columns: 2.5rem 3.5rem minmax(0, 1fr) auto;
    }

    .tireurs {
      grid-column: 3 / -1;
    }
  }
</style>
