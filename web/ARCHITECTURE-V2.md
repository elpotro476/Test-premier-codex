# V2 — Lot 1 : catalogue maître local

Ce lot prolonge la V1 dans le même fichier HTML autonome. Il ajoute le catalogue maître sans remplacer le moteur Excel, les correspondances V1 ni le projet Windows. La publication Pages reste manuelle et nécessite la validation de cette V2 ; une mise à jour du code source ne déploie pas le site.

## Architecture retenue

| Élément | Responsabilité |
| --- | --- |
| `excel-browser.js` | Lecture OOXML et export V1 conservés. `openCatalogue()` ouvre un catalogue pour le maître sans modifier les fichiers du parcours V1. |
| `catalogue-model.js` | Identité produit, attributs, contrôles locaux, calcul des différences, application d’un import, édition et validation des sauvegardes. Aucun accès DOM ni réseau. |
| `catalogue-store.js` | Contrat asynchrone `read()` / `save(snapshot, expectedRevision)`, implémenté avec IndexedDB. |
| `catalogue-ui.js` | Navigation, aperçu des imports, filtres, fiches, paramètres et sauvegardes. Utilise les deux couches précédentes. |
| `ui.js` | Parcours import / correspondances / contrôle / export V1 conservé. |
| `build.mjs` | Assemble les composants, la bibliothèque et les exemples fictifs dans le HTML autonome. |

IndexedDB utilise la base `semin-marketplace-studio`, version 1, et le magasin `workspace`. Un document versionné contient les produits, définitions d’attributs, révision globale et journal local. Ce choix prototype assure une transaction atomique sur un import entier. Les lectures/écritures ne dépendent pas de l’emplacement du fichier HTML ou de l’exécutable Windows, mais de l’origine web et du profil Chrome.

Chaque produit comporte un UUID interne stable, des valeurs textuelles indexées par identifiant d’attribut, un statut manuel et une date de modification. Les définitions d’attributs portent un identifiant, un libellé, un type (texte / nombre), un groupe et un indicateur requis. Les nouveaux attributs ne nécessitent aucun changement du code. Le SKU et l’EAN ne sont pas utilisés comme clé interne : une correction de fiche ne change pas son identité.

Pour un futur serveur sécurisé, le dépôt IndexedDB pourra être remplacé derrière le contrat asynchrone. La gestion des identités et révisions restera dans le modèle. L’authentification, les droits, la synchronisation, le stockage central, les profils et versions de templates ainsi que les déclinaisons marketplace sont **des lots futurs**, pas des services déjà implémentés.

## Comportement de ce lot

- Catalogue Excel : choix feuille/en-têtes, associations suggérées et modifiables, colonnes supplémentaires importables comme attributs.
- Identification par SKU ou EAN ; collisions et ambiguïtés présentées comme conflits bloqués.
- Aperçu de chaque valeur avant/après, y compris les effacements proposés. Ajouts cochés par défaut, mises à jour décochées. Aperçu paginé à 200 lignes, sélection conservée entre pages.
- Aucune écriture avant confirmation. Les lignes non choisies et les conflits ne sont pas appliqués. Les colonnes ignorées conservent leurs valeurs existantes.
- Fiches éditables, recherche SKU/EAN/désignation/famille, filtres famille, complétude et statut, sélection des résultats.
- Attributs extensibles, nombres vérifiés, informations manquantes et EAN invalides signalés. SKU, désignation et marque sont les exigences initiales **du catalogue maître prototype**, pas des exigences officielles de marketplace.
- Préparation manuelle : À compléter, À contrôler, Prêt à exporter, Exporté. Une fiche invalide ne peut pas être marquée prête/exportée depuis l’éditeur. Ces statuts ne remplacent pas les contrôles marketplace V1 et ne prétendent pas certifier un import officiel.
- Sauvegarde JSON versionnée de tout le catalogue, validation avant restauration, aperçu des comptes et confirmation explicite du remplacement. Les correspondances V1 disposent de leur sauvegarde séparée et ne sont jamais effacées par une restauration du maître.
- Le stockage existant est validé avant toute écriture : un catalogue illisible ou endommagé ne peut pas être remplacé silencieusement, et l’interface refuse une sauvegarde vide lorsque le chargement a échoué.
- Révision vérifiée dans la transaction : une modification concurrente d’un autre onglet provoque une erreur et demande une actualisation, au lieu d’écraser la modification.
- Tableau de bord limité au catalogue : références, complétude, statuts manuels et dernières opérations. Le menu Marketplaces annonce le prochain lot ; Correspondances et Exports ouvrent le parcours V1.

## Limites volontaires

Pas encore de versions de templates, variantes marketplace, valeurs fixes par canal, exports depuis la sélection du maître, journal d’exports ni règles conditionnelles par catégorie. Ces fonctionnalités restent dans la feuille de route demandée. Aucune règle Amazon, Castorama, ManoMano, Cdiscount, Leroy Merlin, Bricoman, Maxeda, Hubo ou OBI n’est inventée.

20 000 produits et 250 attributs maximum ; import limité par le lecteur Excel V1. Les sauvegardes JSON sont limitées à 20 Mo dans l’interface. Le catalogue reste sur un seul appareil/profil/origine, sans partage ni chiffrement applicatif. Un changement de domaine ou l’effacement de Chrome peut rendre les données indisponibles : effectuer régulièrement des sauvegardes JSON.

Les URLs d’images et documents sont consultables comme texte dans la fiche. Aucune image ni aucun document distant n’est chargé automatiquement. La page conserve `connect-src 'none'` : aucun fichier catalogue, produit ou sauvegarde ne part vers un serveur.

## Tests et démonstration

Les 5 tests V1 demeurent exécutés. Les tests du catalogue couvrent les imports, reimports et effacements confirmés, doublons, édition, rechargement IndexedDB, nouveaux attributs, sauvegarde/restauration, sauvegarde invalide, conflits entre onglets, protection du stockage endommagé, zéros initiaux et écran tactile. Le total de ce lot est de 13 tests navigateur (5 V1 et 8 V2). Les tests ne contiennent que des données fictives et sont isolés dans des profils temporaires de navigateur.

```sh
node web/build.mjs
SEMIN_TEST_CHROMIUM=/usr/bin/chromium python -m unittest discover -s web/tests -v
```

Omettre `SEMIN_TEST_CHROMIUM` si Chromium Playwright est installé. Pour une vérification sur un site effectivement déployé, le workflow peut fournir `SEMIN_WEB_TEST_URL`.

Pour la revue : ouvrir le HTML de démonstration, aller à Catalogue maître → Charger un exemple fictif → examiner les changements → Enregistrer les lignes cochées. Ouvrir ensuite une fiche ; essayer les attributs et sauvegardes dans Paramètres. Le bouton de démonstration V1 continue de charger le parcours Excel sans écraser le catalogue maître.
