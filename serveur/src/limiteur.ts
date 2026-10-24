// Durable Object « Limiteur » (repris du relais) : un objet par adresse IP (idFromName(ip)).
// Compte les essais erronés et bloque les essais au hasard (logique dans logique.ts).
import { DurableObject } from 'cloudflare:workers';
import { creerCompteur, enregistrerEchec, estBloque, DUREE_BLOCAGE, FENETRE_ESSAIS, type Compteur } from './logique';
import type { Env } from './index';

export class Limiteur extends DurableObject<Env> {
  /** Vrai si les essais de cette adresse sont refusés. */
  async estBloque(): Promise<boolean> {
    return estBloque(await this.lire(), Date.now());
  }

  async enregistrerEchec(): Promise<void> {
    const maintenant = Date.now();
    await this.ctx.storage.put('compteur', enregistrerEchec(await this.lire(), maintenant));
    // Efface le compteur quand il ne peut plus servir.
    await this.ctx.storage.setAlarm(maintenant + FENETRE_ESSAIS + DUREE_BLOCAGE);
  }

  override async alarm(): Promise<void> {
    await this.ctx.storage.deleteAll();
  }

  private async lire(): Promise<Compteur> {
    return (await this.ctx.storage.get<Compteur>('compteur')) ?? creerCompteur();
  }
}
