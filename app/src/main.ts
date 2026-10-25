import { mount } from 'svelte';
import App from './App.svelte';
// Polices de la charte (US-011), servies par l'application : sous-ensemble latin, graisses utilisées seulement.
import '@fontsource/figtree/latin-400.css';
import '@fontsource/figtree/latin-600.css';
import '@fontsource/bricolage-grotesque/latin-700.css';
import './app.css';

const cible = document.getElementById('app');
if (!cible) throw new Error('Élément #app introuvable');

export default mount(App, { target: cible });
