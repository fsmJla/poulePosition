// Règles métier pures (ADR-0001) : aucun accès au réseau, au stockage ni au DOM.
export * from './comptes';
export { calculerIndice, type Touches } from './indice';
