// Stub de « server-only » pour les tests de composants.
// Le vrai paquet n'expose rien de résoluble hors condition react-server :
// un composant qui tire (même indirectement) un module serveur ferait
// échouer la collecte du test avant même le premier rendu.
export {};
