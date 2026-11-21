<script lang="ts">
  // Onglet « Écrans » d'une manifestation, ou écrans d'une compétition seule (US-133, planche 36) : « Ajouter un écran »
  // en action principale ; une carte par écran (état, épreuves cochées, réglages, lien et QR code tant qu'il n'a jamais
  // été ouvert) ; « ⋯ » pour modifier, copier le lien, ouvrir sur ce PC, régénérer le lien et supprimer. Hors ligne, la
  // copie de l'appareil reste lisible et les écritures sont grisées.
  import { onMount } from 'svelte';
  import {
    lienEcran,
    type Ecran,
    type ProprietaireEcran,
    type ReglagesEcran,
    type VueImposee,
  } from '@poule-position/protocole';
  import type { ClientEcrans, ErreurEcrans } from '../lib/ecrans';
  import { textes } from '../lib/textes';
  import CodeQr from './CodeQr.svelte';
  import CommandeEcran from './CommandeEcran.svelte';
  import ConfirmationArchivage from './ConfirmationArchivage.svelte';
  import FenetreEcran, { type GroupeEpreuves } from './FenetreEcran.svelte';
  import Icone from './Icone.svelte';
  import MenuActions, { type ActionMenu } from './MenuActions.svelte';

  interface Proprietes {
    client: ClientEcrans;
    proprietaire: ProprietaireEcran;
    groupes: readonly GroupeEpreuves[];
    /** US-136 : ouvre l'écran dans une fenêtre locale de ce PC (absent tant que la fenêtre locale n'existe pas). */
    ouvrirSurCePc?: ((ecran: Ecran) => boolean) | undefined;
    /** US-135 CA-4 : une vue imposée depuis ce PC, pour sa fenêtre locale (avec ou sans réseau). */
    imposerLocalement?: ((ecranId: string, vue: VueImposee | null) => void) | undefined;
  }

  let { client, proprietaire, groupes, ouvrirSurCePc, imposerLocalement }: Proprietes = $props();
  const t = textes.ecrans;

  let ecrans = $state<Ecran[]>([]);
  let connectes = $state<string[]>([]);
  let copieLe: number | null = $state(null);
  let horsLigne = $state(!navigator.onLine);
  let charge = $state(false);
  let message: string | null = $state(null);
  let fenetre: { ecran: Ecran | null } | null = $state(null);
  let confirmation: { ecran: Ecran; action: 'regenerer' | 'supprimer' } | null = $state(null);
  let copie: string | null = $state(null);

  const miens = $derived(
    ecrans.filter(({ proprietaire: p }) => p.type === proprietaire.type && p.id === proprietaire.id),
  );
  const nomsEpreuves = $derived(new Map(groupes.flatMap(({ epreuves }) => epreuves.map((e) => [e.id, e.nom]))));
  const motif = (erreur: ErreurEcrans) => t.erreurs[erreur];

  async function charger() {
    const resultat = await client.lister();
    charge = true;
    if (!resultat.ok) {
      message = motif(resultat.erreur);
      return;
    }
    ecrans = resultat.ecrans;
    connectes = resultat.connectes;
    copieLe = resultat.copieLe;
    message = null;
  }

  onMount(() => {
    const surReseau = () => {
      horsLigne = !navigator.onLine;
      void charger();
    };
    window.addEventListener('online', surReseau);
    window.addEventListener('offline', surReseau);
    void charger();
    // CA-1 : l'état « Connecté » suit l'écran ; relu régulièrement tant que l'onglet est ouvert et en ligne.
    const minuteur = setInterval(() => {
      if (navigator.onLine) void charger();
    }, 15_000);
    return () => {
      clearInterval(minuteur);
      window.removeEventListener('online', surReseau);
      window.removeEventListener('offline', surReseau);
    };
  });

  /** US-136 : fenêtre locale ; bloquée par le navigateur, on le dit. */
  function ouvrir(ecran: Ecran) {
    if (ouvrirSurCePc && !ouvrirSurCePc(ecran)) message = t.fenetreBloquee;
  }

  async function enregistrer(ecran: Ecran | null, reglages: ReglagesEcran): Promise<string | null> {
    const resultat = ecran
      ? await client.modifier(ecran.id, reglages)
      : await client.creer({ proprietaire, ...reglages });
    if (!resultat.ok) return motif(resultat.erreur);
    await charger();
    return null;
  }

  const lien = (ecran: Ecran) => lienEcran(location.origin, ecran);

  async function copier(ecran: Ecran) {
    try {
      await navigator.clipboard.writeText(lien(ecran));
      copie = ecran.id;
      setTimeout(() => (copie = null), 3000);
    } catch {
      // Presse-papiers refusé : le lien reste lisible et sélectionnable sur la carte.
    }
  }

  function actions(ecran: Ecran): ActionMenu[] {
    const indisponible = horsLigne ? t.horsLigne : undefined;
    return [
      { libelle: t.modifier, icone: 'crayon', surChoix: () => (fenetre = { ecran }), indisponible },
      { libelle: t.copier, icone: 'lien', surChoix: () => void copier(ecran) },
      ...(ouvrirSurCePc ? [{ libelle: t.ouvrirSurCePc, icone: 'ecran' as const, surChoix: () => ouvrir(ecran) }] : []),
      {
        libelle: t.regenerer,
        icone: 'flechesCroisees',
        detail: t.regenererDetail,
        surChoix: () => (confirmation = { ecran, action: 'regenerer' }),
        indisponible,
      },
      {
        libelle: t.supprimer,
        icone: 'corbeille',
        destructive: true,
        surChoix: () => (confirmation = { ecran, action: 'supprimer' }),
        indisponible,
      },
    ];
  }

  async function confirmer() {
    if (!confirmation) return { ok: true as const };
    const { ecran, action } = confirmation;
    const resultat = action === 'regenerer' ? await client.regenerer(ecran.id) : await client.supprimer(ecran.id);
    if (!resultat.ok) return { ok: false as const, message: motif(resultat.erreur) };
    return { ok: true as const };
  }
</script>

<section class="ecrans" aria-label={t.titre}>
  <div class="tete">
    <p>{t.intro}</p>
    <button
      type="button"
      class="principal"
      disabled={horsLigne}
      title={horsLigne ? t.horsLigne : undefined}
      onclick={() => (fenetre = { ecran: null })}
    >
      <Icone nom="plus" taille={20} />{t.ajouter}
    </button>
  </div>

  {#if copieLe !== null}<p class="avertissement" role="status">{t.copieDu(copieLe)}</p>{/if}
  {#if message}<p class="erreur" role="alert">{message}</p>{/if}

  {#if charge && miens.length === 0 && !message}
    <p class="vide">{t.aucun}</p>
  {/if}

  {#each miens as ecran (ecran.id)}
    {@const connecte = connectes.includes(ecran.id)}
    <article class="carte" aria-label={ecran.nom}>
      <div class="ligne">
        <Icone nom="ecran" taille={22} />
        <h2>{ecran.nom}</h2>
        {#if connecte}
          <span class="etat connecte"><span aria-hidden="true" class="pastille"></span>{t.connecte}</span>
        {:else}
          <span class="etat">{ecran.ouvertLe === null ? t.jamaisOuvert : t.ouvertLe(ecran.ouvertLe)}</span>
        {/if}
        <CommandeEcran {client} {ecran} {connecte} {horsLigne} {nomsEpreuves} {imposerLocalement} recharger={charger} />
        <MenuActions
          id="menu-ecran-{ecran.id}"
          nom={ecran.nom}
          etiquette={t.autres(ecran.nom)}
          actions={actions(ecran)}
          contour
        />
      </div>
      <div class="epreuves">
        {#each ecran.epreuves as id (id)}
          <span class="puce">{nomsEpreuves.get(id) ?? id}</span>
        {:else}
          <span class="discret">{t.aucuneEpreuve}</span>
        {/each}
        <span class="discret">· {t.reglagesResume(ecran.dureePage, ecran.vuesMasquees.length)}</span>
      </div>
      {#if ecran.ouvertLe === null && !connecte}
        <div class="lien">
          <CodeQr texte={lien(ecran)} nom={t.qr(ecran.nom)} taille={112} />
          <div class="adresse">
            <span class="discret">{t.lienLibelle}</span>
            <code>{lien(ecran)}</code>
            <div class="boutons">
              <button type="button" class="secondaire" onclick={() => void copier(ecran)}>
                <Icone nom="lien" taille={18} />{copie === ecran.id ? t.copie : t.copier}
              </button>
              {#if ouvrirSurCePc}
                <button type="button" class="secondaire" onclick={() => ouvrir(ecran)}>
                  <Icone nom="ecran" taille={18} />{t.ouvrirSurCePc}
                </button>
              {:else}
                <a class="secondaire" href={lien(ecran)} target="_blank" rel="noopener">
                  <Icone nom="ecran" taille={18} />{t.ouvrir}
                </a>
              {/if}
            </div>
          </div>
        </div>
      {/if}
      {#if copie === ecran.id}<p class="discret" role="status">{t.copie}</p>{/if}
    </article>
  {/each}
</section>

{#if fenetre}
  {@const ecran = fenetre.ecran}
  <FenetreEcran
    initial={ecran}
    {groupes}
    enregistrer={(reglages) => enregistrer(ecran, reglages)}
    fermer={() => (fenetre = null)}
  />
{/if}

{#if confirmation}
  {@const { ecran, action } = confirmation}
  <ConfirmationArchivage
    titre={action === 'regenerer' ? t.confirmerRegeneration(ecran.nom) : t.confirmerSuppression(ecran.nom)}
    detail={action === 'regenerer' ? t.detailRegeneration : t.detailSuppression}
    action={action === 'regenerer' ? t.actionRegeneration : t.actionSuppression}
    valider={confirmer}
    fermer={(fait) => {
      confirmation = null;
      if (fait) void charger();
    }}
  />
{/if}

<style>
  .ecrans {
    display: grid;
    gap: 1rem;
  }

  .tete {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .tete p {
    max-width: 40rem;
    margin: 0;
    color: var(--texte-discret);
  }

  .principal,
  .secondaire {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    min-height: 44px;
    padding: 0 1rem;
    border-radius: var(--rayon);
    font: inherit;
    text-decoration: none;
    cursor: pointer;
  }

  .principal {
    border: none;
    background: var(--accent-fond);
    color: var(--sur-accent);
    font-weight: 600;
  }

  .secondaire {
    border: 1px solid var(--bordure-champ);
    background: var(--surface);
    color: var(--texte);
  }

  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .carte {
    display: grid;
    gap: 0.75rem;
    padding: 1rem;
    border: 1px solid var(--bordure);
    border-radius: 14px;
    background: var(--surface);
  }

  .ligne {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem 0.75rem;
  }

  h2 {
    flex: 1 1 12rem;
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
  }

  .etat {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.1rem 0.65rem;
    border-radius: 999px;
    background: var(--surface-2);
    color: var(--texte-discret);
    font-size: 0.875rem;
    font-weight: 600;
  }

  .etat.connecte {
    background: var(--etat-ok-fond);
    color: var(--sur-etat-ok-fond, var(--etat-ok));
  }

  .pastille {
    width: 8px;
    height: 8px;
    border-radius: 999px;
    background: var(--etat-ok);
  }

  .epreuves {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
  }

  .puce {
    display: inline-flex;
    align-items: center;
    min-height: 32px;
    padding: 0 0.75rem;
    border: 1px solid var(--bordure);
    border-radius: 999px;
    background: var(--fond);
    font-size: 0.95rem;
  }

  .discret,
  .vide {
    color: var(--texte-discret);
    font-size: 0.95rem;
  }

  .vide {
    margin: 0;
  }

  .lien {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 1rem 1.5rem;
  }

  .adresse {
    display: grid;
    flex: 1 1 20rem;
    gap: 0.5rem;
  }

  code {
    padding: 0.5rem 0.65rem;
    border: 1px solid var(--bordure);
    border-radius: 8px;
    background: var(--fond);
    font-size: 0.875rem;
    overflow-wrap: anywhere;
  }

  .boutons {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .avertissement,
  .erreur {
    margin: 0;
  }

  .avertissement {
    color: var(--texte-discret);
  }

  .erreur {
    color: var(--etat-erreur);
  }
</style>
