# SEMIN Marketplace — Version navigateur

Cette version fonctionne dans Chrome avec des fichiers `.xlsx`. Elle ne nécessite ni Python, ni exécutable, ni application Android. Le projet Windows reste disponible séparément.

## Comment tester

### Avec un lien HTTPS (recommandé sur Lenovo Android)

L’interface statique n’est **pas publiée automatiquement**. L’accord du propriétaire est nécessaire avant publication. Un hébergement sert uniquement l’interface ; les fichiers Excel sont lus et remplis dans Chrome, sans API serveur.

Après publication autorisée, ouvrez le lien fourni dans Chrome, puis touchez **Charger la démonstration**. Vous pouvez ajouter un raccourci à l’écran d’accueil depuis le menu Chrome. Ce raccourci n’installe ni Python ni `.exe` ; il ouvre la page web. Cette première version ne comporte pas de service worker : l’accès au lien nécessite Internet pour charger la page. Une fois chargée, toutes les opérations Excel restent locales.

### Avec le fichier HTML autonome (sans hébergement)

1. Dans GitHub, ouvrez Actions → **Version navigateur**, puis la dernière exécution réussie.
2. Dans Artifacts, téléchargez **SEMIN-Marketplace-Navigateur**. Connectez-vous à GitHub si demandé.
3. Extrayez l’archive puis le ZIP de l’application qu’elle contient.
4. Ouvrez **SEMIN-Marketplace.html** dans Chrome. Sous Windows, un clic droit → Ouvrir avec → Google Chrome suffit.
5. Sous Android, cherchez le fichier dans Téléchargements / l’application Fichiers et choisissez Chrome si cette option est proposée.

Certains appareils Android ou politiques d’entreprise interdisent l’ouverture de HTML local ou ne proposent pas Chrome comme application d’ouverture. Ce mode n’est donc pas garanti sur votre Lenovo. Dans ce cas, utilisez le lien HTTPS après publication autorisée ; ne désactivez pas les protections du poste. Le fonctionnement tactile a été testé dans Chromium avec une tablette émulée, pas sur une Lenovo physique.

Le fichier HTML contient déjà tous les scripts, styles et données fictives de démonstration. Il n’utilise aucun CDN. Son fonctionnement ne nécessite aucun logiciel supplémentaire quand Chrome autorise son ouverture.

## Parcours de démonstration

1. Touchez **Charger la démonstration** : trois produits fictifs sont chargés.
2. Le troisième produit comporte volontairement trois erreurs et l’export est bloqué.
3. Décochez DEMO-003 et touchez **Contrôler les données**.
4. Téléchargez le fichier Excel des deux produits valides. Retrouvez-le dans Téléchargements.

## Utiliser vos fichiers

1. Touchez **Catalogue produits** et choisissez votre fichier `.xlsx` dans le sélecteur Android ou Windows.
2. Importez de même le template marketplace vierge.
3. Choisissez les feuilles, les lignes des en-têtes et la première ligne vierge destinée aux produits.
4. Touchez **Analyser les fichiers**. Recherchez un SKU ou EAN et cochez les produits.
5. Vérifiez les suggestions de correspondance. Modifiez les listes et les champs obligatoires selon la documentation de la marketplace.
6. Donnez un nom à la marketplace, puis enregistrez les correspondances.
7. Contrôlez les données. Si des valeurs manquent, corrigez le catalogue source puis réimportez-le : l’application n’invente rien.
8. Téléchargez le résultat Excel et vérifiez-le avant import marketplace.

Sur tablette, les tableaux se font défiler horizontalement ; les sélecteurs, boutons et cases sont adaptés au tactile. L’aperçu affiche au maximum 200 produits. « Sélectionner les résultats » sélectionne tous les résultats filtrés.

## Correspondances entre utilisations et appareils

Les profils sont sauvegardés dans le stockage local de Chrome pour cette page et cet appareil. Aucune donnée produit n’est enregistrée dans ce stockage. Les fichiers importés restent en mémoire et disparaissent lors d’un rechargement ou de la fermeture de l’onglet.

- Après réimportation et analyse, sélectionnez votre profil dans **Correspondance enregistrée**.
- Les noms et positions des colonnes doivent correspondre au profil.
- Touchez **Sauvegarder les profils JSON** pour conserver une copie ou la transférer vers un autre appareil.
- Sur l’autre appareil, utilisez **Importer des profils JSON**. Les profils de même nom sont remplacés ; les autres sont conservés.
- Le stockage peut être effacé par Chrome, la navigation privée ou votre politique d’entreprise. Sauvegardez le JSON régulièrement.
- La version Windows `.exe`, le fichier HTML et une future page HTTPS ont des stockages séparés. Les profils de la version navigateur ne se synchronisent pas automatiquement avec la version Windows `.exe`.

## Confidentialité

Le moteur Excel s’exécute uniquement dans Chrome. Il n’envoie ni fichiers, ni valeurs produits, ni correspondances à une API. Le document applique `connect-src 'none'`, interdisant les connexions réseau des scripts. Aucun script tiers, publicité, télémétrie ou CDN n’est chargé.

Avec un hébergement, le serveur reçoit uniquement la requête qui télécharge l’interface (et les informations habituelles de connexion). Le traitement des catalogues ne lui est pas transmis. L’hébergement ne doit servir que les fichiers applicatifs et les exemples fictifs : **ne mettez aucun catalogue, template commercial ou profil utilisateur dans GitHub**.

Les téléchargements sont enregistrés dans le dossier choisi par Chrome. Les extensions, la synchronisation de dossiers et les logiciels d’entreprise ne sont pas contrôlés par cette application.

## Préservation Excel et limites

Le moteur conserve l’archive Excel originale et modifie seulement le XML de la feuille cible dans une copie. Les autres feuilles et parties du classeur (styles, commentaires, images, relations...) conservent leurs contenus. Les styles de la première ligne de données sont utilisés pour les nouvelles cellules, et les validations de cette ligne sont étendues si nécessaire. Les cellules déjà remplies ou fusionnées ne sont pas écrasées.

- `.xlsx` standard uniquement, sans macros ni signature numérique ; `.xls`, `.xlsm`, fichiers chiffrés et Excel Strict non pris en charge.
- Limites pour tablette : 15 Mo par fichier, 60 Mo décompressés, 20 000 lignes et 250 colonnes par feuille.
- Les tableaux Excel structurés sur la feuille de destination sont refusés dans cette première version.
- Les validations et formules existantes sont préservées mais toutes les règles propres aux marketplaces ne sont pas évaluées. Les formules du catalogue doivent être remplacées par des valeurs.
- Les zones de destination doivent être vierges. Les plages des tableaux, plages nommées et zones d’impression ne sont pas étendues automatiquement.
- Les champs requis sont suggérés par les astérisques des en-têtes ou leurs commentaires, puis restent modifiables. Les exigences conditionnelles d’une marketplace nécessitent une vérification humaine.
- Contrôles : champs requis, EAN-13, doublons SKU/EAN, prix/poids non négatifs, stock entier non négatif et valeurs ambiguës ressemblant à des formules.
- Les SKU/EAN textuels restent des chaînes. Les zéros initiaux sont aussi repris pour un format numérique composé de zéros ; les chiffres déjà perdus par Excel ne peuvent pas être recréés. Les autres dates numériques sont copiées sous forme de valeurs Excel ; leur affichage dépend du format du template.

Testez un export sur une copie de chaque template réel avant utilisation commerciale. La conservation des parties du classeur ne signifie pas que toutes les fonctionnalités avancées de tous les templates ont été validées.

## Pour la maintenance seulement

Le code web est séparé dans `web/`. Les utilisateurs n’ont rien à compiler. Pour reconstruire le fichier HTML :

```sh
node web/build.mjs
```

Les tests utilisent uniquement les données fictives embarquées et un serveur statique local de test, sans backend applicatif :

```sh
python -m pip install -r requirements.txt playwright==1.62.0
python -m playwright install chromium
python -m unittest discover -s web/tests -v
```

JSZip 3.10.1 est embarqué localement sous licence MIT (voir `vendor/LICENSE-JSZip.txt`).

Pour publier **après accord explicite** du propriétaire : dans Settings → Pages du dépôt,
choisir Source → GitHub Actions. Ensuite, ouvrir Actions → « Publier la version navigateur », puis Run workflow. L’accord de publication
a été donné par le propriétaire le 9 octobre 2026 ; aucune nouvelle confirmation en chat n’est nécessaire. Ce workflow est manuel uniquement ;
aucun push de code n’héberge automatiquement l’application. Il publie seulement le HTML
applicatif et la licence, jamais les fichiers Excel, les profils ou les tests. L’URL effective
est fournie par le résultat du déploiement GitHub, à vérifier avant de la partager.

Le workflow vérifie aussi que la page HTTPS servie est identique à la page auditée et exécute les tests tactiles directement sur ce site avec les seuls exemples fictifs.
