<script lang="ts">
  // Écran géant (US-134, planches 31 à 35) : ouvert par le lien d'un écran (`/ecran/<id>#<jeton>`), sans entête de
  // l'application ni action. Il fait défiler seul les pages des épreuves cochées (appel des matchs, poules, classement,
  // tableau, podium), suit chaque score en moins de 2 s et dit l'heure de la dernière mise à jour quand le pilote ou le
  // réseau manque. Thème sombre ou clair selon l'écran (US-140), mise à l'échelle de l'écran (16 px à 1920 × 1080).
  // US-141 : bandeau des derniers scores en bas ; US-142 : quatre poules par page ; US-143 : tableau en arbre.
  import { onMount } from 'svelte';
  import { SvelteMap } from 'svelte/reactivity';
  import type { MatchTableauVue, PouleDirect, VueDirect } from '@poule-position/domaine';
  import { ecranPublic, type EcranPublic, type VueImposee } from '@poule-position/protocole';
  import { creerConnexionEcran, type EtatEcran, type VueRecue } from '../lib/connexion-ecran';
  import { creerEcouteLocale } from '../lib/diffusion-locale';
  import { creerClientEcrans } from '../lib/ecrans';
  import { groupesDuBandeau, pagesDeLEcran, type GroupeBandeau, type PageEcran } from '../lib/ecran-geant';
  import { urlHttp } from '../lib/session';
  import { textes } from '../lib/textes';

  interface Proprietes {
    ecranId: string;
    urlServeur: string | undefined;
    /** US-136 : fenêtre locale du PC pilote, alimentée aussi sans réseau (`BroadcastChannel`). */
    local?: boolean;
  }

  let { ecranId, urlServeur, local = false }: Proprietes = $props();
  const t = textes.ecranGeant;

  let etatServeur: EtatEcran | null = $state(null);
  /** US-136 : réglages de la copie de ce PC, vues des épreuves pilotées ici et vue imposée depuis ce PC. */
  let ecranCopie: EcranPublic | null = $state(null);
  const vuesLocales = new SvelteMap<string, VueRecue>();
  let imposeeLocale: { vue: VueImposee | null } | null = $state(null);
  const etat: EtatEcran | null = $derived.by(() => {
    if (!local) return etatServeur;
    const ecran = etatServeur?.ecran ?? ecranCopie;
    if (!ecran) return etatServeur;
    const plusRecentes = [...vuesLocales].filter(
      ([id, recue]) => (etatServeur?.vues.get(id)?.publieeLe ?? 0) <= recue.publieeLe,
    );
    const vues = new Map([...(etatServeur?.vues ?? []), ...plusRecentes]);
    const pilotes = new Map([
      ...(etatServeur?.pilotes ?? []),
      ...[...vuesLocales.keys()].map((id) => [id, true] as const),
    ]);
    return {
      ecran: imposeeLocale ? { ...ecran, vueImposee: imposeeLocale.vue } : ecran,
      titre: etatServeur?.titre ?? '',
      vues,
      pilotes,
      horsLigne: false,
      lienInvalide: false,
    };
  });
  let maintenant = $state(Date.now());
  let indice = $state(0);
  let debutPage = $state(Date.now());
  let pleinEcran = $state(false);

  const vues = $derived(
    new Map([...(etat?.vues ?? new Map()).entries()].map(([id, { vue }]) => [id, vue as VueDirect])),
  );
  const pages = $derived(etat?.ecran ? pagesDeLEcran(etat.ecran, vues, maintenant) : []);
  const page: PageEcran | null = $derived(pages.length > 0 ? pages[indice % pages.length]! : null);
  const vue = $derived(page && 'epreuveId' in page ? (vues.get(page.epreuveId) ?? null) : null);
  const recue = $derived(page && 'epreuveId' in page ? (etat?.vues.get(page.epreuveId) ?? null) : null);
  const nom = $derived(new Map((vue?.tireurs ?? []).map((tireur) => [tireur.id, tireur.nom])));
  const club = $derived(new Map((vue?.tireurs ?? []).map((tireur) => [tireur.id, tireur.club])));
  const duree = $derived((etat?.ecran?.dureePage ?? 15) * 1000);
  const perimee = $derived(
    Boolean(etat?.horsLigne) || (page !== null && 'epreuveId' in page && etat?.pilotes.get(page.epreuveId) === false),
  );

  // US-140 CA-2 et CA-3 : le style de l'écran décide, pas celui de l'appareil ; il change sans rechargement.
  $effect(() => {
    document.documentElement.dataset.theme = etat?.ecran?.style === 'clair' ? 'clair' : 'sombre';
  });

  // US-141 : le bandeau fait défiler un groupe (une épreuve) à la fois ; le groupe suivant est relu à la fin du passage.
  const groupes = $derived(
    etat?.ecran?.bandeau?.actif
      ? groupesDuBandeau(etat.ecran.epreuves, vues, etat.ecran.bandeau.minutes, maintenant)
      : [],
  );
  let passage: { groupe: GroupeBandeau; numero: number } | null = $state(null);
  let numeroPassage = 0;
  function passageSuivant() {
    const precedent = passage ? groupes.findIndex(({ epreuveId }) => epreuveId === passage!.groupe.epreuveId) : -1;
    const groupe = groupes[(precedent + 1) % Math.max(groupes.length, 1)];
    numeroPassage += 1;
    passage = groupe ? { groupe, numero: numeroPassage } : null;
  }
  $effect(() => {
    if (groupes.length === 0) passage = null;
    else if (!passage) passageSuivant();
  });
  /** Fait défiler le texte de droite à gauche (environ 120 px/s à 1920 px de large), puis passe au groupe suivant. */
  function defiler(noeud: HTMLElement) {
    const depart = noeud.parentElement?.clientWidth ?? 0;
    const largeur = noeud.scrollWidth;
    const vitesse = Math.max(window.innerWidth / 16, 40);
    const animation = noeud.animate?.(
      [{ transform: `translateX(${depart}px)` }, { transform: `translateX(${-largeur}px)` }],
      { duration: ((depart + largeur) / vitesse) * 1000, easing: 'linear' },
    );
    if (animation) animation.onfinish = passageSuivant;
    return { destroy: () => animation?.cancel() };
  }
  const texteScore = ({ score, tireurA, tireurB }: GroupeBandeau['scores'][number]) =>
    score.poule !== null
      ? t.scorePoule(tireurA, score.touchesA, score.touchesB, tireurB, score.poule)
      : t.scoreTableau(t.tour(score.tour ?? 2), tireurA, score.touchesA, score.touchesB, tireurB);

  const heure = (instant: number) => {
    const date = new Date(instant);
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  };

  onMount(() => {
    const jeton = location.hash.slice(1);
    // US-136 CA-5 : rouverte sans réseau, la fenêtre locale repart de la copie des écrans de ce PC.
    if (local) {
      const copie = creerClientEcrans({ urlServeur: null, jeton: async () => null }).copie();
      const ecran = copie?.ecrans.find(({ id }) => id === ecranId);
      if (ecran) ecranCopie = ecranPublic(ecran);
    }
    const ecoute = local
      ? creerEcouteLocale({
          ecranId,
          epreuves: () => etat?.ecran?.epreuves ?? [],
          surVue: (epreuveId, vue, publieeLe) => void vuesLocales.set(epreuveId, { vue, publieeLe }),
          surImposer: (vue) => (imposeeLocale = { vue }),
        })
      : null;
    const arreterEcoute = ecoute?.demarrer() ?? (() => {});
    const connexion = creerConnexionEcran({
      urlServeur,
      urlHttp: urlHttp(urlServeur),
      ecranId,
      jeton,
      surEtat: (nouvel) => (etatServeur = { ...nouvel }),
    });
    connexion.demarrer();
    // CA-2 : défilement ; l'horloge suit.
    const minuteur = setInterval(() => {
      maintenant = Date.now();
      if (maintenant - debutPage >= duree) {
        indice = (indice + 1) % Math.max(pages.length, 1);
        debutPage = maintenant;
      }
    }, 250);
    // Cas limite : la TV ne doit pas se mettre en veille.
    const veille = (navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<unknown> } }).wakeLock;
    void veille?.request('screen').catch(() => {});
    const surPleinEcran = () => (pleinEcran = Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', surPleinEcran);
    return () => {
      clearInterval(minuteur);
      arreterEcoute();
      connexion.arreter();
      document.removeEventListener('fullscreenchange', surPleinEcran);
    };
  });

  function libellePage(p: PageEcran | null): string {
    if (!p) return '';
    if (p.type === 'appel') return t.appel;
    if (p.type === 'poules') return t.poules(p.poules.map(({ numero }) => numero));
    if (p.type === 'classement') return p.final ? t.classementFinal : t.classement;
    if (p.type === 'tableau') return p.arbre.moitie ? t.moitie(p.arbre.moitie) : t.tableau;
    if (p.type === 'podium') return t.terminee;
    return t.attente;
  }

  /** US-142 CA-2 : la case d'une poule, vue de la ligne : « V » (et ses touches au temps), les touches, ou vide. */
  function caseDe(poule: PouleDirect, ligne: string, colonne: string): string {
    const match = poule.matchs.find(
      ({ tireurA, tireurB }) =>
        (tireurA === ligne && tireurB === colonne) || (tireurA === colonne && tireurB === ligne),
    );
    if (!match?.touches) return '';
    const [miennes, autres] = match.tireurA === ligne ? match.touches : [match.touches[1], match.touches[0]];
    if (miennes > autres) return match.auTemps ? `V${miennes}` : 'V';
    return String(miennes);
  }
  const ratio = (victoires: number, matchs: number) =>
    (matchs > 0 ? victoires / matchs : 0).toFixed(3).replace('.', ',');
  const signe = (indice: number) => `${indice > 0 ? '+' : ''}${indice}`;

  const enPiste = (poule: PouleDirect) =>
    poule.matchs.find(({ touches, forfait }) => touches === null && !forfait) ?? null;
  /** US-143 CA-2 : une place d'un match de l'arbre : rang et nom, « exempt », ou « – » si elle n'est pas connue. */
  const placeArbre = (m: MatchTableauVue, cote: 'haut' | 'bas') => {
    const place = m[cote];
    if (place.tireurId) return { rang: place.rang, nom: nom.get(place.tireurId) ?? '', exempt: false };
    return { rang: null, nom: m.etat === 'exempt' ? t.exempt : '–', exempt: m.etat === 'exempt' };
  };
  const podium = $derived(
    (vue?.classementFinal ?? [])
      .filter(({ place }) => place !== null && place <= 3)
      .sort((a, b) => (a.place ?? 0) - (b.place ?? 0)),
  );
</script>

<div class="ecran">
  {#if etat?.lienInvalide}
    <p class="message">{t.lienInvalide}</p>
  {:else if !etat?.ecran}
    <p class="message">{t.connexion}</p>
  {:else}
    <header>
      <div class="titres">
        <span class="lieu">{etat.titre}</span>
        <span class="epreuve">{vue?.nom ?? etat.ecran.nom}</span>
      </div>
      <span class="pastille">{libellePage(page)}</span>
      <span class="heure">{heure(maintenant)}</span>
      {#if !pleinEcran}
        <button
          type="button"
          class="plein"
          onclick={() => void document.documentElement.requestFullscreen?.().catch(() => {})}
        >
          {t.pleinEcran}
        </button>
      {/if}
    </header>

    <main>
      {#if page?.type === 'appel'}
        <div class="pistes">
          {#each page.pistes as carte (carte.piste)}
            <section class="piste {carte.etat}" aria-label={t.piste(carte.piste)}>
              <div class="tete-piste">
                <span class="nom-piste">{t.piste(carte.piste)}</span>
                <span class="etat-piste">{t.etats[carte.etat]}</span>
              </div>
              {#if carte.contexte && 'poule' in carte.contexte}
                <span class="contexte"
                  >{t.contextePoule(carte.contexte.poule, carte.contexte.numero, carte.contexte.total)}</span
                >
              {:else if carte.contexte && 'tour' in carte.contexte}
                <span class="contexte">{t.tour(carte.contexte.tour)}</span>
              {:else if carte.contexte && 'pouleTerminee' in carte.contexte}
                <span class="contexte">{t.pouleTerminee(carte.contexte.pouleTerminee)}</span>
              {/if}
              {#if carte.tireurs}
                <div class="duel">
                  <span class="gauche">{carte.tireurs[0]}</span>
                  <span class="contre">{t.contre}</span>
                  <span class="droite">{carte.tireurs[1]}</span>
                </div>
              {:else}
                <span class="contexte">{t.aucunMatch}</span>
              {/if}
              {#if carte.puis}<div class="puis">{t.puis(carte.puis[0], carte.puis[1])}</div>{/if}
            </section>
          {/each}
        </div>
      {:else if page?.type === 'poules'}
        <!-- US-142 : quatre poules par page, en grille de deux sur deux, avec V, M, V/M, TD, TR, Ind et Rang. -->
        <div class="poules">
          {#each page.poules as poule (poule.numero)}
            {@const courant = enPiste(poule)}
            <section class="poule" aria-label={t.poule(poule.numero)}>
              <div class="tete-poule">
                <span class="nom-poule">{t.poule(poule.numero)}</span>
                <span class="avance">{t.matchsRegles(poule.regles, poule.total)}</span>
              </div>
              <table>
                <thead>
                  <tr>
                    <th class="nom"><span class="masque">{t.tireur}</span></th>
                    <th><span class="masque">N°</span></th>
                    {#each poule.tireurIds as id, rang (id)}<th class="case-tete">{rang + 1}</th>{/each}
                    <th class="debut-resultats">V</th>
                    <th>M</th>
                    <th>V/M</th>
                    <th>TD</th>
                    <th>TR</th>
                    <th>Ind</th>
                    <th>{t.rang}</th>
                  </tr>
                </thead>
                <tbody>
                  {#each poule.tireurIds as ligne, rang (ligne)}
                    {@const resultat = poule.classement.find(({ tireurId }) => tireurId === ligne)}
                    {@const retire = Boolean(resultat?.retrait)}
                    <tr class:retire>
                      <td class="nom" title={nom.get(ligne) ?? ''}>{nom.get(ligne) ?? ''}</td>
                      <td class="numero">{rang + 1}</td>
                      {#each poule.tireurIds as colonne (colonne)}
                        {@const valeur = ligne === colonne ? '' : caseDe(poule, ligne, colonne)}
                        <td
                          class="case"
                          class:vide={ligne === colonne}
                          class:victoire={valeur.startsWith('V')}
                          class:courant={courant !== null &&
                            ((courant.tireurA === ligne && courant.tireurB === colonne) ||
                              (courant.tireurB === ligne && courant.tireurA === colonne))}>{valeur}</td
                        >
                      {/each}
                      {#if retire || !resultat}
                        {#each [0, 1, 2, 3, 4, 5, 6] as i (i)}<td class:debut-resultats={i === 0}>–</td>{/each}
                      {:else}
                        <td class="debut-resultats">{resultat.victoires}</td>
                        <td>{resultat.matchs}</td>
                        <td>{resultat.matchs > 0 ? ratio(resultat.victoires, resultat.matchs) : '–'}</td>
                        <td>{resultat.touchesDonnees}</td>
                        <td>{resultat.touchesRecues}</td>
                        <td>{signe(resultat.indice)}</td>
                        <td class="fort">{resultat.rang}</td>
                      {/if}
                    </tr>
                  {/each}
                </tbody>
              </table>
            </section>
          {/each}
        </div>
      {:else if page?.type === 'classement'}
        <div class="classement">
          {#each [page.lignes.slice(0, 6), page.lignes.slice(6)] as colonne, c (c)}
            {#if colonne.length > 0}
              <table>
                <thead>
                  <tr><th>{t.rang}</th><th class="nom">{t.tireur}</th><th>V/M</th><th>{t.indice}</th><th>TD</th></tr>
                </thead>
                <tbody>
                  {#each colonne as ligne (ligne.tireurId)}
                    <tr>
                      <td class="fort">{ligne.rang ?? '—'}</td>
                      <td class="nom"
                        >{nom.get(ligne.tireurId) ?? ''} <span class="club">{club.get(ligne.tireurId) ?? ''}</span></td
                      >
                      <td
                        >{ligne.matchs > 0 ? (ligne.victoires / ligne.matchs).toFixed(2).replace('.', ',') : '0,00'}</td
                      >
                      <td>{ligne.indice > 0 ? '+' : ''}{ligne.indice}</td>
                      <td>{ligne.touches}</td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            {/if}
          {/each}
        </div>
      {:else if page?.type === 'tableau'}
        <!-- US-143 : arbre symétrique ; moitié haute à gauche, basse à droite, finale et petite finale au centre. -->
        {@const arbre = page.arbre}
        {#snippet carte(match: MatchTableauVue, miroir: boolean)}
          {@const gagnantHaut = match.vainqueur !== null && match.vainqueur === match.haut.tireurId}
          <div
            class="carte-match"
            class:miroir
            class:appele={match.piste !== null && match.etat === 'aTirer'}
            data-match={match.id}
          >
            {#each [['haut', gagnantHaut, 0], ['bas', match.vainqueur !== null && !gagnantHaut, 1]] as const as [cote, gagnant, i] (cote)}
              {@const place = placeArbre(match, cote)}
              <div class="place" class:gagnant class:exempt={place.exempt} class:inconnue={place.nom === '–'}>
                <span class="rang-place">{place.rang ?? ''}</span>
                <span class="nom-place">{place.nom}</span>
                <span class="score-place">{match.touches ? match.touches[i] : ''}</span>
              </div>
            {/each}
          </div>
        {/snippet}
        <div class="arbre" style="--colonnes: {arbre.tours.length}fr" class:moitie={arbre.moitie !== null}>
          <div class="cote-arbre">
            {#each arbre.tours as tour, c (tour)}
              <div class="colonne-arbre">
                <h3>{t.tour(tour)}</h3>
                <div class="matchs-colonne">
                  {#each arbre.gauche[c] ?? [] as match (match.id)}{@render carte(match, false)}{/each}
                </div>
              </div>
            {/each}
          </div>
          {#if !arbre.moitie}
            <div class="centre-arbre">
              {#if arbre.finale}
                <h3>{t.tour(2)}</h3>
                {@render carte(arbre.finale, false)}
              {/if}
              {#if arbre.troisieme}
                <h3>{t.petiteFinale}</h3>
                {@render carte(arbre.troisieme, false)}
              {/if}
            </div>
            <div class="cote-arbre droite-arbre">
              {#each [...arbre.tours].reverse() as tour, c (tour)}
                <div class="colonne-arbre">
                  <h3>{t.tour(tour)}</h3>
                  <div class="matchs-colonne">
                    {#each arbre.droite[arbre.tours.length - 1 - c] ?? [] as match (match.id)}{@render carte(
                        match,
                        true,
                      )}{/each}
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {:else if page?.type === 'podium'}
        <div class="podium">
          <h2>{t.podium}</h2>
          <div class="marches">
            {#each [2, 1, 3] as place (place)}
              {@const laureats = podium.filter((l) => l.place === place)}
              <div class="marche m{place}">
                <span class="laureat">{laureats.map((l) => nom.get(l.tireurId)).join(' · ')}</span>
                <span class="club">{laureats.map((l) => club.get(l.tireurId)).join(' · ')}</span>
                <div class="socle">{place}</div>
              </div>
            {/each}
          </div>
        </div>
      {:else}
        <p class="message">{t.attenteDetail}</p>
      {/if}
    </main>

    <!-- US-141 : bandeau des derniers scores (partie fixe : l'épreuve) ; l'heure de mise à jour reste à droite. -->
    <footer>
      {#if passage}
        <div class="bandeau" aria-label={t.bandeau}>
          <span class="bandeau-epreuve">{passage.groupe.nom}</span>
          <div class="bandeau-fenetre">
            {#key passage.numero}
              <div class="bandeau-texte" use:defiler>
                {#each passage.groupe.scores as score, i (i)}<span class="bandeau-score">{texteScore(score)}</span
                  >{/each}
              </div>
            {/key}
          </div>
        </div>
      {/if}
      <span role="status" class="mise-a-jour">
        {#if recue}{perimee ? t.derniereMiseAJour(heure(recue.publieeLe)) : t.misAJour(heure(recue.publieeLe))}{/if}
      </span>
    </footer>
  {/if}
</div>

<style>
  .ecran {
    position: fixed;
    inset: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--fond);
    color: var(--texte);
    font-family: var(--police-texte);
    font-size: min(0.8333vw, 1.4815vh);
  }

  .message {
    margin: auto;
    padding: 2em;
    font-size: 2em;
    text-align: center;
  }

  header {
    display: flex;
    align-items: center;
    gap: 2em;
    padding: 1em 3em;
    border-bottom: 1px solid var(--bordure);
  }

  .titres {
    display: flex;
    flex-direction: column;
    gap: 0.25em;
  }

  .lieu,
  .contexte,
  .club,
  footer {
    color: var(--texte-discret);
    font-size: 1.5em;
  }

  .club {
    font-size: 0.75em;
    font-weight: 400;
  }

  .epreuve,
  .heure,
  .nom-piste,
  h2,
  .socle {
    font-family: var(--police-titre);
    font-weight: 700;
  }

  .epreuve {
    font-size: 2.75em;
  }

  .pastille {
    margin-left: auto;
    padding: 0.4em 0.8em;
    border-radius: 999px;
    background: var(--accent-teinte);
    color: var(--accent-survol, var(--accent));
    font-size: 1.625em;
    font-weight: 700;
  }

  .heure {
    font-size: 3.25em;
  }

  .plein {
    padding: 0.5em 1em;
    border: 1px solid var(--bordure-champ);
    border-radius: 0.6em;
    background: var(--surface);
    color: var(--texte);
    font: inherit;
    font-size: 1.25em;
    cursor: pointer;
  }

  main {
    flex: 1;
    min-height: 0;
    padding: 1.5em 3em;
  }

  /* Pied : bandeau des derniers scores (US-141), puis l'heure de la dernière mise à jour, à droite. */
  footer {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 1em;
    padding: 0.85em 2.3em;
    border-top: 1px solid var(--bordure);
  }

  .bandeau {
    display: flex;
    flex: 1;
    min-width: 0;
    align-items: center;
    overflow: hidden;
    border-radius: 0.5em;
    background: var(--surface);
  }

  .bandeau-epreuve {
    flex: none;
    padding: 0.35em 0.9em;
    background: var(--accent);
    color: var(--sur-accent);
    font-weight: 700;
  }

  .bandeau-fenetre {
    position: relative;
    flex: 1;
    min-width: 0;
    height: 1.9em;
    overflow: hidden;
  }

  .bandeau-texte {
    position: absolute;
    top: 0;
    left: 0;
    display: flex;
    gap: 3em;
    padding-top: 0.3em;
    color: var(--texte);
    white-space: nowrap;
    will-change: transform;
  }

  .mise-a-jour {
    flex: none;
  }

  .pistes {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 1.75em;
    height: 100%;
  }

  .piste,
  .poule {
    display: flex;
    flex-direction: column;
    gap: 1.1em;
    padding: 1.75em;
    border: 2px solid var(--bordure);
    border-radius: 1.25em;
    background: var(--surface);
  }

  .piste.enPiste {
    border-color: var(--accent);
  }

  .piste.aTirer {
    border-color: var(--etat-attente);
  }

  .tete-piste,
  .tete-poule {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 1em;
  }

  .nom-piste {
    font-size: 2.5em;
  }

  .etat-piste {
    padding: 0.25em 0.65em;
    border-radius: 999px;
    background: var(--surface-2);
    color: var(--texte-discret);
    font-size: 1.5em;
    font-weight: 700;
  }

  .enPiste .etat-piste {
    background: var(--accent);
    color: var(--sur-accent);
  }

  .aTirer .etat-piste {
    background: var(--etat-attente-fond);
    color: var(--etat-attente);
  }

  .duel {
    display: flex;
    flex-direction: column;
    gap: 0.2em;
    font-size: 2.375em;
    font-weight: 700;
  }

  .contre {
    color: var(--texte-discret);
    font-size: 0.63em;
    font-weight: 400;
  }

  .gauche {
    color: var(--cote-gauche);
  }

  .droite {
    color: var(--cote-droit);
  }

  .puis {
    margin-top: auto;
    padding-top: 1em;
    border-top: 1px solid var(--bordure);
    color: var(--texte-discret);
    font-size: 1.5em;
  }

  .classement {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 2em;
    align-items: start;
  }

  /* US-142 : quatre poules, deux sur deux ; une dernière page incomplète garde la même taille de poule. */
  .poules {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    grid-template-rows: repeat(2, minmax(0, 1fr));
    gap: 1.25em;
    height: 100%;
  }

  .poule {
    gap: 0.3em;
    padding: 0.6em 1em;
    overflow: hidden;
  }

  .nom-poule {
    font-family: var(--police-titre);
    font-size: 1.75em;
    font-weight: 700;
  }

  .avance {
    margin-right: auto;
    color: var(--texte-discret);
    font-size: 1.1em;
    font-weight: 700;
  }

  .poule table {
    margin-block: auto;
    font-size: 1.25em;
  }

  .poule th {
    padding: 0.15em 0.2em;
  }

  .poule td {
    padding: 0.1em 0.25em;
  }

  .poule td.nom {
    max-width: 9em;
    font-size: 1.1em;
    overflow: hidden;
    border-top: none;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .numero {
    border-top: none;
    color: var(--texte-discret);
    font-size: 0.75em;
  }

  .case {
    min-width: 1.9em;
    border: 1px solid var(--bordure);
    font-weight: 700;
  }

  .case-tete {
    min-width: 1.9em;
  }

  .debut-resultats {
    border-left: 2px solid var(--bordure);
  }

  .retire .nom,
  .retire .case {
    color: var(--texte-discret);
    text-decoration: line-through;
  }

  .masque {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
  }

  /* US-143 : arbre symétrique ; chaque colonne répartit ses matchs, ce qui les aligne entre leurs deux précédents. */
  .arbre {
    display: grid;
    grid-template-columns: minmax(0, var(--colonnes)) minmax(0, 0.9fr) minmax(0, var(--colonnes));
    gap: 0.6em;
    height: 100%;
  }

  .arbre.moitie {
    grid-template-columns: minmax(0, 1fr);
  }

  .cote-arbre {
    display: grid;
    grid-auto-columns: minmax(0, 1fr);
    grid-auto-flow: column;
    gap: 0.6em;
    min-height: 0;
  }

  .colonne-arbre {
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  .colonne-arbre h3,
  .centre-arbre h3 {
    margin: 0 0 0.4em;
    font-size: 1.05em;
    font-weight: 700;
    text-align: center;
  }

  .matchs-colonne {
    display: flex;
    flex: 1;
    flex-direction: column;
    justify-content: space-around;
    min-height: 0;
  }

  .centre-arbre {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 0.75em;
  }

  .carte-match {
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 0.2em 0.4em;
    border: 1px solid var(--bordure);
    border-radius: 0.4em;
    background: var(--surface);
  }

  .carte-match.appele {
    border-color: var(--accent);
  }

  .place {
    display: grid;
    grid-template-columns: 1.3em minmax(0, 1fr) auto;
    align-items: baseline;
    gap: 0.3em;
    color: var(--texte-discret);
    font-size: 1.1em;
    line-height: 1.35;
  }

  .miroir .place {
    grid-template-columns: auto minmax(0, 1fr) 1.3em;
    text-align: right;
  }

  .miroir .rang-place {
    order: 3;
  }

  .miroir .score-place {
    order: 1;
  }

  .rang-place {
    font-size: 0.75em;
  }

  .nom-place {
    overflow: hidden;
    color: var(--texte);
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .place.gagnant .nom-place,
  .place.gagnant .score-place {
    color: var(--accent);
    font-weight: 800;
  }

  .place.exempt .nom-place,
  .place.inconnue .nom-place {
    color: var(--texte-discret);
    font-weight: 400;
  }

  .place.exempt .nom-place {
    font-style: italic;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 1.75em;
    font-variant-numeric: tabular-nums;
  }

  th {
    padding: 0.3em;
    color: var(--texte-discret);
    font-size: 0.8em;
    font-weight: 600;
  }

  td {
    padding: 0.35em;
    border-top: 1px solid var(--bordure);
    text-align: center;
  }

  .classement td {
    padding: 0.45em 0.3em;
    text-align: left;
  }

  .nom {
    font-weight: 600;
    text-align: left;
  }

  .fort {
    font-weight: 700;
  }

  .vide {
    background: var(--surface-2);
  }

  .victoire {
    color: var(--cote-droit);
    font-weight: 700;
  }

  .courant {
    outline: 3px solid var(--accent);
    outline-offset: -3px;
  }

  h2 {
    margin: 0;
    font-size: 2.125em;
  }

  .podium {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3em;
    height: 100%;
  }

  .podium h2 {
    font-size: 4em;
  }

  .marches {
    display: flex;
    align-items: flex-end;
    gap: 2em;
  }

  .marche {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1em;
    width: 26em;
    text-align: center;
  }

  .laureat {
    font-size: 2.5em;
    font-weight: 700;
  }

  .marche .club {
    font-size: 1.625em;
  }

  .socle {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    border-radius: 1.25em 1.25em 0 0;
    background: var(--surface-2);
    color: var(--texte-discret);
    font-size: 5.5em;
  }

  .m1 .socle {
    height: 2.9em;
    background: var(--accent);
    color: var(--sur-accent);
  }

  .m2 .socle {
    height: 2em;
  }

  .m3 .socle {
    height: 1.45em;
    background: var(--surface);
    border: 1px solid var(--bordure);
  }
</style>
