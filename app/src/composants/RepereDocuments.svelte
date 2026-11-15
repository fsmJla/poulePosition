<script lang="ts">
  // Repère « Document » d'une ligne de la liste (US-073) : l'icône apparaît seulement si l'élément porte lui-même une
  // affiche ou une feuille de route (les lignes qui les héritent n'en montrent pas). Un clic ouvre la fenêtre d'aperçu
  // d'US-072, sans ouvrir la ligne ; avec deux documents, un choix « Affiche / Feuille de route » la complète.
  import { onDestroy } from 'svelte';
  import type { SorteFichier } from '@poule-position/domaine';
  import type { FichierJoint } from '@poule-position/protocole';
  import type { ClientFichiers } from '../lib/fichiers';
  import { textes } from '../lib/textes';
  import FenetreApercu from './FenetreApercu.svelte';
  import Icone from './Icone.svelte';

  interface Proprietes {
    client: ClientFichiers;
    affiche: FichierJoint | null;
    feuilleDeRoute: FichierJoint | null;
    /** Mode sélection (US-059) : l'icône est inerte, le clic sélectionne la ligne. */
    inerte?: boolean;
  }

  let { client, affiche, feuilleDeRoute, inerte = false }: Proprietes = $props();

  const t = textes.fichiers;
  const tr = t.repere;
  const nom = $derived(affiche && feuilleDeRoute ? tr.les2 : affiche ? tr.affiche : tr.feuilleDeRoute);

  let sorte = $state<SorteFichier>('affiche');
  let adresse = $state<string | undefined>();
  let fenetre: FenetreApercu | undefined = $state();
  let bouton: HTMLButtonElement | undefined = $state();
  const urlsLocales: string[] = [];

  const fichierDe = (voulue: SorteFichier) => (voulue === 'affiche' ? affiche : feuilleDeRoute);

  /** Contenu gardé sur l'appareil, à défaut adresse du serveur ; rien hors ligne sans copie (« Aperçu disponible en ligne »). */
  async function preparer(voulue: SorteFichier) {
    sorte = voulue;
    const fichier = fichierDe(voulue);
    adresse = undefined;
    if (!fichier) return;
    const local = await client.contenuLocal(fichier.nom);
    if (local) {
      const url = URL.createObjectURL(local);
      urlsLocales.push(url);
      adresse = url;
    } else if (navigator.onLine) {
      adresse = client.adresse(fichier.nom) ?? undefined;
    }
  }

  async function ouvrir() {
    await preparer(affiche ? 'affiche' : 'feuilleDeRoute');
    fenetre?.ouvrir();
  }

  onDestroy(() => urlsLocales.forEach((url) => URL.revokeObjectURL(url)));
</script>

{#if affiche || feuilleDeRoute}
  <button
    type="button"
    class="repere"
    bind:this={bouton}
    aria-label={nom}
    title={nom}
    aria-disabled={inerte}
    onclick={(evenement) => {
      evenement.preventDefault();
      evenement.stopPropagation();
      if (!inerte) void ouvrir();
    }}
  >
    <Icone nom="document" taille={20} />
  </button>
  <FenetreApercu bind:this={fenetre} {sorte} {adresse} surFermeture={() => bouton?.focus()}>
    {#snippet choix()}
      {#if affiche && feuilleDeRoute}
        <span class="choix" role="group" aria-label={tr.choix}>
          {#each ['affiche', 'feuilleDeRoute'] as const as voulue (voulue)}
            <button type="button" class="neutre" aria-pressed={sorte === voulue} onclick={() => void preparer(voulue)}
              >{voulue === 'affiche' ? t.affiche : t.feuilleDeRoute}</button
            >
          {/each}
        </span>
      {/if}
    {/snippet}
  </FenetreApercu>
{/if}

<style>
  .repere {
    display: inline-flex;
    flex: none;
    align-items: center;
    justify-content: center;
    min-width: 44px;
    min-height: 44px;
    padding: 0;
    border: 0;
    border-radius: var(--rayon);
    background: none;
    color: var(--accent);
    cursor: pointer;
  }

  .repere:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: -2px;
  }

  .choix {
    display: inline-flex;
    gap: 0.5rem;
  }

  .neutre {
    min-width: 44px;
    min-height: 44px;
    padding: 0 0.9rem;
    border: 1px solid var(--bordure-champ);
    border-radius: var(--rayon);
    background: var(--surface);
    color: var(--texte);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }

  .neutre[aria-pressed='true'] {
    border-color: var(--accent);
    background: var(--accent-teinte);
  }
</style>
