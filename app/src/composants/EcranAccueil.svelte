<script lang="ts">
  // Mode Accueil de l'écran géant (US-160, maquette validée le 2026-11-28) : avant le lancement des poules, des plans de
  // 8 s en boucle, façon bande annonce : l'affiche (zoom lent sur son flou), le nom lettre par lettre et le type, les
  // horaires (la prochaine étape en tête), les inscrits et les émargés qui défilent jusqu'à leur nombre. Le compte à
  // rebours vers la prochaine étape (appel, scratch, début) reste fixe en bas ; passé le début, « Début imminent ».
  import type { AccueilDirect, VueDirect } from '@poule-position/domaine';
  import { onMount } from 'svelte';
  import {
    ETAPES_ACCUEIL,
    formaterReste,
    instantHoraire,
    plansAccueil,
    prochaineEtape,
    type PlanAccueil,
  } from '../lib/ecran-geant';
  import { textes } from '../lib/textes';

  interface Proprietes {
    vue: VueDirect & { accueil: AccueilDirect };
    maintenant: number;
    /** Adresse publique de l'affiche (`GET /fichiers/<nom>`), null sans serveur. */
    adresseAffiche: string | null;
    /** Durée d'un plan, en millisecondes. */
    duree?: number;
  }

  let { vue, maintenant, adresseAffiche, duree = 8000 }: Proprietes = $props();

  const t = textes.ecranGeant.accueil;
  const te = textes.epreuves;
  const accueil = $derived(vue.accueil);
  const equipes = $derived(accueil.typeEpreuve !== 'individuelle');

  /** Une affiche qui ne se charge pas (hors ligne, retirée) : son plan est sauté. */
  let afficheIllisible = $state(false);
  const plans = $derived(
    plansAccueil(accueil).filter((plan) => plan !== 'affiche' || (adresseAffiche !== null && !afficheIllisible)),
  );
  let numero = $state(0);
  const plan: PlanAccueil = $derived(plans[numero % plans.length] ?? 'nom');

  onMount(() => {
    const minuteur = setInterval(() => (numero += 1), duree);
    return () => clearInterval(minuteur);
  });

  const types = $derived(
    [te.armes[vue.arme], vue.categorie, vue.sexe ? te.sexes[vue.sexe] : null, t.types[accueil.typeEpreuve]].filter(
      (v): v is string => Boolean(v),
    ),
  );
  /** Les mots du nom, chacun avec ses lettres et leur rang (délai d'apparition) ; un mot ne se coupe jamais. */
  const mots = $derived.by(() => {
    let rang = 0;
    return vue.nom
      .split(/\s+/)
      .filter(Boolean)
      .map((mot) => [...mot].map((lettre) => ({ lettre, rang: rang++ })));
  });
  /**
   * Taille du nom (em) selon sa longueur : 10,5 pour un nom court, moins pour tenir sur deux ou trois lignes, et assez
   * petit pour que le mot le plus long tienne sur une ligne (environ 0,6 em par lettre, 1 700 px de large).
   */
  const tailleNom = $derived.by(() => {
    const longueur = Math.max(1, vue.nom.length);
    const motLePlusLong = Math.max(1, ...mots.map((mot) => mot.length));
    return Math.max(3, Math.min(10.5, 330 / longueur, 177 / motLePlusLong));
  });

  const suivante = $derived(prochaineEtape(accueil, vue.date, maintenant));
  const etapes = $derived(
    ETAPES_ACCUEIL.flatMap((etape) => {
      const horaire = accueil.horaires[etape];
      if (!horaire) return [];
      const passee = instantHoraire(vue.date, horaire, maintenant) <= maintenant;
      const prochaine = suivante?.etape === etape;
      return [{ etape, horaire, passee, prochaine }];
    }),
  );

  /** Les chiffres défilent de 0 à leur valeur à chaque passage du plan. */
  let compte = $state({ inscrits: 0, emarges: 0 });
  $effect(() => {
    if (plan !== 'chiffres') return;
    const cible = { inscrits: accueil.inscrits, emarges: accueil.emarges };
    const reduit = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduit) {
      compte = cible;
      return;
    }
    const debut = performance.now();
    let image = 0;
    const pas = (instant: number) => {
      const p = Math.min(1, (instant - debut) / 1800);
      const e = 1 - Math.pow(1 - p, 3);
      compte = { inscrits: Math.round(cible.inscrits * e), emarges: Math.round(cible.emarges * e) };
      if (p < 1) image = requestAnimationFrame(pas);
    };
    image = requestAnimationFrame(pas);
    return () => cancelAnimationFrame(image);
  });
  const CIRCONFERENCE = 2 * Math.PI * 200;
  const jauge = (valeur: number, total: number) => CIRCONFERENCE * (1 - (total > 0 ? valeur / total : 0));
</script>

<div class="accueil">
  <div class="reperes" role="img" aria-label={t.plans}>
    {#each plans as p, i (p)}
      <i class:vu={i < numero % plans.length}
        >{#key numero}<b class:encours={i === numero % plans.length} style:--duree="{duree}ms"></b>{/key}</i
      >
    {/each}
  </div>

  <div class="scene">
    {#key `${plan}-${numero}`}
      {#if plan === 'affiche' && adresseAffiche}
        <section class="plan" data-plan="affiche">
          <img class="flou" src={adresseAffiche} alt="" aria-hidden="true" />
          <img
            class="affiche"
            src={adresseAffiche}
            alt={t.affiche(vue.nom)}
            onerror={() => {
              afficheIllisible = true;
              numero += 1;
            }}
          />
        </section>
      {:else if plan === 'nom'}
        <section class="plan titre-plan" data-plan="nom">
          {#if accueil.competition}<p class="surtitre">{accueil.competition}</p>{/if}
          <h2 class="nom" aria-label={vue.nom} style:font-size="{tailleNom}em">
            {#each mots as mot, m (m)}<span class="mot" aria-hidden="true"
                >{#each mot as { lettre, rang } (rang)}<span
                    class="lettre"
                    style:animation-delay="{0.15 + Math.min(rang, 40) * 0.05}s">{lettre}</span
                  >{/each}</span
              >{' '}{/each}
          </h2>
          <ul class="types">
            {#each types as type, i (type)}<li style:animation-delay="{1.2 + i * 0.15}s">{type}</li>{/each}
          </ul>
        </section>
      {:else if plan === 'horaires'}
        <section class="plan horaires" data-plan="horaires">
          {#each etapes as e, i (e.etape)}
            <div
              class="horaire"
              class:prochaine={e.prochaine}
              class:passee={e.passee}
              style:animation-delay="{0.2 + i * 0.25}s"
            >
              <span class="etiquette">{t.etapes[e.etape]}</span>
              <span class="valeur">{e.horaire}</span>
              <span class="etat">{e.prochaine ? t.prochaine : e.passee ? t.passe : t.aVenir}</span>
            </div>
          {/each}
        </section>
      {:else}
        <section class="plan chiffres" data-plan="chiffres">
          {#each [{ cle: 'inscrits', valeur: compte.inscrits, cible: accueil.inscrits, total: accueil.inscrits, libelle: t.inscrits(accueil.inscrits, equipes) }, { cle: 'emarges', valeur: compte.emarges, cible: accueil.emarges, total: accueil.inscrits, libelle: t.emarges(equipes) }] as c (c.cle)}
            <div class="chiffre {c.cle}" aria-label="{c.cible} {c.libelle}">
              <div class="anneau" aria-hidden="true">
                <svg viewBox="0 0 440 440">
                  <circle class="piste" cx="220" cy="220" r="200" />
                  <circle
                    class="jauge"
                    cx="220"
                    cy="220"
                    r="200"
                    stroke-dasharray={CIRCONFERENCE}
                    stroke-dashoffset={jauge(c.valeur, c.total)}
                  />
                </svg>
                <span class="nombre"
                  >{c.valeur}{#if c.cle === 'emarges'}<small>{t.sur(accueil.inscrits)}</small>{/if}</span
                >
              </div>
              <span class="libelle">{c.libelle}</span>
            </div>
          {/each}
        </section>
      {/if}
    {/key}
  </div>

  <div class="rebours">
    <div class="compteur" role="timer">
      {#if suivante?.etape}
        <span class="avant"><strong>{t.etapes[suivante.etape]}</strong> {t.dans}</span>
        <span class="temps">{formaterReste(suivante.reste)}</span>
      {:else if suivante}
        <span class="imminent">{t.imminent}</span>
      {:else}
        <span class="imminent calme">{t.pastille}</span>
      {/if}
    </div>
    {#if etapes.length > 0}
      <ol class="etapes">
        {#each etapes as e (e.etape)}
          <li class:faite={e.passee} class:encours={e.prochaine}>
            <span class="barre"><i></i></span>
            <span class="nom-etape"><span>{t.etapes[e.etape]}</span><span>{e.horaire}</span></span>
          </li>
        {/each}
      </ol>
    {/if}
  </div>
</div>

<style>
  /* 1 em = 16 px à 1920 px (taille de base de l'écran géant) ; mesures de la maquette divisées par 16. */
  .accueil {
    position: relative;
    display: grid;
    grid-template-rows: 1fr auto;
    height: 100%;
    margin: -1.5em -3em;
  }

  .reperes {
    position: absolute;
    top: 1.25em;
    right: 3.5em;
    z-index: 2;
    display: flex;
    gap: 0.6em;
  }

  .reperes i {
    width: 2.75em;
    height: 0.375em;
    border-radius: 0.2em;
    background: var(--surface-2);
    overflow: hidden;
  }

  .reperes b {
    display: block;
    width: 0;
    height: 100%;
    background: var(--texte);
  }

  .reperes i.vu b {
    width: 100%;
  }

  .reperes b.encours {
    animation: remplit var(--duree) linear forwards;
  }

  @keyframes remplit {
    to {
      width: 100%;
    }
  }

  .scene {
    position: relative;
    min-height: 0;
    overflow: hidden;
  }

  .plan {
    position: absolute;
    inset: 0;
    animation: apparait 0.9s ease both;
  }

  @keyframes apparait {
    from {
      opacity: 0;
    }
  }

  /* Plan « affiche » : l'affiche entière, son flou en fond. */
  .flou {
    position: absolute;
    inset: -4em;
    width: calc(100% + 8em);
    height: calc(100% + 8em);
    object-fit: cover;
    filter: blur(3em) saturate(1.2);
    opacity: 0.35;
  }

  .affiche {
    position: absolute;
    top: 2.5em;
    bottom: 2.5em;
    left: 50%;
    height: calc(100% - 5em);
    max-width: 80%;
    object-fit: contain;
    border-radius: 0.75em;
    box-shadow: var(--ombre-flottante);
    animation: kenburns 9s ease-out forwards;
  }

  @keyframes kenburns {
    from {
      transform: translateX(-50%) scale(1.08) translateY(0.75em);
    }
    to {
      transform: translateX(-50%) scale(1);
    }
  }

  /* Plan « nom » : lettre par lettre, puis le type en étiquettes. */
  .titre-plan {
    display: grid;
    place-content: center;
    padding: 0 6em;
    gap: 2.25em;
    text-align: center;
  }

  .surtitre {
    margin: 0;
    color: var(--accent);
    font-size: 1.875em;
    letter-spacing: 0.18em;
    text-transform: uppercase;
  }

  .nom {
    margin: 0;
    font-family: var(--police-titre);
    max-width: 100%;
    font-weight: 800;
    line-height: 0.95;
    letter-spacing: -0.02em;
    text-wrap: balance;
  }

  /* Un mot passe à la ligne en entier. */
  .mot {
    display: inline-block;
    white-space: nowrap;
  }

  .lettre {
    display: inline-block;
    opacity: 0;
    transform: translateY(0.35em) rotate(4deg);
    animation: lettre 0.7s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
  }

  @keyframes lettre {
    to {
      opacity: 1;
      transform: none;
    }
  }

  .types {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 1.125em;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .types li {
    padding: 0.45em 0.95em;
    border: 0.125em solid var(--bordure);
    border-radius: 999px;
    font-size: 2em;
    font-weight: 600;
    opacity: 0;
    animation: monte 0.6s ease-out forwards;
  }

  .types li:first-child {
    border-color: var(--accent);
    color: var(--accent);
  }

  @keyframes monte {
    from {
      opacity: 0;
      transform: translateY(1em);
    }
    to {
      opacity: 1;
      transform: none;
    }
  }

  /* Plan « horaires » : la prochaine étape en tête, les passées estompées. */
  .horaires {
    display: grid;
    grid-auto-columns: minmax(0, 1fr);
    grid-auto-flow: column;
    gap: 2.5em;
    padding: 5.5em 7.5em;
  }

  .horaire {
    display: grid;
    align-content: center;
    gap: 0.75em;
    padding: 3em;
    border: 0.125em solid var(--bordure);
    border-radius: 1.5em;
    background: var(--surface);
    opacity: 0;
    animation: glisse 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
  }

  .horaire.passee {
    animation-name: glisse-passee;
  }

  @keyframes glisse {
    from {
      opacity: 0;
      transform: translateX(-5em);
    }
    to {
      opacity: 1;
      transform: none;
    }
  }

  @keyframes glisse-passee {
    from {
      opacity: 0;
      transform: translateX(-5em);
    }
    to {
      opacity: 0.45;
      transform: none;
    }
  }

  .etiquette {
    color: var(--texte-discret);
    font-size: 2.125em;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .valeur {
    font-family: var(--police-titre);
    font-size: 8.75em;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    line-height: 1;
  }

  .etat {
    color: var(--texte-discret);
    font-size: 1.75em;
  }

  .horaire.prochaine {
    border-color: var(--accent);
    background: linear-gradient(160deg, var(--accent-teinte), var(--surface));
  }

  .horaire.prochaine .etat {
    color: var(--accent);
    font-weight: 600;
  }

  /* Plan « chiffres » : inscrits (ambre) et émargés (turquoise) en anneaux. */
  .chiffres {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 5em;
    align-items: center;
    padding: 2em 12.5em;
  }

  .chiffre {
    display: grid;
    justify-items: center;
    gap: 1em;
  }

  .anneau {
    position: relative;
    width: 26em;
    height: 26em;
  }

  .anneau svg {
    width: 100%;
    height: 100%;
    transform: rotate(-90deg);
  }

  .anneau circle {
    fill: none;
    stroke-width: 22;
  }

  .anneau .piste {
    stroke: var(--surface-2);
  }

  .anneau .jauge {
    stroke: var(--accent);
    stroke-linecap: round;
  }

  .inscrits .jauge {
    stroke: var(--etat-attente);
  }

  .nombre {
    position: absolute;
    inset: 0;
    display: grid;
    place-content: center;
    font-family: var(--police-titre);
    font-size: 10.5em;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    line-height: 1;
    text-align: center;
  }

  .nombre small {
    display: block;
    margin-top: 0.3em;
    color: var(--texte-discret);
    font-family: var(--police-texte);
    font-size: 0.18em;
    font-weight: 500;
  }

  .libelle {
    font-size: 2.625em;
    font-weight: 600;
  }

  /* Bas : le compte à rebours fixe et la frise des étapes. */
  .rebours {
    display: grid;
    grid-template-columns: auto 1fr;
    align-items: center;
    gap: 5em;
    min-height: 15.6em;
    padding: 0 3.5em;
    border-top: 1px solid var(--bordure);
  }

  .compteur {
    display: grid;
    gap: 0.2em;
  }

  .avant {
    color: var(--texte-discret);
    font-size: 2.125em;
  }

  .avant strong {
    color: var(--texte);
  }

  .temps {
    font-family: var(--police-titre);
    font-size: 7.5em;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    line-height: 1;
  }

  .imminent {
    color: var(--etat-attente);
    font-family: var(--police-titre);
    font-size: 6em;
    font-weight: 800;
    animation: pulse 1.6s ease-in-out infinite;
  }

  .imminent.calme {
    color: var(--texte);
    animation: none;
  }

  @keyframes pulse {
    50% {
      opacity: 0.45;
    }
  }

  .etapes {
    display: grid;
    grid-auto-columns: minmax(0, 1fr);
    grid-auto-flow: column;
    gap: 2.5em;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .etapes li {
    display: grid;
    gap: 0.6em;
  }

  .barre {
    height: 0.625em;
    border-radius: 999px;
    background: var(--surface-2);
    overflow: hidden;
  }

  .barre i {
    display: block;
    width: 0;
    height: 100%;
    background: var(--accent);
  }

  .faite .barre i {
    width: 100%;
  }

  .nom-etape {
    display: flex;
    justify-content: space-between;
    gap: 0.75em;
    color: var(--texte-discret);
    font-size: 1.75em;
  }

  .encours .nom-etape {
    color: var(--texte);
    font-weight: 600;
  }

  @media (prefers-reduced-motion: reduce) {
    .plan,
    .affiche,
    .lettre,
    .types li,
    .horaire,
    .imminent,
    .reperes b.encours {
      animation: none;
      opacity: 1;
      transform: none;
    }

    .affiche {
      transform: translateX(-50%);
    }

    .horaire.passee {
      opacity: 0.45;
    }
  }
</style>
