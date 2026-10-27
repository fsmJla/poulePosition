<script lang="ts">
  // Avatar d'un compte (US-016) : pastille ronde aux initiales du nom, sur la couleur du compte (charte, variables
  // --avatar-<couleur>). Décoratif par défaut ; avec `libelle`, il est annoncé comme une image.
  import { initiales, type CouleurAvatar } from '@poule-position/domaine';

  interface Proprietes {
    nom: string;
    couleur: CouleurAvatar;
    /** Diamètre, en pixels. */
    taille?: number;
    /** Nom accessible ; sans lui, l'avatar est décoratif (le nom est déjà écrit à côté). */
    libelle?: string;
  }

  let { nom, couleur, taille = 40, libelle }: Proprietes = $props();
</script>

<span
  class="avatar"
  style:--taille="{taille}px"
  style:background="var(--avatar-{couleur})"
  data-couleur={couleur}
  role={libelle ? 'img' : undefined}
  aria-label={libelle}
  aria-hidden={libelle ? undefined : 'true'}>{initiales(nom)}</span
>

<style>
  .avatar {
    display: inline-grid;
    flex: none;
    place-items: center;
    width: var(--taille);
    height: var(--taille);
    border-radius: 50%;
    color: var(--sur-avatar);
    font-family: var(--police-titre);
    font-size: calc(var(--taille) * 0.4);
    font-weight: 700;
    line-height: 1;
    user-select: none;
  }
</style>
