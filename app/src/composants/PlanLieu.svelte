<script lang="ts">
  // Plan du lieu d'une manifestation (US-071, ADR-0025) : tuiles OpenStreetMap autour des coordonnées de l'adresse choisie
  // (US-070), avec un repère, l'attribution et un lien vers une application de cartes. Sans coordonnées : rien (le texte du
  // lieu est affiché par la page). Le plan n'est chargé que lorsqu'il approche de l'écran, jamais hors ligne, et n'est pas
  // interactif : il ne gêne ni le défilement ni le reste de la page. Aucune tuile n'est mise en cache par l'application.
  import { sontCoordonneesValides, type Coordonnees } from '@poule-position/domaine';
  import { onMount } from 'svelte';
  import { HAUTEUR_PLAN, lienCartes, tuilesAutour } from '../lib/plan-lieu';
  import { textes } from '../lib/textes';
  import Icone from './Icone.svelte';

  interface Proprietes {
    lieu: string | null;
    coordonnees: Coordonnees | null | undefined;
  }

  let { lieu, coordonnees }: Proprietes = $props();

  const t = textes.planLieu;
  const position = $derived(sontCoordonneesValides(coordonnees) ? coordonnees : null);
  const tuiles = $derived(position ? tuilesAutour(position) : []);

  let enLigne = $state(navigator.onLine);
  /** Le plan est entré (ou va entrer) dans l'écran : les tuiles peuvent être demandées. */
  let proche = $state(false);
  let erreurs = $state(0);
  let boite: HTMLElement | undefined = $state();
  const indisponible = $derived(tuiles.length > 0 && erreurs >= tuiles.length);
  const tactile = window.matchMedia('(pointer: coarse)').matches;

  // Un nouveau lieu : le plan se recentre, les erreurs du précédent sont oubliées.
  $effect(() => {
    void position;
    erreurs = 0;
  });

  onMount(() => {
    const surReseau = () => (enLigne = navigator.onLine);
    window.addEventListener('online', surReseau);
    window.addEventListener('offline', surReseau);
    return () => {
      window.removeEventListener('online', surReseau);
      window.removeEventListener('offline', surReseau);
    };
  });

  // Chargement différé : seulement quand le cadre approche de l'écran.
  $effect(() => {
    if (!boite || proche) return;
    if (typeof IntersectionObserver === 'undefined') {
      proche = true;
      return;
    }
    const observateur = new IntersectionObserver(
      (entrees) => {
        if (entrees.some((entree) => entree.isIntersecting)) {
          proche = true;
          observateur.disconnect();
        }
      },
      { rootMargin: '200px' },
    );
    observateur.observe(boite);
    return () => observateur.disconnect();
  });
</script>

{#if position}
  <figure class="plan">
    {#if !enLigne}
      <p class="etat" role="status">{t.horsLigne}</p>
    {:else}
      <div
        bind:this={boite}
        class="carte"
        role="img"
        aria-label={t.libelle(lieu ?? '')}
        style="height: {HAUTEUR_PLAN}px"
      >
        {#if proche && !indisponible}
          <div class="tuiles">
            {#each tuiles as tuile (tuile.url)}
              <img
                src={tuile.url}
                alt=""
                width="256"
                height="256"
                referrerpolicy="strict-origin-when-cross-origin"
                style="left: calc(50% + {tuile.gauche}px); top: calc(50% + {tuile.haut}px)"
                onerror={() => (erreurs += 1)}
              />
            {/each}
          </div>
          <span class="repere"><Icone nom="lieu" taille={32} /></span>
        {:else if indisponible}
          <p class="etat" role="status">{t.indisponible}</p>
        {/if}
      </div>
      <figcaption>
        <a href={lienCartes(position, lieu ?? '', tactile)} target="_blank" rel="noopener noreferrer">{t.ouvrir}</a>
        <small
          ><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer"
            >{t.attribution}</a
          ></small
        >
      </figcaption>
    {/if}
  </figure>
{/if}

<style>
  .plan {
    display: grid;
    gap: 0.4rem;
    margin: 0.5rem 0 0;
    max-width: 640px;
  }

  .carte {
    position: relative;
    overflow: hidden;
    border: 1px solid var(--bordure);
    border-radius: 14px;
    background: var(--surface-2);
    /* Le doigt fait défiler la page : le plan ne capte aucun geste. */
    pointer-events: none;
  }

  .tuiles {
    position: absolute;
    inset: 0;
  }

  .tuiles img {
    position: absolute;
    display: block;
    max-width: none;
  }

  /* Le repère est posé sur le centre du plan, la pointe du symbole sur le point. */
  .repere {
    position: absolute;
    left: 50%;
    top: 50%;
    display: grid;
    transform: translate(-50%, -100%);
    color: var(--etat-erreur);
  }

  .etat {
    display: grid;
    place-items: center;
    height: 100%;
    margin: 0;
    padding: 0.5rem 0;
    color: var(--texte-discret);
    font-size: 0.9rem;
  }

  figcaption {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 0.25rem 1rem;
    align-items: center;
  }

  figcaption a {
    color: var(--accent);
  }

  figcaption small a {
    color: var(--texte-discret);
  }
</style>
