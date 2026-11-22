<script lang="ts" module>
  /** Un tireur tel que l'afficheur le montre. */
  export interface TireurPave {
    nom: string;
    prenom: string;
    /** Ligne discrète sous le nom (club, côté de piste, tête de série). */
    detail?: string;
    /** Rang affiché entre parenthèses (tableau). */
    rang?: number | null;
  }
</script>

<script lang="ts">
  // Afficheur et pavé de score à la demande (US-117, US-118 ; canevas « Saisie du tableau — propositions ») : une
  // grande case de score par tireur, aux couleurs de son côté de piste, et un seul pavé (0 à N−1 et « V ») ouvert sur une
  // case à la fois. La logique (passage d'un tireur à l'autre, score complet) est celle du domaine (`choisirSurPave`).
  // Trois formats : « large » (carte du tableau sur le PC), « carte » (carte de poule sur le PC), « telephone ».
  // US-150 à US-152 (planches 42 et 42 bis) : au-delà de 15 touches (rencontre en relais), les dizaines puis les unités ;
  // l'unité enregistre le choix, le relais complet valant « V ».
  import type { ChoixScore, CotePave, EtatPave } from '@poule-position/domaine';
  import type { Snippet } from 'svelte';
  import { textes } from '../lib/textes';

  interface Proprietes {
    tireurs: readonly [TireurPave, TireurPave];
    /** Touches du match : boutons 0 à N−1 puis « V ». */
    touches: number;
    etat: EtatPave;
    choisir: (valeur: ChoixScore) => void;
    ouvrir: (cote: CotePave) => void;
    format: 'large' | 'carte' | 'telephone';
    desactive?: boolean;
    /** « V » s'affiche en chiffre dans la case (le vainqueur du tableau a N touches). */
    vEnChiffre?: boolean;
    /** Ce qui remplace le pavé fermé (priorité à désigner…) ; par défaut, l'invitation à corriger. */
    ferme?: Snippet;
  }

  let {
    tireurs,
    touches,
    etat,
    choisir,
    ouvrir,
    format,
    desactive = false,
    vEnChiffre = false,
    ferme,
  }: Proprietes = $props();

  const t = textes.pave;
  const COTES = ['gauche', 'droite'] as const;
  const boutons = $derived<ChoixScore[]>([...Array.from({ length: touches }, (_, i) => i), 'V']);
  const complet = (i: CotePave) => `${tireurs[i].nom} ${tireurs[i].prenom}`;
  const affiche = (v: ChoixScore | null) => (v === null ? '–' : v === 'V' && vEnChiffre ? String(touches) : String(v));
  const actif = $derived(desactive ? null : etat.actif);

  /** US-150 : rencontre en relais (20 ou 45 touches, ou moins en poule) : dizaines puis unités. */
  const relais = $derived(touches > 15);
  const dizaines = $derived(Array.from({ length: Math.floor(touches / 10) + 1 }, (_, i) => i * 10));
  let dizaine = $state<number | null>(null);
  let coteDeLaDizaine: CotePave | null = null;
  $effect(() => {
    if (actif !== coteDeLaDizaine) {
      coteDeLaDizaine = actif;
      dizaine = null;
    }
  });
  function choisirUnite(unite: number) {
    if (dizaine === null) return;
    const valeur = dizaine + unite;
    dizaine = null;
    choisir(valeur === touches ? 'V' : valeur);
  }
</script>

<div class="pave-score {format}">
  <div class="afficheur">
    {#each COTES as cote, i (cote)}
      {@const c = i as CotePave}
      <div class="tireur {cote}">
        <p class="nom">
          {#if tireurs[c].rang}<span class="rang">({tireurs[c].rang})</span>{/if}
          <strong>{tireurs[c].nom}</strong>
          {tireurs[c].prenom}
        </p>
        {#if tireurs[c].detail}<p class="detail">{tireurs[c].detail}</p>{/if}
      </div>
      <button
        type="button"
        class="case {cote}"
        class:active={actif === c}
        class:vide={etat.valeurs[c] === null}
        aria-label={t.case(complet(c), etat.valeurs[c] === null ? null : String(etat.valeurs[c]), actif === c)}
        aria-pressed={actif === c}
        disabled={desactive}
        onclick={() => ouvrir(c)}>{affiche(etat.valeurs[c])}</button
      >
    {/each}
    <span class="tiret" aria-hidden="true">–</span>
  </div>

  <div class="zone">
    {#if actif !== null}
      {@const cote = COTES[actif]}
      <p class="invite">{t.scoreDe('')}<strong class={cote}>{tireurs[actif].nom}</strong></p>
      {#if relais}
        <div class="relais">
          <span class="libelle">{t.dizaines}</span>
          <div class="boutons {cote}" role="group" aria-label={t.dizainesDe(complet(actif))} style:--colonnes={5}>
            {#each dizaines as valeur (valeur)}
              <button
                type="button"
                class="bouton"
                aria-pressed={dizaine === valeur}
                aria-label={t.bouton(String(valeur), complet(actif))}
                onclick={() => (dizaine = valeur)}>{valeur}</button
              >
            {/each}
          </div>
          <span class="libelle">{t.unites}</span>
          <div class="boutons {cote}" role="group" aria-label={t.unitesDe(complet(actif))} style:--colonnes={5}>
            {#each [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as unite (unite)}
              <button
                type="button"
                class="bouton"
                aria-label={t.bouton(String(unite), complet(actif))}
                disabled={dizaine === null || dizaine + unite > touches}
                onclick={() => choisirUnite(unite)}>{unite}</button
              >
            {/each}
          </div>
        </div>
      {:else}
        <div
          class="boutons {cote}"
          role="group"
          aria-label={t.scoreDe(complet(actif))}
          style:--colonnes={boutons.length <= 6 ? 3 : 4}
        >
          {#each boutons as valeur (valeur)}
            <button
              type="button"
              class="bouton"
              class:v={valeur === 'V'}
              aria-pressed={etat.valeurs[actif] === valeur}
              aria-label={t.bouton(String(valeur), complet(actif))}
              onclick={() => choisir(valeur)}>{valeur}</button
            >
          {/each}
        </div>
      {/if}
    {:else if ferme}
      {@render ferme()}
    {:else if !desactive}
      <p class="invite">{t.corriger}</p>
    {/if}
  </div>
</div>

<style>
  .pave-score {
    /* Des touchers rapprochés (deux boutons, puis l'envoi) ne sont pas un double-toucher de zoom. */
    touch-action: manipulation;
    display: grid;
    gap: 12px;
  }

  .gauche {
    --cote: var(--cote-gauche);
    --teinte: var(--cote-gauche-teinte);
  }

  .droite {
    --cote: var(--cote-droit);
    --teinte: var(--cote-droit-teinte);
  }

  /* L'afficheur : nom au-dessus de sa case (carte, téléphone), ou de part et d'autre (large). */
  .afficheur {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    grid-template-areas:
      'nom-g nom-d'
      'case-g case-d';
    gap: 6px 12px;
    align-items: end;
  }

  .tireur.gauche {
    grid-area: nom-g;
  }

  .tireur.droite {
    grid-area: nom-d;
  }

  .case.gauche {
    grid-area: case-g;
  }

  .case.droite {
    grid-area: case-d;
  }

  .tiret {
    display: none;
  }

  .tireur {
    text-align: center;
    line-height: 1.25;
  }

  .nom,
  .detail {
    margin: 0;
  }

  .nom strong {
    color: var(--cote);
    letter-spacing: 0.02em;
  }

  .rang,
  .detail {
    color: var(--texte-discret);
    font-size: 0.875rem;
  }

  .case {
    justify-self: center;
    width: 100%;
    max-width: 120px;
    height: 88px;
    border: 1px solid var(--bordure-champ);
    border-radius: 14px;
    background: var(--surface);
    color: var(--cote);
    font-family: var(--police-titre);
    font-size: 3.25rem;
    font-weight: 700;
    line-height: 1;
    font-variant-numeric: tabular-nums;
    cursor: pointer;
  }

  .case.vide {
    color: var(--texte-inactif);
  }

  .case.active {
    border: 3px solid var(--cote);
    background: var(--teinte);
  }

  .case:disabled {
    cursor: default;
  }

  .zone {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 96px;
  }

  .invite {
    margin: 0;
    color: var(--texte-discret);
    font-size: 0.9375rem;
    text-align: center;
  }

  .invite strong {
    color: var(--cote);
  }

  .boutons {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 6px;
  }

  .bouton {
    width: 44px;
    height: 44px;
    border: 1px solid var(--bordure-champ);
    border-radius: 12px;
    background: var(--surface);
    color: var(--texte);
    font: inherit;
    font-size: 1.05rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    cursor: pointer;
  }

  .relais {
    display: grid;
    gap: 8px;
  }

  .relais .libelle {
    font-weight: 600;
  }

  .bouton:disabled {
    cursor: not-allowed;
    opacity: 0.4;
  }

  .bouton.v {
    width: 56px;
    margin-left: 6px;
  }

  .bouton[aria-pressed='true'] {
    border-color: var(--cote);
    background: var(--cote);
    color: var(--sur-cote);
  }

  /* Large (carte du tableau sur le PC) : NOM (rang)  [15] – [11]  NOM (rang), le pavé sur une ligne. */
  .large .afficheur {
    grid-template-columns: minmax(0, 1fr) auto auto auto minmax(0, 1fr);
    grid-template-areas: 'nom-g case-g tiret case-d nom-d';
    gap: 16px;
    align-items: center;
  }

  .large .tiret {
    display: block;
    grid-area: tiret;
    color: var(--texte-inactif);
    font-size: 2.5rem;
  }

  .large .tireur.gauche {
    text-align: right;
  }

  .large .tireur.droite {
    text-align: left;
  }

  .large .nom {
    font-size: 1.3rem;
  }

  .large .case {
    width: 120px;
    height: 104px;
    font-size: 4rem;
  }

  .large .bouton {
    width: 48px;
    height: 48px;
  }

  .large .bouton.v {
    width: 64px;
    margin-left: 10px;
  }

  /* Téléphone : grandes cases, un pavé en grille sur toute la largeur (3 colonnes en poule, 4 au tableau). */
  .telephone .case {
    max-width: none;
    height: 96px;
    font-size: 3.75rem;
  }

  .telephone .nom {
    font-size: 1.0625rem;
  }

  .telephone .zone {
    align-items: stretch;
  }

  .telephone .boutons {
    display: grid;
    grid-template-columns: repeat(var(--colonnes, 4), minmax(0, 1fr));
    gap: 8px;
  }

  .telephone .bouton,
  .telephone .bouton.v {
    width: auto;
    height: 56px;
    margin: 0;
    border: 2px solid var(--cote);
    border-radius: 14px;
    font-size: 1.375rem;
  }
</style>
