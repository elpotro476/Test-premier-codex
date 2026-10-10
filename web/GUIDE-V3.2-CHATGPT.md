# V3.2 — Préparer pour ChatGPT et importer une réponse

Le fichier `SEMIN-Marketplace.html` reste autonome, en français, utilisable dans Chrome. Aucun abonnement API, clé, serveur IA ou Supabase n'est nécessaire pour ce parcours. Le site GitHub Pages n'est pas mis à jour automatiquement.

## Préparer une consigne

1. Enregistrer ou sélectionner une fiche OneBase dans le catalogue maître. Le SKU commercial doit être identifié : une référence OneBase ne le remplace pas.
2. Ouvrir **Contenus ChatGPT · SEO / GEO**, choisir le produit et **Amazon**, **Castorama** ou **ManoMano**.
3. Cliquer sur **Préparer pour ChatGPT**, relire la consigne et les données, puis **Copier la consigne**.
4. Coller volontairement dans ChatGPT, dans un contexte autorisé pour vos données. L'application ne transmet rien ; ce collage dans un service externe partage les informations copiées avec ce service. Les liens du texte brut sont retirés dans la copie ; les sources dans le catalogue restent intactes. Si la copie automatique est interdite par Chrome, sélectionner le texte puis utiliser Copier.

La consigne distingue les valeurs extraites et les champs corrigés du catalogue. Elle demande un titre SEO, une description HTML, cinq arguments factuels, des mots-clés et des FAQ GEO. Elle interdit d'inventer des informations et demande de signaler les ambiguïtés et inconnues. Elle ne garantit ni la qualité de la réponse ni sa conformité aux règles évolutives des marketplaces. Les prix et stocks du catalogue ne sont pas inclus dans les champs corrigés transmis à la consigne ; relire le texte source, qui peut contenir d'autres informations commerciales.

## Importer et valider

Coller **uniquement un objet JSON strict**, sans bloc de code Markdown ni commentaire. Le schéma figurant dans la consigne est obligatoire :

```json
{
  "schemaVersion": 1,
  "marketplace": "Castorama",
  "sku": "FICTIF-001",
  "titleSeo": "Titre fictif à vérifier",
  "descriptionHtml": "<p>Description fictive à vérifier.</p>",
  "arguments": ["Fait fictif 1", "Fait fictif 2", "Fait fictif 3", "Fait fictif 4", "Fait fictif 5"],
  "keywords": ["mot-clé fictif"],
  "faqGeo": [{"question": "Question fictive ?", "answer": "Réponse fictive à vérifier."}],
  "missingFields": []
}
```

Cliquer sur **Prévisualiser la réponse JSON**. Les champs sont répartis dans le titre, le HTML, les cinq arguments, les mots-clés et les paires question/réponse. Le HTML est affiché comme texte et jamais exécuté. Pour une correction, modifier le JSON puis relancer la prévisualisation. Les contenus précédents restent consultables au-dessous, par version et marketplace.

La réponse est refusée si elle contient un mauvais SKU ou une autre marketplace, des clés inconnues, des champs absents ou vides, des types incorrects, un nombre d'arguments différent de cinq ou du HTML non autorisé. Les FAQ exigent 1 à 10 réponses ; les mots-clés 1 à 50 textes. La réponse JSON est limitée à 200 000 caractères. Des arguments non justifiables doivent rester vides dans la réponse ChatGPT : ils sont signalés et empêchent l'enregistrement, plutôt que d'être inventés pour remplir le formulaire.

`missingFields` indique les informations sources non disponibles ou contradictoires. Ces avertissements doivent être relus même si les contenus sont structurellement valides. Un contrôle JSON ne vérifie pas la vérité des affirmations : comparer chaque fait au texte OneBase avant de cocher la **validation humaine**, puis enregistrer.

## Conservation et export

Chaque validation ajoute une version indépendante dans le dossier produit pour la marketplace choisie. Les sources OneBase, les champs corrigés, les enrichissements communs et les personnalisations Castorama V3.1 restent inchangés. Jusqu'à 20 versions par marketplace sont conservées ; au-delà, l'ajout est refusé et aucune ancienne version n'est supprimée automatiquement. Les sauvegardes JSON du catalogue incluent ces contenus ; les anciennes sauvegardes restent utilisables. Sauvegarder le catalogue avant de remplacer le fichier HTML local, car le stockage dépend du navigateur et de son origine.

Dans le mapping Castorama, choisir explicitement les champs **ChatGPT validé · Castorama · titleSeo**, **descriptionHtml**, **argument1…5**, **keywords** ou **faqGeo**. Le mapping V3.1 reste disponible et n'est pas remplacé automatiquement. Les mots-clés sont exportés comme texte séparé par des virgules et les FAQ comme JSON ; vérifier le format accepté par la colonne cible. Une réponse d'un ancien SKU reste dans l'historique mais n'est pas exportée pour un SKU modifié.

Les contrôles habituels Excel restent obligatoires : champs requis, EAN, listes, doublons et structure du template. Après un contrôle réussi, cocher **J'ai relu les valeurs contrôlées et je valide cet export**. Sans cette confirmation, le bouton d'export reste désactivé. Une modification ou un nouveau contrôle annule cette confirmation. Cette validation humaine est également requise pour les exports V1.

Amazon et ManoMano disposent ici de la préparation et de l'import de contenus, pas de nouveaux moteurs de templates dédiés. Les fonctionnalités V1 de mapping générique restent accessibles. Rien n'est envoyé automatiquement à ces marketplaces ou à ChatGPT.

## Tests de développement

```sh
node web/build.mjs
python -m unittest discover -s web/tests -v
```

Python, Playwright et Chromium sont nécessaires pour les tests de développement uniquement. Les exemples et fixtures publiés sont fictifs ; les fichiers commerciaux restent locaux.
