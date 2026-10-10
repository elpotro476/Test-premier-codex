# Visuels produits par URL

Aucun hébergement, import de fichier image ou stockage d'image n'est fourni. Seules les URL sont enregistrées dans le catalogue et les sauvegardes JSON. Chrome peut gérer son propre cache réseau pour les aperçus.

1. Dans **Visuels · URL**, choisir une référence SKU déjà enregistrée.
2. Coller les adresses HTTP/HTTPS dans MAIN (image principale), PT01 à PT05. **Ajouter un emplacement** permet d'aller jusqu'à PT99.
3. Pour un lot, coller une URL par ligne : la première va dans MAIN, puis PT01, PT02… Ou préciser les emplacements : `MAIN: https://example.invalid/produit.jpg` et `PT07: https://example.invalid/detail.jpg`, sur des lignes séparées. Relire le formulaire : le lot ne sauvegarde rien immédiatement.
4. **Afficher / contrôler** charge seulement l'image de l'emplacement demandé. Une image chargée prouve qu'elle s'affiche dans votre navigateur ; elle ne garantit pas son accès public depuis une marketplace. Un échec peut venir d'une restriction, du réseau ou du serveur : le contrôle reste non concluant. Les liens d'administration OneBase sont refusés ; obtenir une véritable URL publique, sans identifiants de connexion.
5. **Monter**, **Descendre** ou **Définir comme principale** réorganisent les URL. Les modifications restent locales au formulaire.
6. Pour partager les mêmes visuels, sélectionner d'autres SKU dans **Réutiliser également sur ces SKU**. Les emplacements affichés seront remplacés sur ces fiches, même lorsqu'une valeur est vide ; les emplacements non affichés sont conservés. Sur tablette, utiliser les options de sélection multiple proposées par Chrome.
7. **Prévisualiser les modifications**, relire les références et les anciennes/nouvelles valeurs, puis cocher la confirmation et **Enregistrer les URL**. Les sources OneBase et contenus SEO/GEO sont conservés. Si le catalogue a changé entre-temps, choisir à nouveau le SKU et reprendre la vérification.
8. Les champs **Visuel MAIN · URL**, **Visuel PT01 · URL**, etc., sont disponibles comme sources dans le mapping Castorama. Les libellés usuels MAIN/PT01, main_image_url/other_image_url1 et image_url_1/image_url_2 sont proposés automatiquement ; toujours vérifier le modèle spécifique et enregistrer le mapping. Les URL invalides et les liens d'administration sont refusés dans les colonnes de visuels reconnues avant export. Aucun lien n'est téléchargé pour fabriquer le fichier Excel.

Le parcours Excel V1 peut aussi utiliser ces colonnes d'URL depuis un catalogue Excel importé. Il ne lit pas automatiquement le catalogue maître ; le parcours Castorama utilise directement les fiches enregistrées. Pour une colonne inhabituelle, sélectionner manuellement la bonne source et vérifier ses exigences dans le template. Les cellules et contraintes Excel restent gérées par les moteurs existants.

Les sauvegardes JSON et restaurations par fusion conservent les URL. Sauvegarder dans **Paramètres** avant de changer d'appareil ou d'adresse de l'application. Les anciennes fiches ne reçoivent aucun visuel automatique. Un lot fictif n'est jamais importé automatiquement.

Les aperçus nécessitent le réseau : le serveur reçoit la demande d'image et l'adresse IP de votre connexion, avec les paramètres déjà présents dans l'URL. Studio supprime le référent de ces demandes. Il n'envoie ni catalogue, ni Excel, ni SKU supplémentaire au serveur et ne fait aucun appel API de contrôle. Préférer des URL publiques durables ; les liens signés peuvent expirer. Les autres fonctions continuent de fonctionner localement, y compris sans réseau.
