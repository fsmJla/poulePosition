<script lang="ts">
  // Matchs de la piste d'un arbitre (US-098, planche 13) : titre et avancement, match à saisir maintenant, deux suivants,
  // matchs terminés (les quatre derniers, puis tous à la demande). Tout vient de la vue de saisie de la table : aucun
  // calcul de classement ici, et la liste se met à jour dès qu'une nouvelle vue arrive.
  import { matchsDeLaPiste, type MatchDeLaPiste, type TireurVue, type VueSaisie } from '@poule-position/domaine';
  import { textes } from '../lib/textes';
  import Icone from './Icone.svelte';

  interface Proprietes {
    vue: VueSaisie | null;
    piste: number;
    nom: string;
    changerDePiste: () => void;
    /** US-099 : ouvrir la saisie d'un match ; absent tant que la saisie n'est pas possible. */
    saisir?: (match: MatchDeLaPiste) => void;
    /** US-101 : corriger un match terminé ; absent si la correction n'est pas permise. */
    corriger?: (match: MatchDeLaPiste) => void;
    /** US-102 : saisie suspendue (table déconnectée) : le crayon est grisé. */
    suspendue?: boolean;
    /** US-102 CA-1 et CA-4 : pourquoi (table partie, ou téléphone sans réseau), et l'heure du dernier échange. */
    raison?: 'table' | 'telephone';
    dernierEchange?: number | null;
  }

  let {
    vue,
    piste,
    nom,
    changerDePiste,
    saisir,
    corriger,
    suspendue = false,
    raison = 'table',
    dernierEchange = null,
  }: Proprietes = $props();
  const heure = (date: number) => {
    const d = new Date(date);
    return `${d.getHours()} h ${String(d.getMinutes()).padStart(2, '0')}`;
  };
  const peutCorriger = $derived(Boolean(corriger) && vue?.droits.correctionScore === 'arbitre');

  const t = textes.saisie.arbitre;

  let tousLesTermines = $state(false);

  const matchs = $derived(matchsDeLaPiste(vue, piste));
  const tireurs = $derived(
    new Map<string, TireurVue>((vue?.poules ?? []).flatMap((p) => p.tireurs.map((x) => [x.id, x]))),
  );
  const peutSaisir = $derived(vue?.droits.arbitreSaisitScores ?? true);
  const termines = $derived(tousLesTermines ? matchs.termines : matchs.termines.slice(0, 4));
  const titre = $derived(t.titrePiste(piste, matchs.poule === null ? [] : [matchs.poule]));

  const nomDe = (id: string) => tireurs.get(id)?.nom ?? '';
  const prenomDe = (id: string) => tireurs.get(id)?.prenom ?? '';
  const paire = (match: MatchDeLaPiste) => `${nomDe(match.tireurA)} – ${nomDe(match.tireurB)}`;
  const score = (match: MatchDeLaPiste) => (match.touches ? `${match.touches[0]}–${match.touches[1]}` : '');
  const autrePoule = (match: MatchDeLaPiste) => matchs.poule !== null && match.poule !== matchs.poule;
</script>

<main class="piste">
  <div class="tete">
    <div class="titre">
      <h1>{titre}</h1>
      <span class="discret">{t.avancement(nom, matchs.regles, matchs.total)}</span>
    </div>
    <button type="button" class="lien" onclick={changerDePiste}>{t.changerDePiste}</button>
  </div>

  {#if suspendue}
    <!-- US-102 (planche 16) : la saisie est suspendue, la feuille papier prend le relais. -->
    <div class="suspendue" role="alert">
      <Icone nom="pause" />
      <div>
        <strong>{t.suspendue}</strong>
        <span>{raison === 'telephone' ? t.telephoneSansReseau : t.tablePartie}</span>
        <span class="discret">{dernierEchange ? t.dernierEchange(heure(dernierEchange)) : t.reprise}</span>
      </div>
    </div>
  {/if}

  <section class="carte" class:active={matchs.maintenant !== null && !suspendue} aria-labelledby="titre-maintenant">
    {#if matchs.maintenant}
      {@const match = matchs.maintenant}
      <h2 id="titre-maintenant" class="accent">{t.maintenant(match.numero)}</h2>
      <div class="adversaires">
        <div><strong>{nomDe(match.tireurA)}</strong><span class="discret">{prenomDe(match.tireurA)}</span></div>
        <span class="discret">{t.contre}</span>
        <div class="droite">
          <strong>{nomDe(match.tireurB)}</strong><span class="discret">{prenomDe(match.tireurB)}</span>
        </div>
      </div>
      {#if !peutSaisir}
        <p class="discret">{t.saisieDesactivee}</p>
      {:else if suspendue}
        <button type="button" class="suspendu" disabled>{t.suspendue}</button>
      {:else}
        <button type="button" class="principal" disabled={!saisir} onclick={() => saisir?.(match)}
          >{t.saisirScore}</button
        >
      {/if}
    {:else}
      <h2 id="titre-maintenant">{t.tousSaisis}</h2>
    {/if}
  </section>

  {#if matchs.ensuite.length > 0}
    <section aria-labelledby="titre-ensuite">
      <h2 id="titre-ensuite" class="intertitre">{t.ensuite}</h2>
      <ul>
        {#each matchs.ensuite as match (`${match.poule}-${match.numero}`)}
          <li>
            <span class="numero">{match.numero}</span>
            <span class="paire">{paire(match)}</span>
            {#if autrePoule(match)}<span class="discret">{t.deLaPoule(match.poule)}</span>{/if}
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  <section aria-labelledby="titre-termines">
    <h2 id="titre-termines" class="intertitre">{t.termines}</h2>
    {#if matchs.termines.length === 0}
      <p class="discret">{t.aucunTermine}</p>
    {:else}
      <ul>
        {#each termines as match (`${match.poule}-${match.numero}`)}
          <li>
            <span class="numero">{match.numero}</span>
            <span class="paire">{paire(match)}</span>
            {#if match.forfait}
              <span class="discret">{t.forfait}</span>
            {:else}
              <span class="score">{score(match)}</span>
              {#if peutCorriger}
                <button
                  type="button"
                  class="crayon"
                  aria-label={t.corriger(match.numero)}
                  title={t.corriger(match.numero)}
                  disabled={suspendue}
                  onclick={() => corriger?.(match)}><Icone nom="crayon" /></button
                >
              {/if}
            {/if}
          </li>
        {/each}
      </ul>
      {#if !tousLesTermines && matchs.termines.length > 4}
        <button type="button" class="lien" onclick={() => (tousLesTermines = true)}
          >{t.voirTous(matchs.termines.length)}</button
        >
      {/if}
    {/if}
  </section>
</main>

<style>
  .piste {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 16px;
  }

  .tete {
    display: flex;
    align-items: flex-end;
    gap: 12px;
  }

  .titre {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  h1 {
    margin: 0;
    font-size: 1.5rem;
    line-height: 1.2;
  }

  h2 {
    margin: 0;
    font-family: var(--police-texte);
    font-size: 0.875rem;
    font-weight: 600;
  }

  .accent {
    color: var(--accent);
  }

  .intertitre {
    margin-bottom: 6px;
    color: var(--texte-discret);
  }

  p {
    margin: 0;
  }

  .discret {
    color: var(--texte-discret);
    font-size: 0.875rem;
  }

  .carte {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 14px;
    border: 1px solid var(--bordure);
    border-radius: 14px;
    background: var(--surface);
  }

  .carte.active {
    border: 2px solid var(--accent);
  }

  .adversaires {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 8px;
  }

  .adversaires div {
    display: flex;
    flex-direction: column;
  }

  .adversaires strong {
    font-weight: 600;
  }

  .droite {
    text-align: right;
  }

  ul {
    margin: 0;
    padding: 0;
    list-style: none;
    border: 1px solid var(--bordure);
    border-radius: 12px;
    background: var(--surface);
  }

  li {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 48px;
    padding: 0 14px;
    font-size: 0.9375rem;
  }

  li + li {
    border-top: 1px solid var(--bordure);
  }

  .numero {
    width: 24px;
    color: var(--texte-discret);
    font-size: 0.875rem;
  }

  .paire {
    flex: 1;
  }

  .score {
    font-weight: 600;
  }

  .suspendue {
    display: flex;
    gap: 10px;
    padding: 12px;
    border: 1px solid var(--etat-attente-bordure);
    border-radius: 12px;
    background: var(--etat-attente-fond);
    color: var(--texte);
  }

  .suspendue > :global(svg) {
    flex: none;
    margin-top: 1px;
    color: var(--sur-etat-attente-fond);
  }

  .suspendue div {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 0.9375rem;
  }

  .suspendu {
    height: 52px;
    border: none;
    border-radius: var(--rayon);
    background: var(--surface-2);
    color: var(--texte-discret);
    font: inherit;
    font-weight: 600;
  }

  .crayon {
    width: 44px;
    height: 44px;
    margin-right: -10px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: var(--rayon);
    background: transparent;
    color: var(--texte);
    cursor: pointer;
  }

  .crayon:disabled {
    color: var(--texte-inactif);
    cursor: not-allowed;
  }

  .principal {
    height: 52px;
    border: none;
    border-radius: var(--rayon);
    background: var(--palette-tiffany);
    color: var(--sur-tiffany);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }

  .principal:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .lien {
    align-self: flex-start;
    min-height: 44px;
    padding: 0;
    border: none;
    background: none;
    color: var(--accent);
    font: inherit;
    font-size: 0.9375rem;
    font-weight: 600;
    text-decoration: underline;
    cursor: pointer;
  }

  .tete .lien {
    align-self: auto;
  }
</style>
