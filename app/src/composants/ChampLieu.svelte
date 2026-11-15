<script lang="ts">
  // Champ « Lieu » d'une manifestation avec suggestions d'adresses (US-070, ADR-0025). C'est un texte libre : l'organisateur
  // peut toujours écrire ce qu'il veut. En ligne, à partir de 3 caractères et après une pause de frappe, jusqu'à 5 adresses
  // s'affichent dessous ; en choisir une remplit le champ et mémorise ses coordonnées. Modifier le texte à la main retire
  // les coordonnées. Hors ligne, ou si le service échoue, seule la saisie libre reste. Motif WAI-ARIA « combobox à liste ».
  import type { Coordonnees } from '@poule-position/domaine';
  import { onMount } from 'svelte';
  import {
    CARACTERES_MIN,
    PAUSE_APRES_429_MS,
    PAUSE_FRAPPE_MS,
    rechercherAdresses,
    type Suggestion,
  } from '../lib/adresse';
  import { textes } from '../lib/textes';

  interface Proprietes {
    id?: string;
    lieu: string;
    coordonnees: Coordonnees | null | undefined;
    disabled?: boolean;
    invalide?: boolean;
    decritPar?: string;
  }

  let {
    id = 'lieu',
    lieu = $bindable(''),
    // Écrit seulement : le parent lit les coordonnées par la liaison.
    // eslint-disable-next-line no-useless-assignment
    coordonnees = $bindable(null),
    disabled = false,
    invalide = false,
    decritPar,
  }: Proprietes = $props();

  const t = textes.manifestations.adresse;
  type Etat = 'repos' | 'recherche' | 'liste' | 'vide' | 'indisponible';

  let etat = $state<Etat>('repos');
  let suggestions: Suggestion[] = $state([]);
  let actif = $state(-1);
  let enLigne = $state(navigator.onLine);
  let minuteur: ReturnType<typeof setTimeout> | undefined;
  let requete: AbortController | undefined;
  let bloqueJusqua = 0;

  const ouverte = $derived(etat === 'liste' && suggestions.length > 0);

  onMount(() => {
    const surReseau = () => {
      enLigne = navigator.onLine;
      if (!enLigne) annuler();
    };
    window.addEventListener('online', surReseau);
    window.addEventListener('offline', surReseau);
    return () => {
      window.removeEventListener('online', surReseau);
      window.removeEventListener('offline', surReseau);
      annuler();
    };
  });

  /** Abandonne la recherche en cours (frappe suivante, choix, perte du réseau) : sa réponse serait périmée. */
  function annuler() {
    clearTimeout(minuteur);
    requete?.abort();
    requete = undefined;
    etat = 'repos';
    suggestions = [];
    actif = -1;
  }

  async function chercher(texte: string) {
    if (Date.now() < bloqueJusqua) {
      etat = 'indisponible';
      return;
    }
    const controleur = new AbortController();
    requete = controleur;
    etat = 'recherche';
    try {
      const resultat = await rechercherAdresses(texte, (url, options) => fetch(url, options), controleur.signal);
      if (requete !== controleur) return;
      if (!resultat.ok) {
        if (resultat.erreur === 'TROP_DE_REQUETES') bloqueJusqua = Date.now() + PAUSE_APRES_429_MS;
        etat = 'indisponible';
        suggestions = [];
      } else {
        suggestions = resultat.suggestions;
        etat = suggestions.length > 0 ? 'liste' : 'vide';
      }
      actif = -1;
    } catch {
      // Annulée par la frappe suivante : la nouvelle requête prend le relais.
    }
  }

  function surSaisie() {
    // CA-4 : un texte modifié à la main ne correspond plus à l'adresse choisie.
    coordonnees = null;
    annuler();
    const texte = lieu.trim();
    if (!enLigne || texte.length < CARACTERES_MIN) return;
    etat = 'recherche';
    minuteur = setTimeout(() => void chercher(texte), PAUSE_FRAPPE_MS);
  }

  function choisir(suggestion: Suggestion) {
    annuler();
    lieu = suggestion.libelle;
    coordonnees = suggestion.coordonnees;
  }

  function surTouche(evenement: KeyboardEvent) {
    if (evenement.key === 'Escape' && (ouverte || etat !== 'repos')) {
      evenement.preventDefault();
      annuler();
    } else if (ouverte && evenement.key === 'ArrowDown') {
      evenement.preventDefault();
      actif = (actif + 1) % suggestions.length;
    } else if (ouverte && evenement.key === 'ArrowUp') {
      evenement.preventDefault();
      actif = (actif - 1 + suggestions.length) % suggestions.length;
    } else if (ouverte && evenement.key === 'Enter' && actif >= 0) {
      evenement.preventDefault();
      choisir(suggestions[actif]!);
    }
  }

  const message = $derived(
    !enLigne
      ? t.horsLigne
      : etat === 'recherche'
        ? t.recherche
        : etat === 'vide'
          ? t.aucune
          : etat === 'indisponible'
            ? t.indisponible
            : '',
  );
</script>

<div class="lieu">
  <input
    {id}
    type="text"
    role="combobox"
    aria-autocomplete="list"
    aria-expanded={ouverte}
    aria-controls="{id}-suggestions"
    aria-activedescendant={ouverte && actif >= 0 ? `${id}-suggestion-${actif}` : undefined}
    aria-invalid={invalide ? 'true' : undefined}
    aria-describedby={[decritPar, `${id}-etat`].filter(Boolean).join(' ')}
    autocomplete="off"
    bind:value={lieu}
    oninput={surSaisie}
    onkeydown={surTouche}
    {disabled}
  />
  {#if ouverte}
    <ul id="{id}-suggestions" class="suggestions" role="listbox" aria-label={t.suggestions}>
      {#each suggestions as suggestion, i (suggestion.libelle + i)}
        <li
          id="{id}-suggestion-{i}"
          role="option"
          aria-selected={i === actif}
          class:actif={i === actif}
          onmousedown={(evenement) => {
            evenement.preventDefault();
            choisir(suggestion);
          }}
        >
          {suggestion.libelle}
        </li>
      {/each}
    </ul>
  {/if}
  <small id="{id}-etat" class="etat" role="status">{message}</small>
</div>

<style>
  .lieu {
    display: grid;
    gap: 0.3rem;
  }

  input {
    max-width: 100%;
    padding: 0.6rem 0.75rem;
    border: 1px solid var(--bordure-champ);
    border-radius: var(--rayon);
    background: var(--fond);
    color: var(--texte);
    font: inherit;
  }

  input[aria-invalid='true'] {
    border-color: var(--etat-erreur);
  }

  /* Dans le flux, sous le champ : la liste ne masque pas les boutons du formulaire (« Suivant »). */
  .suggestions {
    margin: 0;
    padding: 0.25rem;
    list-style: none;
    border: 1px solid var(--bordure);
    border-radius: var(--rayon);
    background: var(--surface);
  }

  .suggestions li {
    min-height: 44px;
    display: flex;
    align-items: center;
    padding: 0.4rem 0.6rem;
    border-radius: 6px;
    color: var(--texte);
    cursor: pointer;
  }

  .suggestions li:hover,
  .suggestions li.actif {
    background: var(--surface-2);
  }

  .etat {
    min-height: 1.1em;
    color: var(--texte-discret);
    font-weight: 400;
  }
</style>
