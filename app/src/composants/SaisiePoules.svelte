<script lang="ts">
  // Saisie des scores des poules sur le PC (US-088, planche 10) : un onglet par poule, la feuille de poule (V5, touches,
  // V, V/M, TD, TR, indice, rang), la carte du match en cours (Entrée valide et passe au suivant), l'ordre des matchs.
  // Une case de la feuille ouvre son match pour le corriger. Le retrait d'un tireur (US-089) passe par sa ligne.
  import { tick, untrack } from 'svelte';
  import {
    avancementPoules,
    matchsDePoule,
    pouleTerminee,
    resultatsPoule,
    scoreValide,
    type EtatPoules,
    type MatchPoule,
    type Poule,
    type Tireur,
  } from '@poule-position/domaine';
  import Icone from './Icone.svelte';
  import MenuActions from './MenuActions.svelte';
  import { textes } from '../lib/textes';

  interface Proprietes {
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
    }) => Promise<boolean>;
  }

  let { etat, tireurs, touches, modifiable, saisir }: Proprietes = $props();

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
  const saisie = $state({ a: '', b: '', auTemps: false });
  let erreur: string | null = $state(null);
  let premierChamp: HTMLInputElement | undefined = $state();

  const nom = (id: string) => {
    const tireur = parId.get(id);
    return tireur ? `${tireur.nom.toUpperCase()} ${tireur.prenom}` : '';
  };
  const nomCourt = (id: string) => parId.get(id)?.nom.toUpperCase() ?? '';

  /** La saisie reprend le score du match ouvert (correction) ou repart à vide, quand ce match change. */
  const cleCourant = $derived(courant ? `${poule.numero}-${courant.numero}-${courant.touches?.join() ?? ''}` : '');
  $effect(() => {
    void cleCourant;
    const match = untrack(() => courant);
    saisie.a = match?.touches ? String(match.touches[0]) : '';
    saisie.b = match?.touches ? String(match.touches[1]) : '';
    saisie.auTemps = match?.auTemps ?? false;
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

  /** CA-4 : la raison du refus d'un score, ou null s'il est valable. */
  function raison(a: number, b: number, auTemps: boolean): string | null {
    if (![a, b].every((x) => Number.isInteger(x) && x >= 0 && x <= touches)) return t.horsBornesTouches(touches);
    if (a === b) return t.egalite;
    if (scoreValide(a, b, touches, auTemps)) return null;
    return auTemps ? t.auTempsMoins(touches) : t.vainqueurATouches(touches);
  }

  async function valider(evenement: SubmitEvent) {
    evenement.preventDefault();
    const match = courant;
    if (!match || !modifiable) return;
    const a = saisie.a.trim() === '' ? NaN : Number(saisie.a);
    const b = saisie.b.trim() === '' ? NaN : Number(saisie.b);
    const refus = raison(a, b, saisie.auTemps);
    if (refus) {
      erreur = refus;
      return;
    }
    const ok = await saisir({
      poule: poule.numero,
      tireurA: match.tireurA,
      tireurB: match.tireurB,
      touchesA: a,
      touchesB: b,
      auTemps: saisie.auTemps,
    });
    if (ok) {
      choisi = null;
      await tick();
      premierChamp?.focus();
    }
  }
</script>

<div class="titre-etape">
  <div class="identite">
    <div class="ligne">
      <h2>{t.titre}</h2>
      <span class="pastille">{t.enCours}</span>
    </div>
    <p class="discret">
      {avancement.regles === avancement.total
        ? t.toutesTerminees
        : `${t.avancement(avancement.regles, avancement.total)} · ${t.classementApres}`}
    </p>
  </div>
  <MenuActions
    id="menu-poules"
    nom={t.titre}
    actions={[{ libelle: t.imprimerFeuilles, icone: 'imprimante', indisponible: t.imprimerAVenir }]}
  />
</div>

<!-- CA-1 : un onglet par poule, avec sa piste et son avancement. -->
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
        <span class="discret">{t.pisteN(p.piste)}</span></span
      >
      <span class="barre" aria-hidden="true"
        ><span style:width="{(100 * regles) / Math.max(1, ms.length)}%"></span></span
      >
      <span class="discret">{t.ongletAvancement(regles, ms.length, finie)}</span>
    </button>
  {/each}
</div>

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
                <span class="nom"><strong>{tireur?.nom.toUpperCase()}</strong> {tireur?.prenom}</span>
                <span class="discret">{tireur?.club}</span>
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

  <div class="cote">
    {#if modifiable}
      <section class="carte saisie" aria-labelledby="titre-saisie">
        {#if courant}
          {@const [i, j] = courant.ordre}
          <header>
            <h3 id="titre-saisie">{t.match(courant.numero, matchs.length)}</h3>
            <span class="discret">{t.contre(i, j)}</span>
          </header>
          <form onsubmit={valider} novalidate>
            <label class="score"
              ><span>{nom(courant.tireurA)}</span><input
                bind:this={premierChamp}
                bind:value={saisie.a}
                inputmode="numeric"
                autocomplete="off"
                aria-label={t.touchesDe(nom(courant.tireurA))}
              /></label
            >
            <label class="score"
              ><span>{nom(courant.tireurB)}</span><input
                bind:value={saisie.b}
                inputmode="numeric"
                autocomplete="off"
                aria-label={t.touchesDe(nom(courant.tireurB))}
              /></label
            >
            <label class="option"><input type="checkbox" bind:checked={saisie.auTemps} />{t.auTemps}</label>
            {#if erreur}<p class="message" role="alert">{erreur}</p>{/if}
            <button type="submit" class="principal">{t.valider}</button>
          </form>
          <p class="discret">{t.aideSaisie(touches)}</p>
        {:else}
          <h3 id="titre-saisie">{t.feuille(poule.numero, poule.piste)}</h3>
          <p class="discret" role="status">{terminee ? t.pouleFinie : ''}</p>
        {/if}
      </section>
    {/if}

    <section class="carte ordre" aria-labelledby="titre-ordre">
      <header><h3 id="titre-ordre">{t.ordreDesMatchs}</h3></header>
      <ol style:grid-template-rows="repeat({Math.ceil(matchs.length / 2)}, auto)">
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
  </div>
</div>

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
    background: var(--etat-ok-fond);
    color: var(--sur-etat-ok-fond);
    font-size: 0.875rem;
    font-weight: 600;
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
    gap: 0.5rem;
    padding: 0.75rem;
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

  .haut .discret {
    margin-left: auto;
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

  .corps {
    display: grid;
    grid-template-columns: minmax(0, 1.65fr) minmax(0, 1fr);
    gap: 1rem;
    align-items: start;
  }

  .cote {
    display: grid;
    gap: 1rem;
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
    padding: 0.35rem 0.25rem;
    border-bottom: 1px solid var(--bordure);
  }

  thead th {
    font-weight: 600;
  }

  abbr {
    text-decoration: none;
  }

  .gauche {
    padding-left: 1rem;
    text-align: left;
  }

  th.gauche {
    display: grid;
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
    width: 2.4rem;
    height: 2.4rem;
    border: 1px solid var(--bordure-champ);
    border-radius: 8px;
    background: var(--surface);
    color: var(--texte);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
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

  .saisie form,
  .saisie > p,
  .saisie > h3 {
    margin: 0;
    padding: 0.75rem 1rem;
  }

  form {
    display: grid;
    gap: 0.75rem;
  }

  .score {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    font-weight: 600;
  }

  .score input {
    box-sizing: border-box;
    width: 4.5rem;
    height: 3.25rem;
    border: 2px solid var(--bordure-champ);
    border-radius: var(--rayon);
    background: var(--surface);
    color: var(--texte);
    font: inherit;
    font-size: 1.5rem;
    text-align: center;
  }

  .score input:focus {
    border-color: var(--marque);
  }

  .option {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
  }

  .option input {
    width: 1.2rem;
    height: 1.2rem;
    accent-color: var(--marque);
  }

  .principal {
    min-height: 2.75rem;
    border: none;
    border-radius: var(--rayon);
    background: var(--palette-tiffany);
    color: var(--sur-tiffany);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }

  .message {
    margin: 0;
    color: var(--etat-erreur);
    font-size: 0.875rem;
  }

  .ordre ol {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
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
    }

    .cote {
      order: -1;
    }
  }
</style>
