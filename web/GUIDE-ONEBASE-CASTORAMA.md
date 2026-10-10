# V3.1 locale — OneBase → Catalogue maître → Castorama

Cette évolution prolonge V2 dans le fichier HTML autonome, sans Supabase, API OneBase ni IA payante. Elle ne publie aucune nouvelle version automatiquement. Le prototype central du dossier `v3/` reste séparé et n'est pas utilisé par ce parcours.

## Essayer avec les exemples fictifs

1. Télécharger l'artefact **SEMIN-Marketplace-Navigateur** de la dernière exécution réussie du workflow **Version navigateur**. Extraire les deux archives si nécessaire, puis ouvrir `SEMIN-Marketplace.html` dans Chrome sous Windows, si la politique de votre poste autorise les HTML locaux. Aucune installation de Python ou Node n'est nécessaire pour utiliser l'application.
2. Dans **Nouveau produit · OneBase**, toucher **Exemple OneBase fictif**. Vérifier les champs et les passages sources.
3. Toucher **Préparer le contenu depuis les sources**. Relire le titre, les paragraphes HTML et les arguments ; il n'y a pas de remplissage automatique des faits manquants.
4. Toucher **Prévisualiser l'enregistrement**, examiner les différences, cocher la confirmation puis enregistrer.
5. Dans **Castorama · Contrôle et export**, toucher **Télécharger un template fictif**, puis importer ce fichier. Il contient déjà une ligne fictive à conserver.
6. Identifier les colonnes, vérifier le produit choisi et la ligne vierge proposée, puis toucher **Contrôler Castorama** et **Exporter la copie Excel Castorama**.

L'exemple téléchargeable représente un format de démonstration. Il ne prétend pas reproduire toutes les exigences officielles Castorama. Sur Android, l'ouverture de HTML local dépend de Chrome et des politiques du poste ; le site HTTPS V2 existant n'est pas mis à jour par ce travail. Le test réel Lenovo de cette évolution attend une publication distinctement autorisée.

## Coller le texte OneBase réel

Créer une nouvelle fiche et coller le texte entier, avec ses libellés. Les formes `Champ : valeur`, les libellés isolés (y compris entourés d'astérisques), les paragraphes et les arguments numérotés sont reconnus. Les autres passages restent consultables et tout le texte est conservé.

- **Source** : texte original et valeurs extraites, passages justificatifs ; les corrections alimentent les champs du catalogue maître.
- **Enrichissement commun** : titre, description HTML, cinq arguments éditables. Le bouton de préparation se limite aux informations saisies ou extraites. Quatre arguments sources restent quatre, le cinquième reste vide.
- **Castorama** : personnalisation du titre, HTML ou arguments, indépendante du contenu commun. Sans case cochée, le contenu commun est utilisé ; une personnalisation cochée mais vide laisse la valeur vide pour cette marketplace.

L’analyseur sépare notamment séchage, consommation, application (texte multilignes), épaisseur du film, stockage, densité, extrait sec, classement COV et réaction au feu. Les rubriques avec deux-points ou astérisques peuvent être collées sur une même ligne ; les libellés peuvent aussi être coupés par des retours à la ligne. Une rubrique inconnue clairement délimitée est isolée et signalée, pas ajoutée au champ précédent. Les textes sans limites identifiables demandent une vérification manuelle.

Un conditionnement unique explicite comme **1 seau de 25 kg** donne **nombre d’unités = 1**, **type = seau**, **poids = 25 kg**. Le libellé original est conservé ; les choix multiples et les contradictions restent à vérifier. Aucun changement automatique n’est appliqué aux fiches déjà enregistrées : pour corriger une ancienne extraction, réanalyser volontairement le texte puis examiner et confirmer la prévisualisation.

La référence OneBase n'est ni un EAN ni automatiquement un SKU. Une référence article isolée au format reconnu est proposée avec une demande de vérification. Un EAN absent reste absent. Plusieurs contenances dans un texte ne permettent pas de décider quelle variante appartient au SKU : vérifier cette association avant de renseigner la contenance marketplace.

Choisir une fiche dans **Fiche existante** pour la modifier. Un nouveau collage correspondant à un SKU/EAN existant propose une mise à jour. Les conflits entre plusieurs fiches sont bloqués. La prévisualisation montre aussi les effacements : une valeur vide confirmée peut effacer le champ concerné ; les attributs non présentés dans le formulaire sont conservés. La confirmation est obligatoire et un changement intervenu dans un autre onglet refuse l'enregistrement obsolète.

## Importer le template Castorama

Le fichier peut être déjà rempli. Choisir la feuille de produits et la ligne contenant les **libellés des colonnes**, puis **Identifier les colonnes du template**. Si le fichier contient une seconde ligne de codes techniques, elle est conservée. La destination proposée suit la dernière ligne contenant une valeur ou formule ; vous pouvez choisir une autre zone entièrement vierge.

Les feuilles `ReferenceData` et `Columns`, lorsqu'elles existent, restent intactes. Les listes Excel et les champs `REQUIRED` de `Columns` servent au contrôle. La catégorie marketplace doit correspondre au template : une catégorie générale OneBase n'est pas automatiquement convertie en chemin de catégorie Castorama. En l'absence de catégorie reconnue, les exigences des catégories présentes sont regroupées pour montrer les informations potentiellement requises. Les cases de la table permettent d'ajouter des contrôles manuels ; elles ne désactivent pas les exigences lues dans `Columns`.

Pour chaque colonne, choisir :

- Un champ du catalogue maître corrigé.
- Un contenu Castorama, avec repli sur l'enrichissement commun.
- **Saisie Castorama pour ce produit**, pour une valeur spécifique : catégorie, contenance exacte en ml, EAN fourni, prix, stock, etc. Les suggestions de listes proviennent des cellules de référence du template, jamais d'autres produits. Les listes longues ne proposent que les 200 premières valeurs dans l'interface ; le contrôle utilise toute la liste prise en charge.
- **Ne pas renseigner**, uniquement si le champ est facultatif.

Après une saisie spécifique, vérifier la variante, cocher la confirmation et **Enregistrer les valeurs Castorama dans la fiche**. Ces valeurs restent propres au produit et à la signature de ce template ; elles ne deviennent pas des valeurs par défaut du mapping. Ni prix, ni stock, ni EAN, ni argument d'un produit déjà présent ne sont recopiés automatiquement.

Enregistrer un mapping nommé pour le réutiliser après réimport. Les profils sont compatibles avec la même feuille, ligne d'en-têtes, colonnes et attributs ; un changement nécessite vérification. La sauvegarde JSON des mappings contient leurs associations et règles, pas les valeurs commerciales des produits. Un import portant un nom de profil déjà utilisé est refusé pour éviter un remplacement silencieux.

## Contrôle et export

Le contrôle présente les valeurs finales et les erreurs : champs requis, EAN-13, nombres/stock, valeurs ressemblant à des formules, HTML non autorisé, listes et validations prises en charge, collisions de SKU/EAN dans la sélection et le fichier existant, destination occupée ou fusionnée, catégorie incohérente et variante non confirmée.

Le SKU déjà présent dans le template bloque l'ajout : le prototype ne modifie pas automatiquement l'ancienne ligne. Une mise à jour de lignes existantes avec comparaison et confirmation n'est pas un mode livré dans ce lot. Pour une création, utiliser un template approprié ou une copie vérifiée dont les lignes concernées ont été préparées par l'utilisateur. Le logiciel ne vide jamais les anciennes lignes à votre place.

L'export crée une copie, écrit seulement la nouvelle ligne et reprend les styles du modèle de données. Les autres lignes, feuilles, colonnes, largeurs, commentaires, formules existantes, listes et plages de validation sont conservés. La dimension de la feuille est ajustée pour inclure la nouvelle ligne ; aucune colonne ou ligne existante n'est déplacée. Les valeurs inconnues restent vides et les champs obligatoires empêchent l'export.

Ce prototype exporte une fiche à la fois. Les fonctionnalités V1 de sélection multiple, mapping et export Excel restent accessibles. Toute modification des données ou des paramètres invalide le contrôle précédent. Relire le fichier Excel avant import marketplace ; absence d'erreur détectée ne certifie pas son acceptation par Castorama.

## Sauvegardes, confidentialité et limites

Les fiches, sources originales, enrichissements et valeurs Castorama sont conservés dans la même base IndexedDB que V2. **Paramètres → Télécharger la sauvegarde JSON** les inclut. Les anciennes sauvegardes V2 restent lisibles, et les fiches sans dossier OneBase restent utilisables. Le parcours et les profils V1 sont conservés séparément.

Les sauvegardes catalogue contiennent vos données commerciales, y compris les liens copiés dans le texte original : conserver ces fichiers sur un emplacement autorisé, jamais dans GitHub. Le template importé reste en mémoire, pas dans le dépôt ou une base serveur. Les liens OneBase, images et documents ne sont ni suivis ni téléchargés. `connect-src 'none'` reste actif ; aucune télémétrie, aucun CDN, serveur, Supabase ou modèle IA. Les données d'une fiche ne sont partagées avec aucun autre appareil.

Limites : texte 200 000 caractères, fichier `.xlsx` standard 15 Mo, archive décompressée 60 Mo, 250 colonnes, écriture jusqu'à 20 000 lignes. Les feuilles de référence en lecture seule peuvent atteindre 100 000 lignes. Macros, signatures, fichiers chiffrés, Excel Strict, tableaux structurés ou feuille protégée ne sont pas pris en charge pour ce parcours. Les listes littérales, listes de cellules / plages nommées et validations numériques/longueur avec bornes fixes sont évaluées. Règles calculées, dates/heures, validations personnalisées ou étendues non évaluables bloquent l'export quand elles concernent une valeur à écrire. Aucune plage de validation originale n'est étendue automatiquement.

L'extraction est déterministe et dépend des libellés : les ambiguïtés sont signalées pour correction humaine. Aucune classe, méthode d'application, composition, couleur, rendement ou exigence réglementaire n'est déduite d'une promesse marketing. La classification par catégorie et les règles métier Castorama non présentes sous une forme prise en charge dans le template restent à vérifier.

## Stockage protégé et restauration V3.2

La nouvelle version conserve la base et bloque les écritures des anciens fichiers sur la même origine. La restauration du catalogue fonctionne désormais par fusion sans écrasement, avec prévisualisation. Le bouton **Paramètres · Sauvegardes** est accessible dans l’en-tête sur tablette. Voir `GUIDE-STOCKAGE-V3.2.md` pour les différences entre adresses/profils Chrome et la récupération des données.

## Extraction des rubriques collées et tableaux de variantes

Les rubriques explicitement marquées par des deux-points ou des astérisques sont séparées même sans espace entre le contenu et le libellé suivant. Le temps de prise dispose maintenant de son propre champ. Un passage sans délimitation identifiable reste à vérifier dans le texte original.

Les tableaux comportant des en-têtes **Désignation, EAN, SKU / Référence article / Code article** sont reconnus avec tabulations, points-virgules, barres verticales ou plusieurs espaces. La copie verticale (une cellule par ligne) est également reconnue. Les lignes doivent fournir des identifiants explicites valides ; un tableau ambigu reste à vérifier manuellement.

- Une seule ligne identifiable préremplit le SKU et l’EAN ; plusieurs lignes demandent de choisir une **Variante SKU / EAN du tableau**.
- Les **Conditionnements génériques** restent séparés du conditionnement de la variante. Le conditionnement sélectionné provient de sa colonne, ou d’une mention explicite dans la désignation de sa ligne.
- **Sac de 5 kg** donne type **sac** et poids **5**, mais ne suppose pas un nombre d’unités. **1 sac de 5 kg** fournit aussi le nombre **1**.
- **Voir le passage source** permet de vérifier chaque valeur proposée. Le texte original complet est conservé lors de l’enregistrement confirmé.

Changer de variante réinitialise les champs du formulaire depuis la source ; effectuer cette sélection avant vos corrections manuelles. Aucun produit existant n’est modifié par l’analyse ou la sélection seule. Prévisualiser les changements puis confirmer explicitement pour enregistrer. Les contenus enrichis, les réponses ChatGPT et les sauvegardes JSON restent disponibles.
