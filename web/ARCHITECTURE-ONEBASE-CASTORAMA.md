# V3.1 locale — architecture et vérification

Évolution de `web/` en complément du V2 local, sans utilisation du prototype central `v3/`. Aucun déploiement Pages autorisé pour ce lot. Le workflow navigateur assemble et teste le package ; la publication Pages n'est pas déclenchée.

## Modules

| Module | Rôle |
| --- | --- |
| `onebase-model.js` | Extraction locale libellés/paragraphes, evidence, signalement des ambiguïtés, suggestions limitées aux faits, dossier structuré et changements confirmés. |
| `onebase-ui.js` | Nouveau produit, sources corrigées, enrichissement, personnalisation, templates, mappings et contrôle/export d'une fiche. |
| `castorama-excel.js` | Contexte indépendant du V1, lecture listes/plages nommées et exigences `Columns`, contrôle, export OOXML d'une copie. |
| `onebase-demo.js` | Classeur statique intégralement fictif, téléchargeable depuis l'interface. |
| `catalogue-model.js` / `catalogue-store.js` | V2 conservé ; validation du dossier facultatif, révision globale IndexedDB et notification locale après sauvegarde. |
| `excel-browser.js` | Moteur V1 conservé ; ouverture indépendante de template et limite plus haute pour les feuilles de référence en lecture seule. |

## Données

Identités UUID des produits et stockage `semin-marketplace-studio` / `workspace` conservés. `schemaVersion: 1` conserve les attributs extensibles et ajoute un `dossier` **facultatif**, versionné et validé, sans migration destructive.

- `values` : champs du catalogue corrigés, attributs OneBase supplémentaires définis lors de la première création.
- `dossier.source` : texte original, valeurs initialement extraites, passages justificatifs, date de capture. Une correction de fiche ne remplace pas le texte ni l'extraction initiale ; seul un nouveau texte explicitement analysé puis confirmé remplace cette source.
- `dossier.enrichment` : titre/HTML/cinq arguments communs.
- `dossier.castorama` : surcharges de ces contenus (absence = héritage, chaîne vide = vide explicite).
- `dossier.templateValues[signature][colonne]` : saisies spécifiques, conservées par produit et format de template ; aucune valeur dans les profils de mapping.
- `dossier.variantConfirmed` : vérification explicite de la variante, réinitialisée si SKU ou conditionnement source change.

La référence OneBase est une source distincte, pas une clé d'unicité : plusieurs conditionnements peuvent partager une fiche OneBase. Le rapprochement métier conserve les identités SKU/EAN et bloque les conflits ; la révision du catalogue évite un écrasement entre onglets. Les champs non concernés et les surcharges d'autres templates sont conservés.

Les anciennes fiches et sauvegardes V2 passent les mêmes validations. L'enregistrement/édition V2 conserve le dossier additionnel. Une sauvegarde JSON V2 ancienne restaurée remplace le catalogue seulement selon le parcours confirmé existant, donc ne contient évidemment pas les dossiers créés après cette sauvegarde. Aucun transfert de stockage ni suppression automatique.

## Export

Les octets du fichier importé sont figés dans le contexte du template. Chaque export repart de cette archive originale et modifie seulement le XML de la feuille cible, sans modifier les autres composants ZIP. Les lignes existantes sont conservées, les styles des nouveaux champs viennent du modèle de données, les validations ne sont pas étendues. Seule la dimension de la feuille et les cellules de la nouvelle ligne changent. Les formats structurés non évaluables sont refusés, pas convertis en classeur simplifié.

`Columns` fournit les marqueurs REQUIRED par catégorie quand les libellés correspondent. Si la catégorie n'est pas encore reconnue, l'union des exigences est affichée. La présence d'une validation Excel de type `none` signifie une aide de saisie, pas une contrainte ; elle est conservée sans inventer une restriction. Les règles réellement calculées/non prises en charge restent bloquantes.

Une nouvelle lecture est nécessaire après actualisation : ni le template original ni un catalogue de référence rempli n'est persisté. Les profils Castorama ont leur propre clé localStorage et JSON, sans affecter les profils V1. La fiche exportable doit être enregistrée, y compris ses saisies Castorama, et contrôlée à la révision courante ; une modification pendant la génération annule le téléchargement.

## Tests et audit

La couverture V3.1 comprend 13 tests V1/V2 existants et 17 tests OneBase/Castorama : extraction multiline/ambiguïtés, champs absents, quatre arguments sans cinquième inventé, source intacte, enrichissements indépendants, persistance, mise à jour confirmée, révision obsolète, sauvegardes V2/dossier invalide, template rempli et grande feuille de référence, contraintes/métadonnées requises, mappings sans valeurs produits, valeurs spécifiques, cellules occupées/fusionnées, règles non évaluables, HTML dangereux, tactile et exemple autonome téléchargeable. Les cinq tests de correction ajoutés couvrent les rubriques irrégulières, le conditionnement décomposé, les sous-instructions d’application, les identifiants absents ou parasites et l’absence de modification des fiches sauvegardées avant confirmation. Tous les textes et classeurs de cette suite sont synthétiques.

Une vérification privée supplémentaire utilise le fichier transmis par l'utilisateur, hors du dépôt : 3 onglets et 141 colonnes lus, listes de référence au-delà de 20 000 lignes prises en charge ; ajout d'une ligne entièrement fictive vérifié. Les lignes originales et validations restent identiques, et seul `xl/worksheets/sheet1.xml` diffère dans l'archive. Aucun fichier ou valeur commerciale de cette vérification n'est ajouté aux fixtures publiques ou au package.

Le cas de texte fourni a été vérifié localement avec les liens sensibles masqués dans le script de test privé. Les tests publics avec liens fictifs prouvent la conservation du texte original et l'absence de requêtes externes. Les références distinctes, caractéristiques et quatre arguments sont extraits ; EAN, prix, stock, rendement numérique et contenance unique absents ne sont pas inventés. Les incohérences de catégorie, contenances multiples et SKU déjà présent dans le template sont signalées ; aucun export professionnel prêt à importer n'est prétendu obtenu.

```sh
node web/build.mjs
SEMIN_TEST_CHROMIUM=/usr/bin/chromium python3 -m unittest discover -s web/tests -v
```

Audit avant publication du code : HTML autoportant avec `connect-src 'none'`, scripts sans appel réseau, démos exclusivement fictives, fichiers utilisateur en dehors de Git, pas de secret ajouté. Voir le [guide utilisateur](GUIDE-ONEBASE-CASTORAMA.md). Une publication future et une recette physique Lenovo restent distinctes de ces tests locaux.

## Extension V3.2 manuelle

`chatgpt-model.js` prépare les consignes, valide le JSON et ajoute les versions marketplace dans `dossier.chatgpt`. `chatgpt-ui.js` propose une copie locale, la prévisualisation et une confirmation obligatoire. Le champ optionnel reste compatible avec les sauvegardes précédentes et les modifications OneBase conservent ces archives. Sept tests supplémentaires couvrent la copie et les trois marketplaces, la validation stricte, les révisions, les historiques, les sauvegardes, le mapping Excel et la confirmation humaine avant export. Aucun client API ni clé n’est ajouté.
