<script lang="ts">
  // Plan de la manifestation (US-049), page réservée : une ligne par compétition, une colonne par jour, des tuiles pour
  // les épreuves. On y complète le plan (ajouter une épreuve dans une case, des épreuves à une compétition) et on déplace une
  // épreuve d'un jour à l'autre. Les données viennent de la liste du club (index, copies, journal local) : hors ligne, le
  // plan reste affiché depuis la copie de l'appareil et seuls l'ajout d'une épreuve et le changement de jour restent possibles
  // (ce qui s'écrit dans le journal local). Le plan lui-même est construit par le domaine.
  import { onMount } from 'svelte';
  import {
    construireListePlan,
    jourOppose,
    originesDe,
    peutChangerDeJour,
    type LignePlan,
    type Plan,
    type TuilePlan,
  } from '@poule-position/domaine';
  import type { Competition, Manifestation } from '@poule-position/protocole';
  import Lien from '../composants/Lien.svelte';
  import FilAriane from '../composants/FilAriane.svelte';
  import { filSousAccueil } from '../lib/fil-ariane';
  import type { Accueil, DonneesAccueil } from '../lib/accueil';
  import type { Journal } from '../lib/journal';
  import { changerJour, detailsDesTuiles, horairesConnus, type DetailEpreuve } from '../lib/plan';
  import {
    cheminGrilleEpreuves,
    cheminNouvelleCompetition,
    cheminDupliquerEpreuve,
    cheminNouvelleEpreuveDans,
    CHEMINS,
    cheminModificationManifestation,
    cheminEpreuve,
  } from '../lib/routes';
  import type { SessionAppareil } from '../lib/stockage';
  import type { Synchronisation } from '../lib/synchronisation';
  import { textes } from '../lib/textes';

  interface Proprietes {
    session: SessionAppareil;
    journal: Journal;
    synchronisation: Synchronisation;
    accueil: Accueil;
    manifestationId: string;
    naviguer: (chemin: string) => void;
  }

  let { session, journal, synchronisation, accueil, manifestationId, naviguer }: Proprietes = $props();

  const t = textes.plan;
  const te = textes.epreuves;

  let donnees = $state<DonneesAccueil | null>(null);
  let details = $state<Record<string, DetailEpreuve>>({});
  let enLigne = $state(navigator.onLine);
  /** Écran étroit (CA-6) : une liste par jour à la place du tableau. */
  let etroit = $state(false);
  /** Tuile dont le panneau est ouvert. */
  let choisie = $state<string | null>(null);
  let jourCible = $state('');
  let message = $state<{ ok: boolean; texte: string } | null>(null);
  let enCours = $state(false);

  const plan: Plan | null = $derived(donnees ? construireListePlan(donnees, manifestationId, details) : null);
  const tuiles = $derived(plan ? plan.lignes.flatMap((ligne) => ligne.cases.flat()) : []);
  const tuileChoisie = $derived(tuiles.find(({ id }) => id === choisie) ?? null);
  const ligneChoisie = $derived(
    plan?.lignes.find((ligne) => ligne.cases.flat().some(({ id }) => id === choisie)) ?? null,
  );
  const jours = $derived(plan?.colonnes.flatMap(({ jour }) => (jour === null ? [] : [jour])) ?? []);

  async function charger() {
    const lues = await accueil.charger();
    const identifiants = lues.epreuves.map(({ id }) => id);
    donnees = lues;
    details = await detailsDesTuiles(journal, identifiants);
  }

  onMount(() => {
    const requete = window.matchMedia('(max-width: 48rem)');
    const surLargeur = () => (etroit = requete.matches);
    surLargeur();
    requete.addEventListener('change', surLargeur);
    const surReseau = () => {
      enLigne = navigator.onLine;
      void charger();
    };
    window.addEventListener('online', surReseau);
    window.addEventListener('offline', surReseau);
    void charger();
    return () => {
      requete.removeEventListener('change', surLargeur);
      window.removeEventListener('online', surReseau);
      window.removeEventListener('offline', surReseau);
    };
  });

  function choisir(tuile: TuilePlan) {
    choisie = choisie === tuile.id ? null : tuile.id;
    jourCible = tuile.date ?? '';
    message = null;
  }

  /** CA-6 : déplace l'épreuve choisie vers `vers` (le jour du sélecteur, ou le jour opposé d'un geste). */
  async function deplacer(vers = jourCible) {
    if (!tuileChoisie || !donnees || enCours || !vers || vers === tuileChoisie.date) return;
    jourCible = vers;
    enCours = true;
    message = null;
    try {
      const resultat = await changerJour(
        journal,
        tuileChoisie.id,
        jourCible,
        { clubId: session.compte.clubId, auteur: session.compte.email },
        $state.snapshot(donnees.manifestations) as Manifestation[],
        $state.snapshot(donnees.competitions) as Competition[],
      );
      if (resultat.ok) {
        const jour = te.dateLongue(jourCible);
        void synchronisation.envoyer(tuileChoisie.id);
        await charger();
        message = { ok: true, texte: t.jourChange(jour) };
      } else message = { ok: false, texte: t.jourRefuse };
    } finally {
      enCours = false;
    }
  }

  /** CA-4 : les horaires que l'appareil connaît (appel, scratch, poules), séparés par « · » ; « — » s'il n'y en a aucun. */
  const horaires = (detail: DetailEpreuve | undefined) =>
    horairesConnus(detail)
      .map(({ champ, heure }) => t.horaire[champ](heure))
      .join(' · ') || '—';

  const libelleJour = (jour: string | null) => (jour === null ? t.jourAFixer : te.dateLongue(jour));

  /** CA-3 : « comme la compétition », « comme la manifestation » ou « modifiée » à côté d'une valeur reprise. */
  const origine = (tuile: TuilePlan, ligne: LignePlan) =>
    plan
      ? originesDe(
          { arme: tuile.arme, lieu: details[tuile.id]?.lieu ?? null },
          { competition: ligne.competition, manifestation: plan.manifestation },
        )
      : null;
</script>

{#snippet tuile(entree: TuilePlan)}
  <button
    type="button"
    class="tuile"
    class:choisie={choisie === entree.id}
    aria-pressed={choisie === entree.id}
    aria-label={t.tuile(entree.nom)}
    onclick={() => choisir(entree)}
  >
    <strong>{t.titreTuile(entree.categorie ?? entree.nom, entree.sexe ? te.sexes[entree.sexe] : null)}</strong>
    <span class="detail">
      {#if entree.appel}{t.appel(entree.appel)} ·{/if}
      {te.statuts[entree.statut]}
    </span>
    {#if !entree.pilote}<span class="badge">{t.lectureSeule}</span>{/if}
    {#if entree.nonEnvoyee}<span class="badge">{t.nonEnvoyee}</span>{/if}
  </button>
{/snippet}

{#snippet ajout(ligne: LignePlan, jour: string)}
  <button
    type="button"
    class="plus"
    aria-label={t.plusDans(ligne.competition.nom, te.dateLongue(jour))}
    onclick={() => naviguer(cheminNouvelleEpreuveDans(ligne.competition.id, jour))}>{t.plus}</button
  >
{/snippet}

{#snippet entreeCompetition(ligne: LignePlan)}
  <span class="couleur" style="--couleur: var(--plan-{ligne.couleur})" aria-hidden="true"></span>
  <span class="nom-competition">
    <strong>{ligne.competition.nom}</strong>
    <small>{ligne.competition.arme ? te.armes[ligne.competition.arme] : t.competitionSansArme}</small>
    <Lien
      chemin={cheminGrilleEpreuves(ligne.competition.id)}
      {naviguer}
      etiquette={t.ajouterEpreuves(ligne.competition.nom)}>{t.ajouterEpreuvesCourt}</Lien
    >
  </span>
{/snippet}

<main>
  {#if donnees === null}
    <p role="status">{t.chargement}</p>
  {:else if plan === null}
    <p class="message" role="alert">{t.introuvable}</p>
    <Lien chemin={CHEMINS.manifestations} {naviguer}>{t.retour}</Lien>
  {:else}
    <FilAriane niveaux={filSousAccueil(plan.manifestation.nom, [], textes.entete.accueil)} {naviguer} />
    <!-- CA-3 : le bandeau donne le nom, les dates, le lieu, le nombre de compétitions et d'épreuves, et les actions. -->
    <header class="bandeau">
      <div class="identite">
        <h1>{plan.manifestation.nom}</h1>
        <p class="infos">
          {textes.manifestations.periode(plan.manifestation.debut, plan.manifestation.fin)}
          {#if plan.manifestation.lieu}· {plan.manifestation.lieu}{/if}
          · <span>{t.competitions(plan.lignes.length)}</span>, <span>{t.epreuves(plan.nombreEpreuves)}</span>
        </p>
        {#if donnees.horsLigne}<p class="hors-ligne" role="status">{t.horsLigne(donnees.copieLe)}</p>{/if}
      </div>
      <div class="actions">
        <!-- Créer ou modifier une compétition ou une manifestation exige le réseau : grisé hors ligne. -->
        <button
          type="button"
          class="contour"
          disabled={!enLigne}
          onclick={() => naviguer(cheminModificationManifestation(plan.manifestation.id))}
          >{t.modifierManifestation}</button
        >
        <button
          type="button"
          class="clair"
          disabled={!enLigne}
          onclick={() => naviguer(cheminNouvelleCompetition(plan.manifestation.id))}>{t.ajouterCompetition}</button
        >
        {#if !enLigne}<small>{t.necessiteInternet}</small>{/if}
        <Lien chemin={CHEMINS.manifestations} {naviguer}>{t.retour}</Lien>
      </div>
    </header>

    {#if plan.lignes.length === 0}
      <p class="vide">
        <button
          type="button"
          disabled={!enLigne}
          onclick={() => naviguer(cheminNouvelleCompetition(plan.manifestation.id))}>{t.premiereCompetition}</button
        >
      </p>
    {/if}

    <div class="disposition">
      <div class="zone-plan">
        {#if etroit}
          <!-- CA-6 : sur un écran étroit, un bloc par jour, avec les compétitions dedans. -->
          <div class="par-jour" role="group" aria-label={t.colonnes}>
            {#each plan.colonnes as colonne, indice (colonne.jour ?? 'a-fixer')}
              <section>
                <h2>{libelleJour(colonne.jour)}</h2>
                {#each plan.lignes as ligne (ligne.competition.id)}
                  {@const cases = ligne.cases[indice] ?? []}
                  {#if cases.length > 0 || colonne.jour !== null}
                    <div class="bloc-competition" style="--couleur: var(--plan-{ligne.couleur})">
                      <h3>{@render entreeCompetition(ligne)}</h3>
                      {#each cases as entree (entree.id)}{@render tuile(entree)}{:else}
                        <p class="vide">{t.aucuneEpreuve}</p>
                      {/each}
                      {#if colonne.jour !== null}{@render ajout(ligne, colonne.jour)}{/if}
                    </div>
                  {/if}
                {/each}
              </section>
            {/each}
          </div>
        {:else if plan.lignes.length > 0}
          <div class="defilement">
            <table aria-label={t.colonnes}>
              <thead>
                <tr>
                  <th scope="col">{t.competition}</th>
                  {#each plan.colonnes as colonne (colonne.jour ?? 'a-fixer')}
                    <th scope="col">{libelleJour(colonne.jour)}</th>
                  {/each}
                </tr>
              </thead>
              <tbody>
                {#each plan.lignes as ligne (ligne.competition.id)}
                  <tr style="--couleur: var(--plan-{ligne.couleur})">
                    <th scope="row" class="competition"><div class="entree">{@render entreeCompetition(ligne)}</div></th
                    >
                    {#each plan.colonnes as colonne, indice (colonne.jour ?? 'a-fixer')}
                      <td>
                        {#each ligne.cases[indice] ?? [] as entree (entree.id)}{@render tuile(entree)}{/each}
                        {#if colonne.jour !== null}{@render ajout(ligne, colonne.jour)}{/if}
                      </td>
                    {/each}
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      </div>

      {#if tuileChoisie && ligneChoisie}
        {@const origines = origine(tuileChoisie, ligneChoisie)}
        {@const detail = details[tuileChoisie.id]}
        {@const jourDirect = jourOppose(jours, tuileChoisie.date)}
        <section
          class="panneau"
          aria-label={t.panneau(tuileChoisie.nom)}
          style="--couleur: var(--plan-{ligneChoisie.couleur})"
        >
          <p class="etiquette">{t.epreuveSelectionnee}</p>
          <h2>{tuileChoisie.nom}</h2>
          <dl>
            <dt>{t.competition}</dt>
            <dd>{ligneChoisie.competition.nom}</dd>
            <dt>{t.arme}</dt>
            <dd>
              {te.armes[tuileChoisie.arme]}
              {#if origines?.arme}<span class="origine competition">{t.origines[origines.arme]}</span>{/if}
            </dd>
            <dt>{t.lieu}</dt>
            <dd>
              {#if detail?.lieu}
                {detail.lieu}
                {#if origines?.lieu}<span class="origine {origines.lieu}">{t.origines[origines.lieu]}</span>{/if}
              {:else}—{/if}
            </dd>
            <dt>{t.jour}</dt>
            <dd>
              {tuileChoisie.date ? te.dateLongue(tuileChoisie.date) : t.jourAFixer}
              {#if tuileChoisie.date}<span class="origine manifestation">{t.origines.jour}</span>{/if}
            </dd>
            <dt>{t.horaires}</dt>
            <dd>{horaires(detail)}</dd>
            {#if detail}
              <dt>{t.type}</dt>
              <dd>{te.types[detail.typeEpreuve]}</dd>
              <dt>{t.formule}</dt>
              <dd>{detail.formuleModifiee ? t.formuleModifiee : t.formuleParDefaut}</dd>
            {/if}
          </dl>
          {#if !detail}<p class="discret">{t.detailInconnu}</p>{/if}

          {#if peutChangerDeJour(tuileChoisie)}
            <div class="changer">
              {#if jourDirect}
                <!-- CA-6 : deux jours, un seul bouton ; à trois jours ou plus, le choix du jour reste proposé. -->
                <button type="button" class="secondaire" onclick={() => deplacer(jourDirect)} disabled={enCours}
                  >{t.changerDeJourVers(t.jourSemaine(jourDirect))}</button
                >
              {:else}
                <label for="nouveau-jour">{t.nouveauJour}</label>
                <select id="nouveau-jour" bind:value={jourCible} disabled={enCours}>
                  {#each jours as jour (jour)}<option value={jour}>{te.dateLongue(jour)}</option>{/each}
                </select>
                <button
                  type="button"
                  onclick={() => deplacer()}
                  disabled={enCours || !jourCible || jourCible === tuileChoisie.date}>{t.changerDeJour}</button
                >
              {/if}
            </div>
          {:else}
            <p class="discret">{tuileChoisie.pilote ? t.jourFige : t.jourLectureSeule}</p>
          {/if}
          {#if message}<p class={message.ok ? 'message ok' : 'message'} role="status">{message.texte}</p>{/if}
          <div class="actions">
            <Lien chemin={cheminEpreuve(tuileChoisie.id)} {naviguer}>{t.ouvrir}</Lien>
            <Lien chemin={cheminDupliquerEpreuve(tuileChoisie)} {naviguer}>{t.dupliquer}</Lien>
            <button type="button" class="secondaire" onclick={() => (choisie = null)}>{t.fermer}</button>
          </div>
        </section>
      {/if}
    </div>
  {/if}
</main>

<style>
  main {
    display: grid;
    gap: 1.25rem;
    padding: 1.5rem 1rem 3rem;
    max-width: 100%;
  }

  h1 {
    margin: 0;
  }

  .infos,
  .discret,
  small {
    color: var(--texte-discret);
  }

  .infos {
    margin: 0;
  }

  /* CA-3 : le bandeau d'entête de la manifestation, foncé comme le cadre de la liste et de l'assistant. */
  .bandeau {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: flex-end;
    gap: 1rem;
    padding: 1.25rem 1.5rem;
    border-radius: 1rem;
    background: var(--marque);
    color: var(--sur-marque);
  }

  .identite {
    display: grid;
    gap: 0.25rem;
  }

  .bandeau .infos,
  .bandeau small {
    color: var(--sur-marque);
  }

  .bandeau :global(a) {
    color: var(--sur-marque);
  }

  .hors-ligne {
    margin: 0;
    padding: 0.4rem 0.75rem;
    border-left: 4px solid var(--etat-attente);
    background: var(--surface);
    color: var(--texte);
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem;
  }

  button {
    padding: 0.5rem 0.9rem;
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
  }

  .bandeau button.contour {
    border: 1px solid var(--sur-marque);
    background: transparent;
    color: var(--sur-marque);
  }

  .bandeau button.clair {
    background: var(--sur-marque);
    color: var(--marque);
  }

  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* CA-2 : le plan, et le panneau de l'épreuve choisie à côté quand la place le permet, sinon dessous. */
  .disposition {
    display: flex;
    flex-wrap: wrap;
    gap: 1.25rem;
    align-items: flex-start;
  }

  .zone-plan {
    flex: 999 1 44rem;
    min-width: 0;
    padding: 1rem;
    border: 1px solid var(--bordure);
    border-radius: 1rem;
    background: var(--surface);
  }

  .defilement {
    overflow-x: auto;
    max-height: 75vh;
  }

  table {
    border-collapse: separate;
    border-spacing: 0 0.6rem;
    width: 100%;
  }

  /* CA-6 et cas limite : l'entête des jours reste visible quand il y a beaucoup de compétitions. */
  thead th {
    position: sticky;
    top: 0;
    z-index: 1;
    background: var(--surface);
    text-align: left;
    padding: 0.25rem 0.5rem;
    text-transform: capitalize;
  }

  /* CA-1 : chaque compétition est une bande au fond teinté, à la bordure et au nom de sa couleur (--couleur). */
  tbody tr,
  .bloc-competition {
    --fond-bande: color-mix(in srgb, var(--couleur) 12%, var(--surface));
    --bord-bande: color-mix(in srgb, var(--couleur) 35%, var(--surface));
  }

  td,
  th.competition {
    vertical-align: top;
    padding: 0.6rem;
    border-top: 1px solid var(--bord-bande);
    border-bottom: 1px solid var(--bord-bande);
    background: var(--fond-bande);
    text-align: left;
  }

  th.competition {
    border-left: 1px solid var(--bord-bande);
    border-radius: 0.75rem 0 0 0.75rem;
  }

  td:last-child {
    border-right: 1px solid var(--bord-bande);
    border-radius: 0 0.75rem 0.75rem 0;
  }

  td {
    min-width: 11rem;
  }

  .entree,
  h3 {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    font-size: 1rem;
    margin: 0;
  }

  .nom-competition {
    display: grid;
    gap: 0.15rem;
  }

  .nom-competition strong {
    color: var(--couleur);
  }

  .couleur {
    flex: none;
    width: 0.4rem;
    align-self: stretch;
    min-height: 2.5rem;
    border-radius: 0.25rem;
    background: var(--couleur);
  }

  .tuile {
    display: grid;
    gap: 0.1rem;
    width: 100%;
    margin-bottom: 0.4rem;
    padding: 0.4rem 0.6rem;
    border: 1px solid var(--bordure);
    border-radius: 0.6rem;
    background: var(--surface);
    color: var(--texte);
    text-align: left;
    font-weight: 400;
  }

  .tuile strong {
    font-weight: 600;
  }

  /* CA-2 : la tuile choisie est mise en évidence. */
  .tuile.choisie {
    border-color: var(--texte);
    box-shadow:
      0 0 0 1px var(--texte),
      0 4px 12px color-mix(in srgb, var(--texte) 20%, transparent);
  }

  .tuile .detail,
  .badge {
    font-size: 0.85rem;
    color: var(--texte-discret);
  }

  .plus {
    padding: 0.25rem 0.6rem;
    border: 1px dashed var(--bordure-champ);
    background: transparent;
    color: var(--texte-discret);
    font-weight: 400;
  }

  .par-jour {
    display: grid;
    gap: 1rem;
  }

  .par-jour h2 {
    margin: 0;
    text-transform: capitalize;
    font-size: 1.1rem;
  }

  .bloc-competition {
    display: grid;
    gap: 0.4rem;
    margin-top: 0.5rem;
    padding: 0.6rem;
    border: 1px solid var(--bord-bande);
    border-radius: 0.75rem;
    background: var(--fond-bande);
  }

  .vide {
    margin: 0;
    color: var(--texte-discret);
  }

  .panneau {
    flex: 1 1 21rem;
    min-width: 0;
    display: grid;
    gap: 0.75rem;
    padding: 1.25rem;
    border: 2px solid var(--texte);
    border-radius: 1rem;
    background: var(--surface);
  }

  .panneau h2 {
    margin: 0;
  }

  .etiquette {
    margin: 0;
    color: var(--texte-discret);
    font-size: 0.8rem;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }

  dl {
    display: grid;
    grid-template-columns: max-content minmax(0, 1fr);
    gap: 0.4rem 1rem;
    margin: 0;
  }

  dt {
    font-weight: 600;
  }

  dd {
    margin: 0;
  }

  /* CA-5 : l'origine d'une valeur reprise (« comme la compétition », « jour de la manifestation », « modifiée »). */
  .origine {
    display: inline-block;
    padding: 0.05rem 0.55rem;
    border-radius: 999px;
    background: var(--surface-2);
    color: var(--texte);
    font-size: 0.8rem;
    font-weight: 600;
  }

  .origine.competition {
    background: color-mix(in srgb, var(--couleur) 12%, var(--surface));
    color: var(--couleur);
  }

  .origine.modifiee {
    background: color-mix(in srgb, var(--etat-attente) 20%, var(--surface));
  }

  .changer {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
  }

  select {
    padding: 0.5rem;
    border: 1px solid var(--bordure-champ);
    border-radius: var(--rayon);
    background: var(--fond);
    color: var(--texte);
    font: inherit;
  }

  .message {
    margin: 0;
    padding: 0.5rem 0.75rem;
    border-left: 4px solid var(--etat-erreur);
    background: var(--surface);
  }

  .message.ok {
    border-left-color: var(--etat-ok);
  }
</style>
