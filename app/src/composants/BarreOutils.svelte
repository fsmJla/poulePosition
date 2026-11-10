<script lang="ts">
  // Petite barre en haut à droite des pages sans entête (US-052 CA-2) : accueil, connexion, mot de passe oublié et
  // réinitialisation. Elle porte le sélecteur de thème ; l'état du serveur (US-053) viendra s'y ajouter.
  import SelecteurTheme from './SelecteurTheme.svelte';
</script>

<div class="barre">
  <SelecteurTheme />
</div>

<style>
  .barre {
    position: absolute;
    top: 0.5rem;
    right: max(0.75rem, env(safe-area-inset-right));
    z-index: 5;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
</style>
