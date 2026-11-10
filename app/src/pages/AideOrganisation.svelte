<script lang="ts">
  // « Comment ça s'organise » (US-046 CA-3), page réservée : les trois niveaux emboîtés sur un exemple (un week-end, deux
  // compétitions et leurs épreuves, une compétition seule à côté) et ce que chaque niveau reprend du précédent. Page
  // statique de l'application : elle s'affiche aussi hors ligne. Même langage visuel que la liste et le plan (CA-4).
  import Lien from '../composants/Lien.svelte';
  import { CHEMINS } from '../lib/routes';
  import { textes } from '../lib/textes';

  interface Proprietes {
    naviguer: (chemin: string) => void;
  }

  let { naviguer }: Proprietes = $props();

  const t = textes.aide;
  const niveaux = [t.manifestation, t.competition, t.epreuve];
</script>

<main>
  <h1>{t.titre}</h1>
  <p class="intro">{t.intro}</p>

  <section aria-labelledby="titre-niveaux">
    <h2 id="titre-niveaux">{t.niveaux}</h2>
    <ol class="niveaux">
      {#each niveaux as niveau (niveau.nom)}
        <li>
          <strong>{niveau.nom}</strong>
          <span>{niveau.texte}</span>
        </li>
      {/each}
    </ol>
  </section>

  <section aria-labelledby="titre-exemple">
    <h2 id="titre-exemple">{t.exemple}</h2>
    <div class="exemple">
      <div class="cadre">
        <p class="nom-cadre"><strong>{t.exempleManifestation}</strong> <small>{t.exempleJours}</small></p>
        {#each t.exempleCompetitions as competition, rang (competition.nom)}
          <div class="bande" style="--couleur: var(--plan-{rang})">
            <strong>{competition.nom}</strong>
            <span class="tuiles">
              {#each competition.epreuves as epreuve (epreuve)}<span class="tuile">{epreuve}</span>{/each}
            </span>
          </div>
        {/each}
      </div>
      <div class="seule">
        <p class="nom-seule"><small>{t.exempleSeule}</small></p>
        <div class="bande" style="--couleur: var(--plan-2)">
          <strong>{t.exempleSeuleNom}</strong>
          <span class="tuiles"><span class="tuile">{t.exempleEpreuveSeule}</span></span>
        </div>
      </div>
    </div>
  </section>

  <p><Lien chemin={CHEMINS.creer} {naviguer}>{t.retour}</Lien></p>
</main>

<style>
  main {
    display: grid;
    gap: 1rem;
    width: min(100%, 48rem);
    margin: 0 auto;
    padding: 2rem 1rem 4rem;
  }

  h1,
  h2,
  p {
    margin: 0;
  }

  h2 {
    font-size: 1.15rem;
  }

  .intro,
  small {
    color: var(--texte-discret);
    font-weight: 400;
  }

  .niveaux {
    display: grid;
    gap: 0.6rem;
    margin: 0.5rem 0 0;
    padding-left: 1.25rem;
  }

  .niveaux li {
    display: grid;
    gap: 0.15rem;
  }

  .exemple {
    display: grid;
    gap: 0.9rem;
    margin-top: 0.5rem;
  }

  .cadre {
    display: grid;
    gap: 0.5rem;
    padding: 0.75rem;
    border-radius: var(--rayon);
    background: var(--marque);
    color: var(--sur-marque);
  }

  .cadre small {
    color: var(--sur-marque);
    opacity: 0.85;
  }

  .bande {
    display: grid;
    gap: 0.4rem;
    padding: 0.5rem 0.75rem;
    border-left: 0.4rem solid var(--couleur);
    border-radius: 0.25rem;
    background: var(--surface);
    color: var(--texte);
  }

  .seule {
    display: grid;
    gap: 0.35rem;
  }

  .seule .bande {
    border: 1px solid var(--bordure-champ);
    border-left: 0.4rem solid var(--couleur);
  }

  .tuiles {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }

  .tuile {
    padding: 0.15rem 0.55rem;
    border: 1px solid var(--bordure-champ);
    border-radius: 0.4rem;
    background: var(--fond);
    font-size: 0.9rem;
  }
</style>
