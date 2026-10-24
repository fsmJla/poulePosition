// Durable Object « Limiteur » : un objet par adresse IP (idFromName(ip)).
// Compte les codes erronés et bloque les essais au hasard (logique dans logique.js).
import { DurableObject } from 'cloudflare:workers';
import { creerCompteur, enregistrerEchec, estBloque, DUREE_BLOCAGE, FENETRE_ESSAIS } from './logique.js';

export class Limiteur extends DurableObject {
  /** @returns {Promise<boolean>} vrai si les essais de cette adresse sont refusés */
  async estBloque() {
    return estBloque(await this.lire(), Date.now());
  }

  async enregistrerEchec() {
    const maintenant = Date.now();
    await this.ctx.storage.put('compteur', enregistrerEchec(await this.lire(), maintenant));
    // Efface le compteur quand il ne peut plus servir.
    await this.ctx.storage.setAlarm(maintenant + FENETRE_ESSAIS + DUREE_BLOCAGE);
  }

  async alarm() {
    await this.ctx.storage.deleteAll();
  }

  async lire() {
    return (await this.ctx.storage.get('compteur')) ?? creerCompteur();
  }
}
