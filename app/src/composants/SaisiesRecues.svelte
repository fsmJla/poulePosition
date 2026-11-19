<script lang="ts">
  // Saisies reçues des smartphones (US-100, planche 10) : sous la feuille de poule, ce que la table a reçu des
  // téléphones (acceptée, refusée avec son motif) et ce qui a été saisi sur ce PC, le plus récent en tête. Tout se lit dans
  // le journal local : la liste reste visible hors ligne.
  import type { LigneSaisie } from '@poule-position/domaine';
  import { textes } from '../lib/textes';
  import Icone from './Icone.svelte';

  interface Proprietes {
    lignes: LigneSaisie[];
    /** Smartphones connectés ; null hors ligne (ou sur un PC qui n'est pas le pilote : `pilote` faux). */
    appareils: number | null;
    pilote: boolean;
    gererLesAcces: () => void;
  }

  let { lignes, appareils, pilote, gererLesAcces }: Proprietes = $props();

  const t = textes.saisie.recues;

  let toutes = $state(false);
  const visibles = $derived(toutes ? lignes : lignes.slice(0, 10));
  const heure = (date: number) => {
    const d = new Date(date);
    return `${d.getHours()} h ${String(d.getMinutes()).padStart(2, '0')}`;
  };
  const quoi = (l: LigneSaisie) => {
    const match = l.numero === null ? t.poule(l.poule) : t.match(l.poule, l.numero);
    return l.correctionDe
      ? `${match} : ${t.correction(`${l.correctionDe[0]}–${l.correctionDe[1]}`, `${l.touchesA}–${l.touchesB}`)}`
      : `${match} : ${l.nomA} ${l.touchesA} – ${l.touchesB} ${l.nomB}`;
  };
</script>

<section class="recues" aria-labelledby="titre-recues">
  <div class="tete">
    <h3 id="titre-recues"><Icone nom="smartphone" />{t.titre}</h3>
    {#if pilote}
      <span class="discret">{appareils === null ? t.horsLigne : t.appareils(appareils)}</span>
    {/if}
    <button type="button" class="lien" onclick={gererLesAcces}>{t.gerer}</button>
  </div>
  <p class="explication">{t.explication}</p>
  {#if lignes.length === 0}
    <p class="discret vide">{t.aucune}</p>
  {:else}
    <ul>
      {#each visibles as ligne, i (`${ligne.date}-${i}`)}
        <li>
          <span class="heure">{heure(ligne.date)}</span>
          <span class="quoi">{quoi(ligne)}</span>
          <span class="qui">{ligne.par ?? t.surCePc}</span>
          {#if ligne.resultat === 'refusee'}
            <span class="resultat refus"
              ><Icone nom="alerte" />{t.refusee(ligne.motif ? t.motifs[ligne.motif] : '')}</span
            >
          {:else}
            <span class="resultat ok"
              ><Icone nom="coche" />{ligne.resultat === 'acceptee' ? t.acceptee : t.enregistree}</span
            >
          {/if}
        </li>
      {/each}
    </ul>
    {#if !toutes && lignes.length > 10}
      <button type="button" class="lien plus" onclick={() => (toutes = true)}>{t.toutes(lignes.length)}</button>
    {/if}
  {/if}
</section>

<style>
  .recues {
    display: flex;
    flex-direction: column;
    border: 1px solid var(--bordure);
    border-radius: 14px;
    background: var(--surface);
  }

  .tete {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 12px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--bordure);
  }

  h3 {
    flex: 1;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    font-family: var(--police-texte);
    font-size: 1rem;
    font-weight: 600;
  }

  .discret {
    color: var(--texte-discret);
    font-size: 0.875rem;
  }

  .explication {
    margin: 0;
    padding: 10px 16px 4px;
    color: var(--texte-discret);
    font-size: 0.875rem;
  }

  .vide {
    margin: 0;
    padding: 8px 16px 14px;
  }

  ul {
    margin: 0;
    padding: 4px 16px 10px;
    list-style: none;
  }

  li {
    display: grid;
    grid-template-columns: 4rem minmax(0, 1.6fr) minmax(0, 1fr) minmax(0, 1.3fr);
    align-items: center;
    gap: 12px;
    min-height: 38px;
    font-size: 0.9375rem;
  }

  .heure {
    color: var(--texte-discret);
  }

  .qui {
    color: var(--texte-discret);
  }

  .resultat {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-weight: 600;
  }

  .ok {
    color: var(--sur-etat-ok-fond);
  }

  .refus {
    color: var(--etat-erreur);
  }

  .lien {
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

  .plus {
    align-self: flex-start;
    margin: 0 16px 10px;
  }

  @media (max-width: 40rem) {
    li {
      grid-template-columns: 3.5rem minmax(0, 1fr);
      padding: 4px 0;
    }

    .qui,
    .resultat {
      grid-column: 2;
    }
  }
</style>
