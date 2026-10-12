# V3.3 — Importer des fiches optimisées Excel

Aucun Python, aucune API IA et aucun serveur de données ne sont nécessaires. Ouvrir le HTML autonome dans Chrome, si la politique de l'appareil autorise les fichiers HTML locaux. GitHub Pages n'est pas mis à jour automatiquement. La compatibilité tactile et ordinateur est testée dans Chromium ; la recette sur une tablette physique Lenovo et un poste Windows reste à effectuer.

## Importer et confirmer

1. Sauvegarder le catalogue JSON dans **Paramètres**. Fermer les anciens onglets SEMIN : V3.3 protège le stockage contre les écritures des anciennes versions, sans changer les fiches lors de l'ouverture.
2. Ouvrir **Importer des fiches optimisées Excel**, choisir le fichier XLSX, sa feuille et la ligne des en-têtes (1 pour le modèle fourni).
3. Toucher **Analyser et prévisualiser l'import**. Chaque référence est identifiée uniquement par son SKU. Les EAN sont contrôlés avec leur clé et comparés au catalogue. SKU/EAN dupliqués, conflits d'identité et URL invalides bloquent les lignes concernées.
4. Examiner les créations, mises à jour, erreurs et informations manquantes. Ouvrir chaque ligne pour lire le texte complet et les différences. Les créations sont présélectionnées. Cocher explicitement les mises à jour voulues.
5. Cocher la validation humaine et **Confirmer l'import Excel optimisé**. Rien n'est enregistré avant cette étape. Un changement concurrent du catalogue impose une nouvelle prévisualisation.
6. Dans **Versions Excel confirmées**, choisir un SKU pour consulter les textes sources, les contenus cumulés et les valeurs du catalogue avant chaque import. Ces versions sont conservées dans les sauvegardes JSON ; maximum 100 versions par référence, sans suppression automatique.

Les cellules vides, y compris les cellules contenant seulement des espaces, ne remplacent jamais les valeurs du catalogue. Le stock zéro est une valeur explicite et peut mettre à jour le stock. Les titres, arguments et HTML non vides sont conservés intégralement, avec leurs retours à la ligne. Les sources OneBase, enrichissements et réponses ChatGPT ne sont pas modifiés. Les anciennes valeurs commerciales remplacées après confirmation restent consultables dans l'historique Excel.

## Les 20 colonnes, dans leur ordre

| Colonnes | Champ |
|---|---|
| A | Titre commercial optimisé, distinct de la désignation OneBase |
| B / C | EAN / SKU |
| D | PVC — valeur source sans règle de prix |
| E | Stock |
| F à K | MAIN, PT01, PT02, PT03, PT04, PT05 par position, même si PT01 est répété |
| L | Poids — valeur source Excel avec son unité |
| M | Conditionnement commercial |
| N | Pays d'origine |
| O à S | Arguments 1 à 5 par position |
| T | Description HTML intégrale |

La valeur **1** en M représente une unité de vente commerciale. Elle ne signifie jamais un sac, un article ou un élément dans le lot. **Contenu du lot** et **Poids total du lot** sont des attributs séparés, laissés vides tant qu'ils ne sont pas renseignés. Aucun calcul du poids total n'est fait depuis cette colonne.

PVC ne remplit jamais automatiquement Prix, Prix TTC ou Prix HT. Une règle de gestion validée serait nécessaire. Le poids source n'est pas converti automatiquement en poids total du lot ni en valeur numérique pour un template qui exige une unité spécifique ; vérifier l'unité et confirmer une saisie explicite si nécessaire.

Les six images sont facultatives. Des URL non vides doivent respecter les règles du module Visuels (HTTP/HTTPS, pas de lien d'administration OneBase). Leur import ne déclenche aucune demande d'image.

Le modèle ne fournit ni une colonne Marque ni une désignation technique OneBase distincte. Les nouvelles fiches peuvent donc être **À compléter** : elles existent et leurs textes sont préremplis, mais les informations absentes restent à renseigner ou à importer depuis OneBase. Aucun fait technique n'est déduit du titre marketing.

## Export et état neuf par canal

Le parcours **Castorama · Contrôle et export** permet désormais de choisir le **canal du template : Castorama, ADEO ou Amazon**. Il applique le même moteur local de conservation du classeur original. Importer le vrai template du canal, puis identifier ses colonnes.

Les sources **Excel optimisé validé** proposent le titre, l'HTML, les arguments, PVC, poids source, pays, conditionnement commercial et l'état par canal. Les URL et le stock sont également dans les attributs du catalogue. Vérifier les propositions et enregistrer un profil propre au canal. Les profils et saisies spécifiques des canaux sont séparés ; un ancien profil sans canal est considéré Castorama.

L'état est une donnée d'offre **neuve**, sans colonne supplémentaire dans le fichier source :

- Castorama : **Neuf**.
- ADEO : **Neuf**.
- Amazon : **Nouveau**.

Ces libellés ne sont pas supposés être les codes techniques officiels. Lorsqu'une liste de validation est présente dans le template, l'export vérifie qu'elle autorise la valeur. Une liste de codes comme `11` ou `new_new` ne sera pas remplie par une traduction inventée. Si les codes ne sont pas vérifiables dans le template, le mapping automatique d'état bloque l'export : choisir **Saisie Castorama pour ce produit** (libellé historique de la saisie spécifique), renseigner le code officiel après vérification et confirmer son enregistrement. Cette saisie est conservée séparément par canal et signature de template. Le contrôle Excel et la validation humaine avant export restent obligatoires.

Les templates officiels ADEO/Amazon n'étaient pas joints au développement. Les contrôles ont été testés sur des modèles fictifs avec listes autorisées, codes incompatibles et absence de liste. La conformité finale se vérifie avec le modèle réel importé ; aucun format officiel n'est simulé comme étant validé.

Pour le parcours Excel V1, les fichiers source et template restent indépendants du catalogue maître. Ce parcours existant est conservé ; l'import V3.3 et les sources Excel validées sont accessibles dans le parcours de catalogue et de templates ci-dessus.
