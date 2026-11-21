<script lang="ts">
  // Suivi en direct d'une épreuve publiée par un spectateur (US-137, planche 38) et « Mes tireurs » (US-138, planche 39).
  // La vue en direct arrive par la WebSocket publique de l'épreuve (US-132) ; une épreuve dépubliée ferme la connexion
  // (`4006`). Onglets : Appel, Poules, Classement, Tableau (grisés tant que leur étape n'est pas venue) et Mes tireurs.
  import { onMount } from 'svelte';
  import { FERMETURES } from '@poule-position/protocole';
  import type { VueDirect } from '@poule-position/domaine';
  import { demarrerConnexion } from '../lib/connexion';
  import { pistesDeLAppel } from '../lib/ecran-geant';
  import { basculerSuivi, chercherDansLaVue, lireSuivis, situationTireur } from '../lib/suivi-tireurs';
  import { textes } from '../lib/textes';
  import Icone from './Icone.svelte';

  interface Proprietes {
    epreuveId: string;
    urlServeur: string | undefined;
    /** CA-5 : la connexion a été fermée parce que l'épreuve n'est plus publiée. */
    surNonPubliee: () => void;
  }

  let { epreuveId, urlServeur, surNonPubliee }: Proprietes = $props();
  const t = textes.spectateur;
  const tg = textes.ecranGeant;

  type Onglet = 'appel' | 'poules' | 'classement' | 'tableau' | 'tireurs';
  let vue = $state<VueDirect | null>(null);
  let publieeLe = $state<number | null>(null);
  let piloteConnecte = $state(true);
  let connecte = $state(false);
  let onglet = $state<Onglet | null>(null);
  let recherche = $state('');
  let suivis = $state<string[]>([]);

  const stockage = (() => {
    try {
      return window.localStorage;
    } catch {
      return null;
    }
  })();

  const disponibles = $derived({
    appel: vue !== null && (vue.etape === 'poules' || vue.etape === 'tableau'),
    poules: vue !== null && vue.poules.length > 0,
    classement: vue?.classement !== null && vue?.classement !== undefined,
    tableau: vue?.tableau !== null && vue?.tableau !== undefined,
    tireurs: vue !== null,
  });
  /** CA-1 : l'onglet de l'étape en cours. */
  const ongletEtape = $derived<Onglet>(
    vue?.etape === 'tableau'
      ? 'tableau'
      : vue?.etape === 'classement' || vue?.etape === 'terminee'
        ? 'classement'
        : 'poules',
  );
  const actif = $derived<Onglet>(onglet && disponibles[onglet] ? onglet : ongletEtape);
  const nom = $derived(new Map((vue?.tireurs ?? []).map(({ id, nom: n }) => [id, n])));
  const club = $derived(new Map((vue?.tireurs ?? []).map(({ id, club: c }) => [id, c])));
  /** CA-4 : après l'épreuve, le classement final ; avant, le classement après les poules. */
  const lignesClassement = $derived(
    vue?.etape === 'terminee' && vue.classementFinal
      ? vue.classementFinal.map((finale) => {
          const poules = vue?.classement?.lignes.find((l) => l.tireurId === finale.tireurId);
          return {
            tireurId: finale.tireurId,
            rang: finale.place,
            victoires: poules?.victoires ?? 0,
            matchs: poules?.matchs ?? 0,
            indice: poules?.indice ?? 0,
          };
        })
      : (vue?.classement?.lignes ?? []),
  );
  const trouves = $derived(vue ? chercherDansLaVue(vue, recherche) : []);
  const situations = $derived(vue ? suivis.map((id) => situationTireur(vue!, id)).filter((s) => s !== null) : []);
  const tourCourant = $derived.by(() => {
    const matchs = vue?.tableau?.matchs ?? [];
    const tours = [...new Set(matchs.filter((m) => m.tour > 0).map((m) => m.tour))].sort((a, b) => b - a);
    return tours.find((tour) => matchs.some((m) => m.tour === tour && m.etat !== 'regle' && m.etat !== 'exempt')) ?? 2;
  });

  const heure = (instant: number) => {
    const date = new Date(instant);
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  };

  onMount(() => {
    suivis = lireSuivis(stockage, epreuveId);
    const base = urlServeur?.trim().replace(/\/+$/, '');
    const { arreter } = demarrerConnexion({
      adresse: base && /^wss?:\/\//.test(base) ? async () => ({ url: `${base}/epreuves/${epreuveId}/direct` }) : null,
      surEtat: (etat) => (connecte = etat === 'connecte'),
      surMessage: (message) => {
        if (message.type === 'vueDirect') {
          vue = message.vue;
          publieeLe = message.publieeLe ?? Date.now();
        } else if (message.type === 'table') {
          piloteConnecte = message.connectee;
        }
      },
      surFin: (code) => {
        if (code === FERMETURES.NON_PUBLIEE) surNonPubliee();
      },
    });
    return arreter;
  });

  function suivre(tireurId: string) {
    suivis = basculerSuivi(stockage, epreuveId, tireurId);
  }

  const onglets: Onglet[] = ['appel', 'poules', 'classement', 'tableau', 'tireurs'];
</script>

{#snippet etoile(tireurId: string)}
  {@const suivi = suivis.includes(tireurId)}
  <button
    type="button"
    class="etoile"
    class:suivi
    aria-pressed={suivi}
    aria-label={suivi ? t.nePlusSuivre(nom.get(tireurId) ?? '') : t.suivre(nom.get(tireurId) ?? '')}
    onclick={() => suivre(tireurId)}
  >
    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" stroke-width="1.5" stroke-linejoin="round"
      ><path d="m12 3 2.700 5.600 6.100.9-4.400 4.300 1 6.100L12 17l-5.400 2.900 1-6.100L3.200 9.500l6.100-.9z" /></svg
    >
  </button>
{/snippet}

<section class="suivi" aria-label={t.titre}>
  {#if !vue}
    <p class="discret" role="status">{connecte ? t.attente : t.connexion}</p>
  {:else if vue.etape === 'inscriptions'}
    <p class="discret">{t.avantPoules}</p>
  {:else}
    <div class="en-direct">
      {#if piloteConnecte && connecte}<span class="pastille">{t.enDirect}</span>{/if}
    </div>
    <div role="tablist" aria-label={t.onglets} class="onglets">
      {#each onglets as id (id)}
        <button
          type="button"
          role="tab"
          aria-selected={actif === id}
          aria-disabled={!disponibles[id]}
          title={disponibles[id] ? undefined : t.aVenir}
          class:actif={actif === id}
          onclick={() => disponibles[id] && (onglet = id)}
        >
          {#if id === 'tireurs'}<Icone nom="personnes" taille={16} />{/if}
          {t.libelles[id]}{#if id === 'tireurs' && suivis.length > 0}&nbsp;· {suivis.length}{/if}
        </button>
      {/each}
    </div>

    <div role="tabpanel" class="panneau">
      {#if actif === 'appel'}
        {#each pistesDeLAppel(vue) as carte (carte.piste)}
          <article class="carte" aria-label={tg.piste(carte.piste)}>
            <div class="ligne">
              <strong>{tg.piste(carte.piste)}</strong><span class="etat {carte.etat}">{tg.etats[carte.etat]}</span>
            </div>
            {#if carte.tireurs}<span>{carte.tireurs[0]} – {carte.tireurs[1]}</span>{/if}
            {#if carte.puis}<span class="discret">{tg.puis(carte.puis[0], carte.puis[1])}</span>{/if}
          </article>
        {/each}
      {:else if actif === 'poules'}
        {#each vue.poules as poule (poule.numero)}
          <article class="carte" aria-label={tg.poule(poule.numero)}>
            <div class="ligne">
              <strong>{tg.poule(poule.numero)}</strong><span class="discret"
                >{t.pisteAvancement(poule.piste, poule.regles, poule.total)}</span
              >
            </div>
            <table>
              <thead
                ><tr
                  ><th class="nom">{t.tireur}</th><th>V</th><th>{tg.indice}</th><th
                    ><span class="masque">{t.suivreColonne}</span></th
                  ></tr
                ></thead
              >
              <tbody>
                {#each [...poule.classement].sort((a, b) => a.rang - b.rang) as ligne (ligne.tireurId)}
                  <tr class:suivi={suivis.includes(ligne.tireurId)}>
                    <td class="nom">{nom.get(ligne.tireurId)} <span class="club">{club.get(ligne.tireurId)}</span></td>
                    <td>{ligne.victoires}</td>
                    <td>{ligne.indice > 0 ? '+' : ''}{ligne.indice}</td>
                    <td>{@render etoile(ligne.tireurId)}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </article>
        {/each}
      {:else if actif === 'classement'}
        <table class="classement">
          <thead
            ><tr
              ><th>{tg.rang}</th><th class="nom">{t.tireur}</th><th>V/M</th><th>{tg.indice}</th><th
                ><span class="masque">{t.suivreColonne}</span></th
              ></tr
            ></thead
          >
          <tbody>
            {#each lignesClassement as ligne (ligne.tireurId)}
              <tr class:suivi={suivis.includes(ligne.tireurId)}>
                <td>{ligne.rang ?? '—'}</td>
                <td class="nom">{nom.get(ligne.tireurId)} <span class="club">{club.get(ligne.tireurId)}</span></td>
                <td>{ligne.matchs ? (ligne.victoires / ligne.matchs).toFixed(2).replace('.', ',') : '—'}</td>
                <td>{ligne.indice > 0 ? '+' : ''}{ligne.indice}</td>
                <td>{@render etoile(ligne.tireurId)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      {:else if actif === 'tableau' && vue.tableau}
        <h3>{tg.tour(tourCourant)}</h3>
        <div class="tableau">
          {#each vue.tableau.matchs.filter((m) => m.tour === tourCourant && m.etat !== 'exempt') as match (match.id)}
            <article class="match">
              {#each [match.haut, match.bas] as place, i (i)}
                <div
                  class="cote"
                  class:gagnant={match.vainqueur !== null && match.vainqueur === place.tireurId}
                  class:suivi={place.tireurId !== null && suivis.includes(place.tireurId)}
                >
                  <span>{place.tireurId ? nom.get(place.tireurId) : '…'}</span>
                  <span>{match.touches ? match.touches[i] : ''}</span>
                </div>
              {/each}
              {#if match.piste !== null && match.etat === 'aTirer'}
                <span class="discret">{match.enPiste ? tg.enPisteN(match.piste) : tg.aTirerN(match.piste)}</span>
              {/if}
            </article>
          {/each}
        </div>
      {:else if actif === 'tireurs'}
        <label class="recherche">
          <Icone nom="loupe" taille={18} />
          <input type="search" aria-label={t.chercher} placeholder={t.chercher} bind:value={recherche} />
        </label>
        {#each trouves as tireur (tireur.id)}
          <div class="trouve">
            <span>{tireur.nom} <span class="club">{tireur.club}</span></span>
            {@render etoile(tireur.id)}
          </div>
        {/each}
        {#each situations as s (s.tireurId)}
          <article class="carte tireur" aria-label={s.nom}>
            <div class="ligne">
              <strong>{s.nom} <span class="club">{s.club}</span></strong>{@render etoile(s.tireurId)}
            </div>
            {#if s.prochain?.enPiste}
              <div class="annonce piste">
                <Icone nom="lecture" taille={18} />{t.enPisteContre(s.prochain.piste ?? 0, s.prochain.adversaire)}
              </div>
            {:else if s.prochain}
              <div class="annonce">
                {s.prochain.phase === 'poule'
                  ? t.prochainPoule(s.prochain.adversaire, s.prochain.avant)
                  : t.prochainTableau(s.prochain.adversaire, s.prochain.piste)}
              </div>
            {:else if s.retrait}
              <div class="annonce">{t.retraits[s.retrait]}</div>
            {:else if s.place !== null}
              <div class="annonce">{t.place(s.place)}</div>
            {/if}
            <dl>
              <div>
                <dt>{t.poule}</dt>
                <dd>{s.poule ? t.pouleEtPiste(s.poule.numero, s.poule.piste) : '—'}</dd>
              </div>
              <div>
                <dt>{t.victoires}</dt>
                <dd>{t.surMatchs(s.victoires, s.matchs)}</dd>
              </div>
              <div>
                <dt>{t.rang}</dt>
                <dd>{s.rang ? t.rangSur(s.rang.rang, s.rang.sur) : '—'}</dd>
              </div>
            </dl>
          </article>
        {:else}
          {#if !recherche}<p class="discret">{t.aucunSuivi}</p>{/if}
        {/each}
        <p class="discret">{t.surCeTelephone}</p>
      {/if}
    </div>

    {#if publieeLe !== null}
      <p class="pied" role="status">
        {piloteConnecte && connecte ? tg.misAJour(heure(publieeLe)) : tg.derniereMiseAJour(heure(publieeLe))}
      </p>
    {/if}
  {/if}
</section>

<style>
  .suivi {
    display: grid;
    gap: 0.75rem;
    width: min(40rem, 100%);
    text-align: left;
  }

  .discret,
  .club,
  .pied {
    margin: 0;
    color: var(--texte-discret);
    font-size: 0.875rem;
  }

  .pied {
    text-align: center;
  }

  .en-direct {
    display: flex;
    justify-content: flex-end;
  }

  .pastille {
    padding: 0.1rem 0.6rem;
    border-radius: 999px;
    background: var(--accent);
    color: var(--sur-accent);
    font-size: 0.8rem;
    font-weight: 700;
  }

  .onglets {
    display: flex;
    gap: 0.4rem;
    overflow-x: auto;
    padding-bottom: 0.25rem;
  }

  .onglets button {
    display: inline-flex;
    flex: none;
    align-items: center;
    gap: 0.3rem;
    min-height: 40px;
    padding: 0 0.9rem;
    border: 1px solid var(--bordure);
    border-radius: 999px;
    background: var(--surface);
    color: var(--texte);
    font: inherit;
    font-size: 0.95rem;
    cursor: pointer;
  }

  .onglets button.actif {
    border-color: var(--accent-fonce, var(--lien, var(--accent)));
    background: var(--lien, var(--accent));
    color: var(--sur-accent);
    font-weight: 600;
  }

  .onglets button[aria-disabled='true'] {
    border-style: dashed;
    background: transparent;
    color: var(--texte-inactif);
    cursor: not-allowed;
  }

  .panneau {
    display: grid;
    gap: 0.75rem;
  }

  .carte {
    display: grid;
    gap: 0.4rem;
    padding: 0.75rem;
    border: 1px solid var(--bordure);
    border-radius: 14px;
    background: var(--surface);
  }

  .ligne {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .etat {
    padding: 0.05rem 0.55rem;
    border-radius: 999px;
    background: var(--surface-2);
    font-size: 0.8rem;
    font-weight: 700;
  }

  .etat.enPiste {
    background: var(--accent);
    color: var(--sur-accent);
  }

  .etat.aTirer {
    background: var(--etat-attente-fond);
    color: var(--sur-etat-attente-fond);
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.95rem;
    font-variant-numeric: tabular-nums;
  }

  th {
    color: var(--texte-discret);
    font-size: 0.8rem;
    font-weight: 600;
    text-align: center;
  }

  td {
    padding: 0.2rem 0;
    border-top: 1px solid var(--bordure);
    text-align: center;
  }

  .nom {
    text-align: left;
  }

  tr.suivi,
  .cote.suivi {
    background: var(--etat-attente-fond);
  }

  .masque {
    position: absolute;
    left: -9999px;
  }

  .etoile {
    width: 44px;
    height: 40px;
    border: none;
    background: transparent;
    cursor: pointer;
  }

  .etoile svg {
    fill: none;
    stroke: var(--texte-discret);
  }

  .etoile.suivi svg {
    fill: var(--etat-attente);
    stroke: var(--etat-attente);
  }

  h3 {
    margin: 0;
    font-size: 1.1rem;
  }

  .tableau {
    display: grid;
    gap: 0.5rem;
  }

  .match {
    overflow: hidden;
    border: 1px solid var(--bordure);
    border-radius: 12px;
    background: var(--surface);
  }

  .match .discret {
    display: block;
    padding: 0.2rem 0.75rem 0.4rem;
  }

  .cote {
    display: flex;
    justify-content: space-between;
    padding: 0.4rem 0.75rem;
    color: var(--texte-discret);
  }

  .cote + .cote {
    border-top: 1px solid var(--bordure);
  }

  .cote.gagnant {
    color: var(--texte);
    font-weight: 700;
  }

  .recherche {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-height: 44px;
    padding: 0 0.75rem;
    border: 1px solid var(--bordure-champ);
    border-radius: 10px;
    background: var(--surface);
    color: var(--texte-discret);
  }

  .recherche input {
    flex: 1;
    min-width: 0;
    border: none;
    outline: none;
    background: transparent;
    color: var(--texte);
    font: inherit;
  }

  .trouve {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .annonce {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.6rem 0.75rem;
    border-radius: 10px;
    background: var(--etat-attente-fond);
    color: var(--sur-etat-attente-fond);
  }

  .annonce.piste {
    background: var(--accent-teinte);
    color: var(--texte);
  }

  dl {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.25rem;
    margin: 0;
    font-size: 0.875rem;
  }

  dt {
    color: var(--texte-discret);
  }

  dd {
    margin: 0;
    font-size: 1rem;
    font-weight: 700;
  }
</style>
