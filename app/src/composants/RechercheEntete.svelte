<script lang="ts">
  // Recherche de l'entête (US-062, planches 1 et 5) : sur écran large, un champ après la marque ; sur écran étroit, une loupe
  // qui ouvre le champ en pleine largeur. La recherche se fait sur l'appareil, dans la liste du club (lue au premier usage
  // du champ : à jour en ligne, sinon les copies gardées sur l'appareil) ; la saisie ne part jamais au serveur. Les règles
  // (casse, accents, mots, classement, 10 résultats par groupe) sont celles de `rechercher`, dans le domaine. Le champ suit
  // le motif WAI-ARIA « combobox à liste » : flèches, Entrée, Échap.
  import { rechercher, type ResultatRecherche } from '@poule-position/domaine';
  import { onMount } from 'svelte';
  import type { Accueil, DonneesAccueil } from '../lib/accueil';
  import { memoriserRepli } from '../lib/repli';
  import { CHEMINS, cheminEpreuve, cheminManifestation } from '../lib/routes';
  import { textes } from '../lib/textes';
  import BoutonIcone from './BoutonIcone.svelte';
  import Icone from './Icone.svelte';

  interface Proprietes {
    accueil: Accueil;
    naviguer: (chemin: string) => void;
    /** Écran étroit : une loupe à la place du champ. */
    etroit: boolean;
  }

  let { accueil, naviguer, etroit }: Proprietes = $props();

  const t = textes.recherche;
  const tc = textes.epreuves;

  let saisie = $state('');
  /** Écran étroit : la barre de recherche est ouverte. */
  let barreOuverte = $state(false);
  /** Échap a fermé la liste ; elle revient à la frappe suivante. */
  let fermee = $state(false);
  let actif = $state(-1);
  let donnees: DonneesAccueil | null = $state(null);
  let chargement = false;
  let conteneur: HTMLElement | undefined = $state();
  let champ: HTMLInputElement | undefined = $state();

  const resultats = $derived(
    donnees
      ? rechercher(donnees, saisie, { armes: tc.armes, sexes: tc.sexes })
      : { actif: false, manifestations: [], competitions: [], epreuves: [], total: 0 },
  );
  /** Saisie assez longue pour chercher (même si la liste du club n'est pas encore là). */
  const saisieSuffisante = $derived(saisie.trim().length >= 2);
  const ouverte = $derived(saisieSuffisante && !fermee && (barreOuverte || !etroit));
  /** Tous les résultats, dans l'ordre d'affichage (manifestations, compétitions, épreuves), pour les flèches. */
  const aplatis: ResultatRecherche[] = $derived([
    ...resultats.manifestations,
    ...resultats.competitions,
    ...resultats.epreuves,
  ]);
  /** Résultat mis en évidence par les flèches. */
  const retenu: ResultatRecherche | undefined = $derived(actif >= 0 ? aplatis[actif] : undefined);
  const identifiant = (resultat: ResultatRecherche) => `recherche-${resultat.type}-${resultat.id}`;

  /** Lit la liste du club une fois, au premier usage du champ ; en cas d'échec, une liste vide (la recherche reste utilisable). */
  function charger() {
    if (donnees || chargement) return;
    chargement = true;
    accueil
      .charger()
      .then((lues) => (donnees = lues))
      .catch(() => (donnees = { manifestations: [], competitions: [], epreuves: [], horsLigne: true, copieLe: null }))
      .finally(() => (chargement = false));
  }

  function contexte(resultat: ResultatRecherche): string {
    if (resultat.type === 'manifestation') {
      const { debut, fin, lieu } = resultat.contexte;
      return [textes.manifestations.periode(debut, fin), lieu].filter(Boolean).join(' · ');
    }
    if (resultat.type === 'competition') {
      return [resultat.contexte.manifestation, resultat.contexte.arme].filter(Boolean).join(' · ');
    }
    const { competition, arme, date } = resultat.contexte;
    return [competition, arme, date ? textes.listeClub.jourCourt(date) : null].filter(Boolean).join(' · ');
  }

  function fermerBarre() {
    barreOuverte = false;
    fermee = false;
    saisie = '';
    actif = -1;
  }

  function choisir(resultat: ResultatRecherche) {
    if (resultat.type === 'manifestation') naviguer(cheminManifestation(resultat.id));
    else if (resultat.type === 'epreuve') naviguer(cheminEpreuve(resultat.id));
    else if (resultat.manifestationId) naviguer(cheminManifestation(resultat.manifestationId));
    else {
      // Compétition seule : l'accueil la montre dépliée (même si la page est déjà affichée).
      memoriserRepli(resultat.id, true);
      window.dispatchEvent(new CustomEvent('poule:deplier', { detail: { id: resultat.id } }));
      naviguer(CHEMINS.organisateur);
    }
    fermerBarre();
    champ?.blur();
  }

  function surTouche(evenement: KeyboardEvent) {
    if (evenement.key === 'Escape') {
      if (ouverte) fermee = true;
      else if (etroit) fermerBarre();
      evenement.preventDefault();
      return;
    }
    if (!ouverte || aplatis.length === 0) return;
    if (evenement.key === 'ArrowDown') {
      actif = (actif + 1) % aplatis.length;
      evenement.preventDefault();
    } else if (evenement.key === 'ArrowUp') {
      actif = actif <= 0 ? aplatis.length - 1 : actif - 1;
      evenement.preventDefault();
    } else if (evenement.key === 'Enter') {
      const retenu = aplatis[actif >= 0 ? actif : 0];
      if (retenu) choisir(retenu);
      evenement.preventDefault();
    }
  }

  function surSaisie() {
    fermee = false;
    actif = -1;
    charger();
  }

  async function ouvrirBarre() {
    barreOuverte = true;
    charger();
    // Le champ n'existe qu'une fois la barre ouverte.
    await Promise.resolve();
    queueMicrotask(() => champ?.focus());
  }

  onMount(() => {
    const surClicExterieur = (evenement: PointerEvent) => {
      if (conteneur && !conteneur.contains(evenement.target as Node)) fermee = true;
    };
    document.addEventListener('pointerdown', surClicExterieur);
    return () => document.removeEventListener('pointerdown', surClicExterieur);
  });

  const groupes = $derived([
    { cle: 'manifestation', libelle: t.groupes.manifestation, liste: resultats.manifestations },
    { cle: 'competition', libelle: t.groupes.competition, liste: resultats.competitions },
    { cle: 'epreuve', libelle: t.groupes.epreuve, liste: resultats.epreuves },
  ] as const);
</script>

{#snippet champRecherche()}
  <div class="champ">
    <Icone nom="loupe" taille={18} />
    <input
      bind:this={champ}
      bind:value={saisie}
      type="text"
      role="combobox"
      autocomplete="off"
      spellcheck="false"
      placeholder={t.placeholder}
      aria-label={t.placeholder}
      aria-autocomplete="list"
      aria-expanded={ouverte}
      aria-controls="resultats-recherche"
      aria-activedescendant={ouverte && retenu ? identifiant(retenu) : undefined}
      onfocus={charger}
      oninput={surSaisie}
      onkeydown={surTouche}
    />
  </div>
  {#if ouverte}
    <div class="panneau" id="resultats-recherche" role="listbox" aria-label={t.resultats}>
      {#if !donnees}
        <p class="message">{t.chargement}</p>
      {:else if resultats.total === 0}
        <p class="message">{t.aucunResultat(saisie.trim())}</p>
      {:else}
        {#each groupes as groupe (groupe.cle)}
          {#if groupe.liste.length > 0}
            <div role="group" aria-label={groupe.libelle}>
              <p class="titre-groupe" aria-hidden="true">{groupe.libelle}</p>
              {#each groupe.liste as resultat (resultat.id)}
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <div
                  id={identifiant(resultat)}
                  role="option"
                  tabindex="-1"
                  aria-selected={aplatis[actif] === resultat}
                  class="resultat"
                  class:actif={aplatis[actif] === resultat}
                  onmousedown={(evenement) => evenement.preventDefault()}
                  onclick={() => choisir(resultat)}
                >
                  <span class="nom">{resultat.nom}</span>
                  {#if resultat.archivee}<span class="archivee">{t.archivee}</span>{/if}
                  <span class="contexte">{contexte(resultat)}</span>
                </div>
              {/each}
            </div>
          {/if}
        {/each}
      {/if}
    </div>
  {/if}
{/snippet}

{#if etroit}
  {#if barreOuverte}
    <!-- Écran étroit, barre ouverte : le champ recouvre l'entête, en pleine largeur (planche 5). -->
    <div class="barre" bind:this={conteneur}>
      <div class="zone">{@render champRecherche()}</div>
      <BoutonIcone icone="croix" nom={t.fermer} surMarque onclick={fermerBarre} />
    </div>
  {:else}
    <BoutonIcone
      icone="loupe"
      nom={t.ouvrir}
      surMarque
      aria-expanded="false"
      aria-controls="resultats-recherche"
      onclick={ouvrirBarre}
    />
  {/if}
{:else}
  <div class="large" bind:this={conteneur}>{@render champRecherche()}</div>
{/if}

<style>
  .large {
    position: relative;
    flex: 1;
    min-width: 8rem;
    max-width: 29rem;
    margin: 0 auto 0 1.5rem;
  }

  .barre {
    position: absolute;
    inset: 0;
    z-index: 60;
    display: flex;
    gap: 0.25rem;
    align-items: center;
    padding: 0.5rem max(0.75rem, env(safe-area-inset-right)) 0.5rem max(1rem, env(safe-area-inset-left));
    background: var(--marque);
  }

  .zone {
    position: relative;
    flex: 1;
    min-width: 0;
  }

  .champ {
    position: relative;
    display: flex;
    align-items: center;
    box-sizing: border-box;
    min-height: 40px;
    padding: 0 0.75rem;
    border-radius: var(--rayon);
    background: var(--fond);
    color: var(--texte-discret);
  }

  .champ :global(svg) {
    flex: none;
  }

  input {
    flex: 1;
    min-width: 0;
    min-height: 40px;
    padding: 0 0 0 0.6rem;
    border: 0;
    background: none;
    color: var(--texte);
    font: inherit;
  }

  input::placeholder {
    color: var(--texte-discret);
  }

  input:focus-visible {
    outline: none;
  }

  .champ:focus-within {
    outline: 2px solid var(--palette-tiffany);
    outline-offset: 2px;
  }

  .panneau {
    position: absolute;
    top: calc(100% + 0.4rem);
    left: 0;
    z-index: 60;
    box-sizing: border-box;
    width: min(36rem, calc(100vw - 2rem));
    max-height: min(70vh, 32rem);
    padding: 0.35rem;
    overflow-y: auto;
    border: 1px solid var(--bordure);
    border-radius: var(--rayon);
    background: var(--surface);
    box-shadow: 0 6px 20px color-mix(in srgb, var(--texte) 25%, transparent);
    color: var(--texte);
  }

  .barre .panneau {
    width: 100%;
  }

  .message {
    margin: 0;
    padding: 0.75rem;
    color: var(--texte-discret);
  }

  .titre-groupe {
    margin: 0;
    padding: 0.5rem 0.75rem 0.25rem;
    color: var(--texte-discret);
    font-size: 0.8rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .resultat {
    display: flex;
    flex-wrap: wrap;
    gap: 0 0.6rem;
    align-items: baseline;
    box-sizing: border-box;
    min-height: 44px;
    padding: 0.4rem 0.75rem;
    border-radius: 8px;
    cursor: pointer;
  }

  .resultat:hover,
  .resultat.actif {
    background: var(--accent-teinte);
  }

  .nom {
    font-weight: 600;
    overflow-wrap: anywhere;
  }

  .contexte {
    flex-basis: 100%;
    color: var(--texte-discret);
    font-size: 0.85rem;
  }

  .archivee {
    padding: 0.05rem 0.5rem;
    border-radius: 999px;
    background: var(--surface-2);
    color: var(--texte-discret);
    font-size: 0.75rem;
    font-weight: 600;
  }
</style>
