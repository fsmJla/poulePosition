<script lang="ts">
  // Écran géant (US-134, planches 31 à 35) : ouvert par le lien d'un écran (`/ecran/<id>#<jeton>`), sans entête de
  // l'application ni action. Il fait défiler seul les pages des épreuves cochées (appel des matchs, poules, classement,
  // tableau, podium), suit chaque score en moins de 2 s et dit l'heure de la dernière mise à jour quand le pilote ou le
  // réseau manque. Thème sombre, mise à l'échelle de l'écran (16 px à 1920 × 1080).
  import { onMount } from 'svelte';
  import { SvelteMap } from 'svelte/reactivity';
  import type { MatchTableauVue, PouleDirect, VueDirect } from '@poule-position/domaine';
  import { ecranPublic, type EcranPublic, type VueImposee } from '@poule-position/protocole';
  import { creerConnexionEcran, type EtatEcran, type VueRecue } from '../lib/connexion-ecran';
  import { creerEcouteLocale } from '../lib/diffusion-locale';
  import { creerClientEcrans } from '../lib/ecrans';
  import { pagesDeLEcran, type PageEcran } from '../lib/ecran-geant';
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

  const heure = (instant: number) => {
    const date = new Date(instant);
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  };

  onMount(() => {
    document.documentElement.dataset.theme = 'sombre';
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
    // CA-2 : défilement ; l'horloge et la barre d'avancement suivent.
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
    if (p.type === 'tableau') return t.tour(p.tour);
    if (p.type === 'podium') return t.terminee;
    return t.attente;
  }

  /** Planche 32 : la case d'une poule, vue de la ligne : « V », les touches, ou vide. */
  function caseDe(poule: PouleDirect, ligne: string, colonne: string): string {
    const match = poule.matchs.find(
      ({ tireurA, tireurB }) =>
        (tireurA === ligne && tireurB === colonne) || (tireurA === colonne && tireurB === ligne),
    );
    if (!match?.touches) return '';
    const [miennes, autres] = match.tireurA === ligne ? match.touches : [match.touches[1], match.touches[0]];
    return miennes > autres ? 'V' : String(miennes);
  }

  const enPiste = (poule: PouleDirect) =>
    poule.matchs.find(({ touches, forfait }) => touches === null && !forfait) ?? null;
  const placeTableau = (m: MatchTableauVue, cote: 'haut' | 'bas') => {
    const place = m[cote];
    return place.tireurId ? `${place.rang ?? ''} · ${nom.get(place.tireurId) ?? ''}` : '—';
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
        <div class="poules">
          {#each page.poules as poule (poule.numero)}
            {@const courant = enPiste(poule)}
            <section class="poule" aria-label={t.poule(poule.numero)}>
              <div class="tete-poule">
                <span class="nom-piste">{t.poule(poule.numero)}</span>
                <span class="contexte">{t.avancement(poule.piste, poule.regles, poule.total)}</span>
              </div>
              <table>
                <thead>
                  <tr>
                    <th class="nom">{t.tireur}</th>
                    {#each poule.tireurIds as id, rang (id)}<th>{rang + 1}</th>{/each}
                    <th>V</th>
                    <th>{t.indice}</th>
                  </tr>
                </thead>
                <tbody>
                  {#each poule.tireurIds as ligne, rang (ligne)}
                    {@const resultat = poule.classement.find(({ tireurId }) => tireurId === ligne)}
                    <tr>
                      <td class="nom">{rang + 1} · {nom.get(ligne) ?? ''}</td>
                      {#each poule.tireurIds as colonne (colonne)}
                        {@const valeur = ligne === colonne ? '' : caseDe(poule, ligne, colonne)}
                        <td
                          class:vide={ligne === colonne}
                          class:victoire={valeur === 'V'}
                          class:courant={courant !== null &&
                            ((courant.tireurA === ligne && courant.tireurB === colonne) ||
                              (courant.tireurB === ligne && courant.tireurA === colonne))}>{valeur}</td
                        >
                      {/each}
                      <td class="fort">{resultat?.victoires ?? 0}</td>
                      <td>{(resultat?.indice ?? 0) > 0 ? '+' : ''}{resultat?.indice ?? 0}</td>
                    </tr>
                  {/each}
                </tbody>
              </table>
              {#if courant}
                <div class="contexte bas">
                  {t.enPiste(nom.get(courant.tireurA) ?? '', nom.get(courant.tireurB) ?? '')}
                </div>
              {/if}
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
        <div class="tableau">
          <div class="matchs">
            {#each page.matchs as match (match.id)}
              {@const gagnantHaut = match.vainqueur !== null && match.vainqueur === match.haut.tireurId}
              <div
                class="match"
                class:appele={match.piste !== null && match.etat === 'aTirer'}
                class:attente={match.piste !== null && !match.enPiste && match.etat === 'aTirer'}
              >
                <div class="cote" class:gagnant={gagnantHaut}>
                  <span>{placeTableau(match, 'haut')}</span>
                  <span>
                    {#if match.touches}{match.touches[0]}{:else if match.piste !== null && match.etat === 'aTirer'}<span
                        class="appel">{match.enPiste ? t.enPisteN(match.piste) : t.aTirerN(match.piste)}</span
                      >{/if}
                  </span>
                </div>
                <div class="cote" class:gagnant={match.vainqueur !== null && !gagnantHaut}>
                  <span>{placeTableau(match, 'bas')}</span>
                  <span>{match.touches ? match.touches[1] : ''}</span>
                </div>
              </div>
            {/each}
          </div>
          {#if page.suivant.length > 0}
            <div class="suivant">
              <h2>{t.tour(page.tour / 2)}</h2>
              {#each page.suivant as match (match.id)}
                <div class="match petit">
                  <span>{match.haut.tireurId ? nom.get(match.haut.tireurId) : '…'}</span>
                  <span>{match.bas.tireurId ? nom.get(match.bas.tireurId) : '…'}</span>
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

    <footer>
      <span
        >{t.pageSur(pages.length === 0 ? 0 : (indice % pages.length) + 1, pages.length)}{pages.length > 1
          ? ` · ${t.suivante(libellePage(pages[(indice + 1) % pages.length] ?? null))}`
          : ''}</span
      >
      <div class="avancement" aria-hidden="true">
        <div style="width: {Math.min(100, ((maintenant - debutPage) / duree) * 100)}%"></div>
      </div>
      <span role="status">
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
    padding: 1.75em 3.5em;
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
    padding: 2.5em 3.5em;
  }

  footer {
    display: flex;
    align-items: center;
    gap: 1em;
    padding: 0.85em 2.3em;
    border-top: 1px solid var(--bordure);
  }

  .avancement {
    flex: 1;
    height: 0.33em;
    border-radius: 999px;
    background: var(--surface-2);
  }

  .avancement div {
    height: 100%;
    border-radius: 999px;
    background: var(--accent);
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

  .poules,
  .classement {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 2em;
    align-items: start;
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

  .bas {
    margin-top: auto;
  }

  .tableau {
    display: flex;
    gap: 3em;
    height: 100%;
  }

  .matchs {
    display: grid;
    flex: 2;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-content: start;
    gap: 1.25em;
  }

  .match {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border: 2px solid transparent;
    border-radius: 1em;
    background: var(--surface);
  }

  .match.appele {
    border-color: var(--accent);
  }

  .match.attente {
    border-color: var(--etat-attente);
  }

  .cote {
    display: flex;
    justify-content: space-between;
    gap: 1em;
    padding: 0.45em 0.65em;
    color: var(--texte-discret);
    font-size: 1.875em;
  }

  .cote + .cote {
    border-top: 1px solid var(--bordure);
  }

  .cote.gagnant {
    color: var(--texte);
    font-weight: 700;
  }

  .appel {
    padding: 0.05em 0.5em;
    border-radius: 999px;
    background: var(--accent);
    color: var(--sur-accent);
    font-size: 0.73em;
    font-weight: 700;
  }

  .suivant {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 1.25em;
    padding-left: 2.5em;
    border-left: 1px solid var(--bordure);
  }

  h2 {
    margin: 0;
    font-size: 2.125em;
  }

  .match.petit {
    gap: 0.4em;
    padding: 0.85em 1.25em;
    font-size: 1.75em;
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
