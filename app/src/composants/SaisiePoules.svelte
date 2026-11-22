<script lang="ts">
  // Saisie des scores des poules sur le PC (US-088, planche 10) : un onglet par poule, la feuille de poule (V5, touches,
  // V, V/M, TD, TR, indice, rang), la carte du match en cours (Entrée valide et passe au suivant), l'ordre des matchs.
  // Une case de la feuille ouvre son match pour le corriger. Le retrait d'un tireur (US-089) passe par sa ligne.
  import { untrack, type Snippet } from 'svelte';
  import {
    avancementPoules,
    matchsDePoule,
    pouleTerminee,
    resultatsPoule,
    MOTIFS_RETRAIT,
    boutonsDuScore,
    choisirSurPave,
    ouvrirCotePave,
    paveDuScore,
    paveVierge,
    scoreDesBoutons,
    type ChoixScore,
    type EtatPave,
    type EtatPoules,
    type MatchPoule,
    type MotifRetrait,
    type Poule,
    type Tireur,
  } from '@poule-position/domaine';
  import ConfirmationArchivage from './ConfirmationArchivage.svelte';
  import Icone from './Icone.svelte';
  import MenuActions from './MenuActions.svelte';
  import PaveScore from './PaveScore.svelte';
  import type { VerdictArchivage } from '../lib/archivage';
  import { textes } from '../lib/textes';

  interface Proprietes {
    /** US-122 : ouvre l'impression des feuilles de poule à remplir. */
    imprimerFeuilles?: () => void;
    etat: EtatPoules;
    tireurs: Tireur[];
    touches: number;
    modifiable: boolean;
    /** Écrit le score ; vrai s'il est enregistré. */
    saisir: (score: {
      poule: number;
      tireurA: string;
      tireurB: string;
      touchesA: number;
      touchesB: number;
      auTemps: boolean;
      parPriorite?: string;
    }) => Promise<boolean>;
    /** US-150 CA-3 : rencontres par équipes : une égalité se départage par la priorité. */
    priorite?: boolean;
    /** US-089 : retire un tireur des poules, ou annule ce retrait. */
    retirer: (tireurId: string, motif: MotifRetrait) => Promise<VerdictArchivage>;
    annulerRetrait: (tireurId: string) => Promise<VerdictArchivage>;
    /** US-107 CA-4 : contenu ajouté sous la saisie, dans la colonne de droite (les saisies reçues). */
    cote?: Snippet;
  }

  let {
    etat,
    tireurs,
    touches,
    modifiable,
    saisir,
    retirer,
    annulerRetrait,
    cote,
    imprimerFeuilles,
    priorite = false,
  }: Proprietes = $props();
  /** US-150 CA-3 : l'égalité saisie, en attente de la priorité. */
  let egalite: { touchesA: number; touchesB: number } | null = $state(null);
  const tp = textes.pave;

  /** US-089 : le retrait demandé (ou son annulation, motif null), en attente de confirmation. */
  let demande: { tireurId: string; motif: MotifRetrait | null } | null = $state(null);

  const t = textes.poules;
  const parId = $derived(new Map(tireurs.map((tireur) => [tireur.id, tireur])));
  const avancement = $derived(avancementPoules(etat, touches));
  let numero = $state(1);
  const poule = $derived<Poule>(etat.poules.find((p) => p.numero === numero) ?? etat.poules[0]!);
  const matchs = $derived(matchsDePoule(etat, poule, touches));
  const resultats = $derived(resultatsPoule(etat, poule, touches));
  const terminee = $derived(pouleTerminee(etat, poule, touches));
  /** CA-6 : le match ouvert par un clic sur sa case ; sinon le premier match à tirer. */
  let choisi: number | null = $state(null);
  const courant = $derived<MatchPoule | null>(
    matchs.find((m) => m.numero === choisi && !m.forfait) ?? matchs.find(({ touches: tt }) => tt === null) ?? null,
  );
  /** US-118 : l'afficheur et le pavé (gauche : tireurA, droite : tireurB). */
  let pave = $state<EtatPave>(paveVierge());
  let erreur: string | null = $state(null);
  let envoi = $state(false);

  const nom = (id: string) => {
    const tireur = parId.get(id);
    return tireur ? `${tireur.nom.toUpperCase()} ${tireur.prenom}` : '';
  };
  const nomCourt = (id: string) => parId.get(id)?.nom.toUpperCase() ?? '';

  /** US-118 CA-3 : les cases reprennent le score du match ouvert (correction, pavé fermé), ou repartent à vide. */
  const cleCourant = $derived(courant ? `${poule.numero}-${courant.numero}-${courant.touches?.join() ?? ''}` : '');
  $effect(() => {
    void cleCourant;
    const match = untrack(() => courant);
    pave = match?.touches ? paveDuScore(...boutonsDuScore(match.touches[0], match.touches[1], touches)) : paveVierge();
    erreur = null;
  });

  function choisirPoule(n: number) {
    numero = n;
    choisi = null;
  }

  /** CA-2 : la case de la ligne `i` contre la colonne `j`, du point de vue du tireur de la ligne. */
  function caseDe(i: number, j: number) {
    const a = poule.tireurIds[i]!;
    const b = poule.tireurIds[j]!;
    const match = matchs.find((m) => (m.tireurA === a && m.tireurB === b) || (m.tireurA === b && m.tireurB === a));
    if (!match) return { match: null, texte: '' };
    if (!match.touches) return { match, texte: '' };
    const [mes, leurs] = match.tireurA === a ? match.touches : [match.touches[1], match.touches[0]];
    if (match.forfait && match.vainqueur === null) return { match, texte: '0' };
    void leurs;
    return { match, texte: match.vainqueur === a ? `V${mes}` : String(mes) };
  }

  const ratio = (valeur: number) =>
    valeur.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const signe = (valeur: number) => (valeur > 0 ? `+${valeur}` : String(valeur));

  /** US-118 CA-2 et CA-3 (US-091 CA-2 à CA-5) : deux choix enregistrent ; deux « V » ou une égalité recommencent. */
  async function choisir(valeur: ChoixScore) {
    const match = courant;
    if (!match || !modifiable || envoi) return;
    const r = choisirSurPave(pave, valeur);
    pave = r.etat;
    erreur = null;
    if (!r.complet) return;
    const score = scoreDesBoutons(r.etat.valeurs[0]!, r.etat.valeurs[1]!, touches);
    const [a, b] = r.etat.valeurs;
    if (!score.ok && score.raison === 'EGALITE' && priorite && typeof a === 'number' && typeof b === 'number') {
      egalite = { touchesA: a, touchesB: b };
      return;
    }
    if (!score.ok) {
      erreur = score.raison === 'DEUX_VAINQUEURS' ? t.unSeulVainqueur : t.egalite;
      pave = paveVierge();
      return;
    }
    envoi = true;
    try {
      const ok = await saisir({
        poule: poule.numero,
        tireurA: match.tireurA,
        tireurB: match.tireurB,
        touchesA: score.touchesA,
        touchesB: score.touchesB,
        auTemps: score.auTemps,
      });
      if (ok) choisi = null;
    } finally {
      envoi = false;
    }
  }

  /** US-150 CA-3 : enregistre l'égalité avec le vainqueur désigné par la priorité. */
  async function choisirPriorite(vainqueur: string) {
    const match = courant;
    const score = egalite;
    if (!match || !score || envoi) return;
    envoi = true;
    try {
      const ok = await saisir({
        poule: poule.numero,
        tireurA: match.tireurA,
        tireurB: match.tireurB,
        ...score,
        auTemps: true,
        parPriorite: vainqueur,
      });
      if (ok) {
        choisi = null;
        egalite = null;
      }
    } finally {
      envoi = false;
    }
  }

  const tireurPave = (id: string, piste: 'gauche' | 'droite') => ({
    nom: nomCourt(id),
    prenom: parId.get(id)?.prenom ?? '',
    detail: t.cotePiste[piste],
  });
</script>

<!-- US-107 CA-2 : l'étape tient sur une ligne : titre, avancement (l'infobulle dit quand s'ouvre le classement), « ⋯ ». -->
<div class="titre-etape">
  <h2>{t.titre}</h2>
  {#if avancement.regles === avancement.total}
    <p class="discret avancement">{t.toutesTerminees}</p>
  {:else}
    <p class="discret avancement" title={t.classementApres}>
      <span class="barre" aria-hidden="true"
        ><span style:width="{(100 * avancement.regles) / Math.max(1, avancement.total)}%"></span></span
      >
      <span>{t.avancement(avancement.regles, avancement.total)}</span>
    </p>
  {/if}
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

<!-- CA-1 : un onglet par poule, avec sa piste et son avancement ; US-107 CA-3 : sur une ligne, et aucun pour une poule. -->
{#if etat.poules.length > 1}
  <div class="onglets" role="tablist" aria-label={t.titre}>
    {#each etat.poules as p (p.numero)}
      {@const ms = matchsDePoule(etat, p, touches)}
      {@const regles = ms.filter(({ touches: tt }) => tt !== null).length}
      {@const finie = regles === ms.length}
      <button
        type="button"
        role="tab"
        class="onglet"
        aria-selected={p.numero === poule.numero}
        aria-controls="feuille"
        onclick={() => choisirPoule(p.numero)}
      >
        <span class="haut"
          ><strong>{t.poule(p.numero)}</strong>
          {#if finie}<Icone nom="coche" taille={16} />{/if}
          <span class="discret">· {t.pisteN(p.piste)} · {t.ongletAvancement(regles, ms.length, finie)}</span></span
        >
        <span class="barre" aria-hidden="true"
          ><span style:width="{(100 * regles) / Math.max(1, ms.length)}%"></span></span
        >
      </button>
    {/each}
  </div>
{/if}

<div class="corps">
  <div class="carte feuille" id="feuille" role="tabpanel" aria-labelledby="titre-feuille">
    <header>
      <h3 id="titre-feuille">{t.feuille(poule.numero, poule.piste)}</h3>
      {#if modifiable}<span class="discret">{t.cliquezUneCase}</span>{/if}
    </header>
    <div class="defile">
      <table>
        <thead>
          <tr>
            <th scope="col" class="gauche">{t.tireur}</th>
            <th scope="col"><span class="invisible">N°</span></th>
            {#each poule.tireurIds as id, j (id)}<th scope="col">{j + 1}</th>{/each}
            {#each ['victoires', 'ratio', 'td', 'tr', 'indice', 'rang'] as const as cle (cle)}
              <th scope="col"><abbr title={t.colonnesLongues[cle]}>{t.colonnes[cle]}</abbr></th>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#each poule.tireurIds as id, i (id)}
            {@const tireur = parId.get(id)}
            {@const r = resultats[i]!}
            <tr class:retire={r.retrait !== null}>
              <th scope="row" class="gauche">
                <span class="tireur">
                  <span class="identite-tireur">
                    <span class="nom"><strong>{tireur?.nom.toUpperCase()}</strong> {tireur?.prenom}</span>
                    <span class="discret">{tireur?.club}</span>
                  </span>
                  {#if r.retrait}<span class="motif">{t.motifs[r.retrait]}</span>{/if}
                  {#if modifiable}
                    <MenuActions
                      id="menu-retrait-{id}"
                      nom={nom(id)}
                      contour={false}
                      actions={r.retrait
                        ? [{ libelle: t.annulerRetrait, surChoix: () => (demande = { tireurId: id, motif: null }) }]
                        : MOTIFS_RETRAIT.map((motif) => ({
                            libelle: t.retirerMotif(t.motifs[motif]!),
                            detail: t.retirerDetail,
                            destructive: true,
                            surChoix: () => (demande = { tireurId: id, motif }),
                          }))}
                    />
                  {/if}
                </span>
              </th>
              <td class="discret">{i + 1}</td>
              {#each poule.tireurIds as autre, j (autre)}
                {#if i === j}
                  <td class="diagonale" aria-hidden="true"></td>
                {:else}
                  {@const c = caseDe(i, j)}
                  <td>
                    <button
                      type="button"
                      class="case"
                      class:victoire={c.texte.startsWith('V')}
                      class:forfait={c.match?.forfait}
                      class:courante={c.match !== null && courant?.numero === c.match.numero}
                      disabled={!modifiable || c.match === null || c.match.forfait}
                      aria-label={t.caseMatch(nom(id), nom(autre), c.match?.forfait ? t.forfait : c.texte || t.aTirer)}
                      onclick={() => (choisi = c.match?.numero ?? null)}>{c.texte}</button
                    >
                  </td>
                {/if}
              {/each}
              <td>{r.victoires}</td>
              <td>{ratio(r.ratio)}</td>
              <td>{r.touchesDonnees}</td>
              <td>{r.touchesRecues}</td>
              <td>{signe(r.indice)}</td>
              <td><strong>{r.rang}</strong></td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    <p class="legende">{t.legende}</p>
  </div>

  <!-- US-107 CA-4 : l'ordre des matchs sous la feuille, en trois colonnes. -->
  <section class="carte ordre" aria-labelledby="titre-ordre">
    <header><h3 id="titre-ordre">{t.ordreDesMatchs}</h3></header>
    <ol style:grid-template-rows="repeat({Math.ceil(matchs.length / 3)}, auto)">
      {#each matchs as m (m.numero)}
        <li class:courant={modifiable && courant?.numero === m.numero}>
          <span class="numero">{m.numero}.</span>
          <span>{nomCourt(m.tireurA)} – {nomCourt(m.tireurB)}</span>
          <span class="resultat"
            >{#if m.forfait}{t.forfait}{:else if m.touches}{m.touches[0]}–{m
                .touches[1]}{:else if modifiable && courant?.numero === m.numero}{t.enCoursDeSaisie}{/if}</span
          >
        </li>
      {/each}
    </ol>
  </section>

  <div class="cote">
    {#if modifiable}
      <section class="carte saisie" aria-labelledby="titre-saisie">
        {#if courant}
          {@const [i, j] = courant.ordre}
          <header>
            <h3 id="titre-saisie">{t.match(courant.numero, matchs.length)}</h3>
            <span class="discret">{t.contre(i, j)}</span>
          </header>
          <div class="pave">
            <PaveScore
              format="carte"
              tireurs={[tireurPave(courant.tireurA, 'gauche'), tireurPave(courant.tireurB, 'droite')]}
              {touches}
              etat={pave}
              desactive={envoi}
              {choisir}
              ouvrir={(cote) => {
                pave = ouvrirCotePave(pave, cote);
                erreur = null;
                egalite = null;
              }}
            >
              {#snippet ferme()}
                {#if egalite && courant}
                  <p class="egalite">{tp.priorite}</p>
                  <div class="priorite" role="group" aria-label={tp.prioriteGroupe}>
                    <button
                      type="button"
                      class="pour gauche"
                      disabled={envoi}
                      onclick={() => choisirPriorite(courant!.tireurA)}>{nomCourt(courant.tireurA)}</button
                    >
                    <button
                      type="button"
                      class="pour droite"
                      disabled={envoi}
                      onclick={() => choisirPriorite(courant!.tireurB)}>{nomCourt(courant.tireurB)}</button
                    >
                  </div>
                {:else}
                  <p class="discret">{tp.corriger}</p>
                {/if}
              {/snippet}
            </PaveScore>
          </div>
          {#if erreur}<p class="message" role="alert">{erreur}</p>{/if}
          <p class="discret">{t.aideBoutons}</p>
        {:else}
          <h3 id="titre-saisie">{t.feuille(poule.numero, poule.piste)}</h3>
          <p class="discret" role="status">{terminee ? t.pouleFinie : ''}</p>
        {/if}
      </section>
    {/if}

    {#if cote}<div class="cote-suite">{@render cote()}</div>{/if}
  </div>
</div>

{#if demande}
  {@const { tireurId, motif } = demande}
  <ConfirmationArchivage
    titre={motif ? t.confirmerRetrait(nom(tireurId), t.motifs[motif]!) : t.confirmerAnnulation(nom(tireurId))}
    detail={motif ? t.detailRetrait(touches) : t.detailAnnulation}
    action={motif ? t.retirer : t.annulerLeRetrait}
    valider={() => (motif ? retirer(tireurId, motif) : annulerRetrait(tireurId))}
    fermer={() => (demande = null)}
  />
{/if}

<style>
  .egalite {
    margin: 0;
    color: var(--sur-etat-attente-fond);
    font-weight: 600;
  }

  .priorite {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 12px;
  }

  .pour {
    min-height: 44px;
    padding: 0 18px;
    border: 2px solid var(--cote-gauche);
    border-radius: 999px;
    background: var(--surface);
    color: var(--cote-gauche);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }

  .pour.droite {
    border-color: var(--cote-droit);
    color: var(--cote-droit);
  }

  .titre-etape {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem 1rem;
  }

  .avancement {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    min-width: 12rem;
  }

  .avancement .barre {
    flex: 0 1 14rem;
  }

  .avancement span:last-child {
    white-space: nowrap;
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

  .discret {
    margin: 0;
    color: var(--texte-discret);
    font-size: 0.875rem;
  }

  .onglets {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
    gap: 0.75rem;
  }

  .onglet {
    display: grid;
    gap: 0.4rem;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--bordure);
    border-radius: 14px;
    background: var(--surface);
    color: var(--texte);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .onglet[aria-selected='true'] {
    border: 2px solid var(--marque);
    background: var(--accent-teinte);
  }

  .haut {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .barre {
    height: 0.35rem;
    border-radius: 999px;
    background: var(--bordure);
    overflow: hidden;
  }

  .barre span {
    display: block;
    height: 100%;
    background: var(--marque);
  }

  /* US-107 CA-4 : feuille puis ordre des matchs à gauche ; saisie puis saisies reçues à droite, sur toute la hauteur. */
  .corps {
    display: grid;
    grid-template-columns: minmax(0, 1.9fr) minmax(0, 1fr);
    grid-template-areas:
      'feuille cote'
      'ordre cote';
    grid-template-rows: auto 1fr;
    gap: 1rem;
    align-items: start;
  }

  .feuille {
    grid-area: feuille;
  }

  .ordre {
    grid-area: ordre;
  }

  .cote {
    grid-area: cote;
    display: grid;
    gap: 1rem;
    container-type: inline-size;
  }

  .carte {
    border: 1px solid var(--bordure);
    border-radius: 14px;
    background: var(--surface);
    overflow: hidden;
  }

  .carte > header {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.25rem 0.75rem;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--bordure);
  }

  .defile {
    overflow-x: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
    text-align: center;
  }

  th,
  td {
    padding: 0.3rem 0.15rem;
    border-bottom: 1px solid var(--bordure);
  }

  thead th {
    font-weight: 600;
  }

  abbr {
    text-decoration: none;
  }

  .gauche {
    padding-left: 0.75rem;
    text-align: left;
  }

  th.gauche {
    font-weight: 400;
  }

  .nom {
    white-space: nowrap;
  }

  .diagonale {
    background: var(--marque);
    border-radius: 8px;
  }

  .case {
    width: 2.2rem;
    height: 2.2rem;
    border: 1px solid var(--bordure-champ);
    border-radius: 8px;
    background: var(--surface);
    color: var(--texte);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }

  .case.forfait {
    border-style: dashed;
    color: var(--texte-discret);
    font-style: italic;
  }

  .tireur {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .identite-tireur {
    display: grid;
    flex: 1;
  }

  .motif {
    padding: 0.1rem 0.5rem;
    border-radius: 999px;
    background: var(--etat-attente-fond);
    color: var(--sur-etat-attente-fond);
    font-size: 0.75rem;
    font-weight: 600;
  }

  .case:disabled {
    cursor: default;
  }

  .case.courante {
    border: 2px solid var(--marque);
    background: var(--accent-teinte);
  }

  tr.retire th,
  tr.retire td {
    color: var(--texte-discret);
  }

  .legende {
    margin: 0;
    padding: 0.75rem 1rem;
    color: var(--texte-discret);
    font-size: 0.875rem;
  }

  .saisie {
    border: 2px solid var(--marque);
  }

  .saisie .pave,
  .saisie > p,
  .saisie > h3 {
    margin: 0;
    padding: 0.75rem 1rem;
  }

  .message {
    margin: 0;
    color: var(--etat-erreur);
    font-size: 0.875rem;
  }

  .ordre ol {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    grid-auto-flow: column;
    margin: 0;
    padding: 0.25rem 0;
    list-style: none;
    font-size: 0.875rem;
  }

  .ordre li {
    display: grid;
    grid-template-columns: 1.75rem minmax(0, 1fr) auto;
    gap: 0.4rem;
    align-items: center;
    padding: 0.35rem 1rem;
  }

  .ordre li.courant {
    background: var(--accent-teinte);
    font-weight: 600;
  }

  .numero {
    color: var(--texte-discret);
  }

  .resultat {
    color: var(--texte-discret);
  }

  .courant .resultat {
    color: var(--accent);
  }

  .invisible {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }

  /* Principe 13 : sur un écran étroit, la carte de saisie passe au-dessus de la feuille, qui défile dans son cadre. */
  @media (max-width: 60rem) {
    .corps {
      grid-template-columns: minmax(0, 1fr);
      grid-template-areas:
        'saisie'
        'feuille'
        'ordre'
        'suite';
      grid-template-rows: auto;
    }

    .ordre ol {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    /* Sur écran étroit : la saisie, la feuille, l'ordre des matchs, puis les saisies reçues. */
    .cote {
      display: contents;
    }

    .saisie {
      grid-area: saisie;
    }

    .cote-suite {
      grid-area: suite;
    }
  }
</style>
