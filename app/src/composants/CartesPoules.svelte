<script lang="ts">
  // Poules constituées (US-086 et US-087, planche 9) : une carte par poule (piste, moyenne des rangs, tireurs, alertes),
  // glisser-déposer par la poignée ou « ⋯ › Déplacer vers… », liste « À placer » d'une répartition manuelle, puis
  // « Lancer les poules » après confirmation. Chaque changement réécrit la composition entière (`PoulesComposees`).
  import {
    changerPiste,
    clubsEnDouble,
    deplacerTireur,
    memeClubDans,
    moyenneDesClassements,
    pistesEnDouble,
    TAILLE_CONSEILLEE_MAX,
    TAILLE_CONSEILLEE_MIN,
    tireursAPlacer,
    verifierLancement,
    type EtatPoules,
    type Poule,
    type Tireur,
  } from '@poule-position/domaine';
  import ConfirmationArchivage from './ConfirmationArchivage.svelte';
  import Icone from './Icone.svelte';
  import MenuActions, { type ActionMenu } from './MenuActions.svelte';
  import type { VerdictArchivage } from '../lib/archivage';
  import { textes } from '../lib/textes';

  interface Proprietes {
    /** US-122 : ouvre l'impression des feuilles de poule à remplir. */
    imprimerFeuilles?: () => void;
    etat: EtatPoules;
    tireurs: Tireur[];
    manuelle: boolean;
    modifiable: boolean;
    repartirANouveau: () => void;
    /** Écrit la nouvelle composition ; vrai si elle est enregistrée. */
    composer: (poules: Poule[]) => Promise<boolean>;
    lancer: () => Promise<VerdictArchivage>;
  }

  let { etat, tireurs, manuelle, modifiable, repartirANouveau, composer, lancer, imprimerFeuilles }: Proprietes =
    $props();

  const t = textes.poules;
  const ajustable = $derived(modifiable && !etat.lancees);
  const parId = $derived(new Map(tireurs.map((tireur) => [tireur.id, tireur])));
  const aPlacer = $derived(tireursAPlacer(etat, tireurs));
  const tailles = $derived(
    [...new Set(etat.poules.map(({ tireurIds }) => tireurIds.length))].filter((n) => n > 0).sort((a, b) => b - a),
  );
  const pistes = $derived(etat.poules.map(({ piste }) => piste));
  const enDouble = $derived(pistesEnDouble(etat.poules));
  const resume = $derived(
    t.resume(
      etat.poules.length,
      tailles.length === 0 ? '' : `de ${tailles.join(' ou ')}`,
      t.pistesDe(pistes),
      manuelle,
    ),
  );
  const raisonLancement = $derived(verifierLancement(etat, tireurs));
  /** Choix de pistes : celles des poules, et quelques-unes de plus. */
  const choixPistes = $derived(Array.from({ length: Math.max(...pistes, etat.poules.length) + 4 }, (_, i) => i + 1));

  const alertes = (poule: Poule) => {
    const liste = clubsEnDouble(poule, tireurs).map(({ club, nombre }) => t.clubEnDouble(nombre, club));
    const taille = poule.tireurIds.length;
    if (taille > 0 && (taille < TAILLE_CONSEILLEE_MIN || taille > TAILLE_CONSEILLEE_MAX)) {
      liste.push(t.tailleHorsBornes(taille));
    }
    if (enDouble.includes(poule.piste)) liste.push(t.pisteEnDouble(poule.piste));
    return liste;
  };
  /** CA-4 : le nombre d'alertes, résumé dans l'entête. */
  const nombreAlertes = $derived(
    etat.poules.reduce((total, poule) => total + alertes(poule).length, 0) + (aPlacer.length > 0 ? 1 : 0),
  );

  const nomAffiche = (tireur: Tireur) => `${tireur.nom.toUpperCase()} ${tireur.prenom}`;

  let glisse: string | null = $state(null);
  let survol: number | null = $state(null);
  let lancementDemande = $state(false);

  /** CA-2 : avertissement du dépôt dans une poule où le club est déjà présent. */
  const avertissementDepot = $derived.by(() => {
    if (glisse === null || survol === null) return null;
    const tireur = parId.get(glisse);
    const poule = etat.poules.find(({ numero }) => numero === survol);
    if (!tireur || !poule || poule.tireurIds.includes(glisse)) return null;
    const memes = memeClubDans(poule, tireur, tireurs);
    return memes.length > 0 ? t.memeClub(nomAffiche(tireur), nomAffiche(memes[0]!), tireur.club) : null;
  });

  async function deplacer(tireurId: string, vers: number) {
    await composer(deplacerTireur(etat.poules, tireurId, vers));
  }

  function actionsDe(tireur: Tireur, depuis: number | null): ActionMenu[] {
    // US-093 : une seule poule, rien à déplacer ; l'action reste visible, grisée, avec son motif.
    if (depuis !== null && etat.poules.length === 1) {
      return [{ libelle: t.deplacerAilleurs, indisponible: t.unePouleSeule }];
    }
    return etat.poules
      .filter(({ numero }) => numero !== depuis)
      .map(({ numero }) => ({
        libelle: depuis === null ? t.placerDans(numero) : t.deplacerVers(numero),
        surChoix: () => void deplacer(tireur.id, numero),
      }));
  }

  function commencer(evenement: DragEvent, tireurId: string) {
    glisse = tireurId;
    evenement.dataTransfer?.setData('text/plain', tireurId);
    if (evenement.dataTransfer) evenement.dataTransfer.effectAllowed = 'move';
  }

  function finir() {
    glisse = null;
    survol = null;
  }

  async function deposer(evenement: DragEvent, numero: number) {
    evenement.preventDefault();
    const tireurId = evenement.dataTransfer?.getData('text/plain') || glisse;
    finir();
    if (tireurId) await deplacer(tireurId, numero);
  }
</script>

{#snippet ligneTireur(tireur: Tireur, depuis: number | null)}
  <li class:en-deplacement={glisse === tireur.id}>
    {#if ajustable}
      <span
        class="poignee"
        role="button"
        tabindex="-1"
        draggable="true"
        aria-label={t.glisser(nomAffiche(tireur))}
        title={t.glisser(nomAffiche(tireur))}
        ondragstart={(evenement) => commencer(evenement, tireur.id)}
        ondragend={finir}><Icone nom="poignee" taille={18} /></span
      >
    {/if}
    <span class="rang">{tireur.classement ?? '—'}</span>
    <span><strong>{tireur.nom.toUpperCase()}</strong> {tireur.prenom}</span>
    <span class="club">{tireur.club}</span>
    {#if ajustable}
      <MenuActions id="menu-{tireur.id}" nom={nomAffiche(tireur)} actions={actionsDe(tireur, depuis)} contour={false} />
    {/if}
  </li>
{/snippet}

<div class="titre-etape">
  <div class="identite">
    <div class="ligne">
      <h2>{t.titre}</h2>
      <span class="pastille" class:en-cours={etat.lancees}>{etat.lancees ? t.enCours : t.aVerifier}</span>
    </div>
    <p class="discret">{resume}</p>
    {#if ajustable && nombreAlertes > 0}
      <p class="resume-alertes"><Icone nom="alerte" taille={18} />{t.alertes(nombreAlertes)}</p>
    {/if}
  </div>
  {#if ajustable}
    <div class="actions">
      <button type="button" class="secondaire" onclick={repartirANouveau}>
        <Icone nom="flechesCroisees" taille={20} />{t.repartirANouveau}
      </button>
      <button
        type="button"
        class="principal"
        disabled={raisonLancement !== null}
        title={raisonLancement === null ? undefined : t.raisonLancement(raisonLancement, aPlacer.length)}
        onclick={() => (lancementDemande = true)}
      >
        <Icone nom="lecture" taille={20} />{t.lancer}
      </button>
      <MenuActions
        id="menu-poules"
        nom={t.titre}
        actions={[
          {
            libelle: t.imprimerFeuilles,
            icone: 'imprimante',
            ...(imprimerFeuilles ? { surChoix: imprimerFeuilles } : { indisponible: t.imprimerAVenir }),
          },
        ]}
      />
    </div>
  {/if}
</div>

{#if ajustable}
  {#if raisonLancement !== null}
    <p class="discret" role="status">{t.raisonLancement(raisonLancement, aPlacer.length)}</p>
  {/if}
  <p class="info">{t.aideAjustement}</p>
{:else if etat.lancees}
  <p class="info">{t.lanceesFigees}</p>
{/if}

{#if ajustable && aPlacer.length > 0}
  <section class="carte a-placer" aria-labelledby="titre-a-placer">
    <header><h3 id="titre-a-placer">{t.aPlacer(aPlacer.length)}</h3></header>
    <ol>
      {#each aPlacer as tireur (tireur.id)}{@render ligneTireur(tireur, null)}{/each}
    </ol>
  </section>
{/if}

<div class="grille">
  {#each etat.poules as poule (poule.numero)}
    {@const moyenne = moyenneDesClassements(poule, tireurs)}
    {@const signalements = alertes(poule)}
    <section
      class="carte"
      class:cible={survol === poule.numero && glisse !== null && !poule.tireurIds.includes(glisse)}
      aria-labelledby="poule-{poule.numero}"
      ondragover={(evenement) => {
        if (!ajustable || glisse === null) return;
        evenement.preventDefault();
        survol = poule.numero;
      }}
      ondragleave={(evenement) => {
        if (!(evenement.currentTarget as HTMLElement).contains(evenement.relatedTarget as Node)) survol = null;
      }}
      ondrop={(evenement) => deposer(evenement, poule.numero)}
    >
      <header>
        <h3 id="poule-{poule.numero}">{t.poule(poule.numero)}</h3>
        <span class="discret">{t.tireursPoule(poule.tireurIds.length)}{moyenne === null ? '' : t.moyenne(moyenne)}</span
        >
        {#if ajustable}
          <label class="piste"
            >{t.piste}
            <select
              aria-label={t.pisteDe(poule.numero)}
              value={poule.piste}
              onchange={(evenement) =>
                composer(changerPiste(etat.poules, poule.numero, Number(evenement.currentTarget.value)))}
            >
              {#each choixPistes as piste (piste)}<option value={piste}>{t.pisteN(piste)}</option>{/each}
            </select>
          </label>
        {:else}
          <span class="piste">{t.pisteN(poule.piste)}</span>
        {/if}
      </header>
      {#each signalements as signalement (signalement)}
        <p class="alerte"><Icone nom="alerte" taille={18} />{signalement}</p>
      {/each}
      {#if poule.tireurIds.length === 0}
        <p class="vide">{t.pouleVide}</p>
      {:else}
        <ol>
          {#each poule.tireurIds as id (id)}
            {@const tireur = parId.get(id)}
            {#if tireur}{@render ligneTireur(tireur, poule.numero)}{/if}
          {/each}
        </ol>
      {/if}
      {#if survol === poule.numero && avertissementDepot}
        <p class="alerte" role="status"><Icone nom="alerte" taille={18} />{avertissementDepot}</p>
      {/if}
    </section>
  {/each}
</div>

{#if lancementDemande}
  <ConfirmationArchivage
    titre={t.confirmerLancement}
    detail={t.detailLancement}
    action={t.lancer}
    valider={lancer}
    fermer={() => (lancementDemande = false)}
  />
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

  .pastille {
    padding: 0.15rem 0.75rem;
    border-radius: 999px;
    background: var(--etat-attente-fond);
    color: var(--sur-etat-attente-fond);
    font-size: 0.875rem;
    font-weight: 600;
  }

  .pastille.en-cours {
    background: var(--etat-ok-fond);
    color: var(--sur-etat-ok-fond);
  }

  .discret,
  .vide {
    margin: 0;
    color: var(--texte-discret);
    font-size: 0.875rem;
  }

  .resume-alertes {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    margin: 0;
    color: var(--sur-etat-attente-fond);
    font-size: 0.875rem;
    font-weight: 600;
  }

  .info {
    margin: 0;
    padding: 0.75rem 1rem;
    border-radius: var(--rayon);
    background: var(--accent-teinte);
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
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

  .secondaire {
    border: 1px solid var(--bordure-champ);
    background: var(--surface);
    color: var(--texte);
  }

  .principal {
    border: none;
    background: var(--palette-tiffany);
    color: var(--sur-tiffany);
    font-weight: 600;
  }

  .principal:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .grille {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(22rem, 1fr));
    gap: 1rem;
    align-items: start;
  }

  .carte {
    border: 1px solid var(--bordure);
    border-radius: 14px;
    background: var(--surface);
    overflow: hidden;
  }

  .carte.cible {
    border: 2px dashed var(--marque);
  }

  header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.25rem 0.6rem;
    padding: 0.6rem 1rem;
    border-bottom: 1px solid var(--bordure);
  }

  .piste {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    margin-left: auto;
    color: var(--texte-discret);
    font-size: 0.875rem;
  }

  select {
    min-height: 2.5rem;
    padding: 0 0.5rem;
    border: 1px solid var(--bordure-champ);
    border-radius: var(--rayon);
    background: var(--surface);
    color: var(--texte);
    font: inherit;
  }

  .alerte {
    display: flex;
    gap: 0.5rem;
    margin: 0;
    padding: 0.6rem 1rem;
    background: var(--etat-attente-fond);
    color: var(--sur-etat-attente-fond);
    font-size: 0.875rem;
  }

  .vide {
    padding: 1rem;
  }

  ol {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    display: grid;
    grid-template-columns: auto 2.5rem minmax(0, 1fr) auto auto;
    gap: 0.6rem;
    align-items: center;
    min-height: 3rem;
    padding: 0 0.75rem;
  }

  li + li {
    border-top: 1px solid var(--bordure);
  }

  li.en-deplacement {
    outline: 2px dashed var(--bordure-champ);
    outline-offset: -4px;
    opacity: 0.5;
  }

  .poignee {
    display: inline-flex;
    color: var(--texte-discret);
    cursor: grab;
  }

  .rang {
    text-align: right;
    color: var(--texte-discret);
  }

  .club {
    color: var(--texte-discret);
    font-size: 0.875rem;
  }

  /* Principe 13 : sur smartphone, une colonne ; on déplace par « ⋯ › Déplacer vers… ». */
  @media (max-width: 40rem) {
    .grille {
      grid-template-columns: minmax(0, 1fr);
    }

    .poignee {
      display: none;
    }
  }
</style>
