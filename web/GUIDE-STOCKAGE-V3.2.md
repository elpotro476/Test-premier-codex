# V3.2 — Stockage protégé, sauvegarde et fusion

## Trouver Paramètres

Le bouton **Paramètres · Sauvegardes**, placé dans l'en-tête, fonctionne sur tablette en portrait et en paysage. Le menu latéral reste disponible et peut défiler sur les écrans courts. Les boutons ont une taille adaptée au toucher.

Dans Paramètres, le diagnostic affiche l'adresse de l'application, l'origine, la base locale, sa version, le nombre de fiches enregistrées et la révision. **Actualiser le diagnostic** relit ces informations ; ce bouton ne change aucun produit. Une erreur de stockage est signalée, jamais remplacée par une initialisation fictive. Les compteurs restent indéterminés tant que le catalogue n'est pas chargé.

## Où sont mes données ?

Les fiches, les textes OneBase originaux et les versions ChatGPT sont dans IndexedDB, base `semin-marketplace-studio`, magasin `workspace`, clé `catalogue`. Les mappings V1 et Castorama sont séparés dans localStorage et disposent de leurs propres sauvegardes. Les templates Excel restent en mémoire jusqu'à leur export.

Le catalogue appartient à l'origine et au profil Chrome utilisés. En HTTP/HTTPS, le protocole, le domaine et le port définissent cette origine ; changer seulement le chemin sur la même origine ne crée pas un autre catalogue. Un fichier HTML local (`file://`) relève du fonctionnement particulier de Chrome et des règles de votre poste : ne présumez pas que toutes les copies partagent le même stockage. Une ouverture depuis un gestionnaire Android peut également employer une autre adresse.

Windows, Android et deux profils Chrome ne partagent pas automatiquement leurs catalogues. La connexion à un compte Chrome ne synchronise pas cette base métier. Le mode privé et l'effacement des données du navigateur peuvent perdre les données. Une fermeture normale du navigateur conserve le catalogue d'un profil habituel ; une sauvegarde JSON reste nécessaire pour le retrouver après une suppression du profil ou un changement d'adresse.

Les cas produits testés par l'équipe dans des navigateurs temporaires ne sont jamais ajoutés à votre navigateur. Les exemples fictifs nécessitent une importation volontaire et confirmée. Aucun exemple n'est enregistré au démarrage.

## Protection des versions

Cette version ouvre la **base IndexedDB en version 2**, en conservant le magasin et toutes les données existantes. Cette version de base est distincte du schéma JSON, qui reste compatible avec les sauvegardes précédentes.

Les anciennes V3.1/V3.2 qui demandent la base en version 1 ne peuvent plus l'ouvrir pour écrire. Une ancienne fenêtre déjà ouverte ferme sa connexion lors du changement de version ; ses enregistrements suivants échouent. Utiliser exclusivement la nouvelle application pour éditer ce catalogue. En cas de blocage, fermer les autres onglets SEMIN et rouvrir la nouvelle application ; ne pas effacer les données Chrome.

Cette protection concerne la **même base sur la même origine et le même profil**. Une copie ouverte sur une autre origine a son propre catalogue, qu'elle peut toujours modifier sans affecter celui-ci. Aucune ancienne copie ou donnée n'est supprimée automatiquement.

## Sauvegarder

1. Ouvrir **Paramètres · Sauvegardes**.
2. Cliquer sur **Télécharger la sauvegarde JSON**.
3. Conserver `semin-catalogue-maitre.json` dans un emplacement autorisé, hors de GitHub.

Le téléchargement relit le catalogue réellement enregistré, y compris les modifications d'un autre onglet. Il inclut les fiches, les sources OneBase originales, les enrichissements, les contenus Castorama et les historiques ChatGPT. Il ne contient pas les fichiers Excel importés ni les profils de mapping séparés.

Avant de changer de fichier HTML, de profil Chrome ou d'appareil, sauvegarder depuis la copie qui contient vos produits. Conserver cette sauvegarde avant toute fusion. Ce fichier contient des données commerciales et parfois des liens privés issus des sources : ne pas le publier.

## Restaurer par fusion, sans écrasement

1. Choisir une sauvegarde JSON depuis Paramètres (maximum 20 Mo).
2. Examiner la prévisualisation : **Ajout**, **Identique** ou **Conflit**. Le détail affiche jusqu'à 200 lignes ; les totaux et la fusion concernent toutes les lignes prises en charge.
3. Cocher la confirmation puis cliquer sur **Fusionner sans écraser**.

Toutes les fiches locales, leurs identifiants et leurs sources restent inchangés. Les nouvelles fiches sans conflit sont ajoutées avec leur contenu original. Les attributs nouveaux sont conservés, les définitions existantes ne sont jamais remplacées. Une nouvelle règle d'attribut requis peut changer l'indication de complétude, sans changer les valeurs des produits.

Un SKU, EAN ou identifiant déjà utilisé garde la fiche locale. Un attribut portant le même identifiant avec une définition différente bloque les nouvelles fiches concernées. Les doublons internes de SKU/EAN dans la sauvegarde ne sont pas choisis arbitrairement. Les réponses ChatGPT d'une fiche en conflit ne remplacent pas ses versions locales : elles restent disponibles dans le fichier de sauvegarde, à conserver pour une comparaison manuelle.

La fusion ne supprime ni les produits absents de la sauvegarde ni les contenus existants. L’historique local des opérations n’est pas remplacé par celui de la sauvegarde ; s’il atteint sa limite de 100 opérations, la fusion n’en supprime aucune pour ajouter une entrée. Le remplacement global a été retiré du parcours. Une sauvegarde invalide, une limite dépassée ou une modification du catalogue depuis la prévisualisation annule l'opération. L'enregistrement utilise une transaction atomique : les données précédentes restent en place si l'écriture échoue.

Le diagnostic ne peut pas rechercher dans d'autres profils ou adresses Chrome. Pour réunir des catalogues, télécharger une sauvegarde depuis chacune des copies accessibles puis les fusionner ici, avec vérification des conflits.

## Validation technique

Les tests utilisent uniquement des données fictives et des profils temporaires. Ils vérifient la migration sans modification des enregistrements, le refus d'une ouverture en ancienne version, le téléchargement à jour après une écriture dans un autre onglet, la fusion et les conflits, l'accès tactile aux Paramètres, ainsi que la fermeture complète et la réouverture d'un navigateur avec le même profil. Un second test confirme la séparation des origines.

Les tests de fichiers `file://` ne sont pas exécutés dans l'environnement cloud, qui bloque cette navigation. Le test automatisé de persistance utilise une adresse HTTP locale stable ; aucune donnée n'est envoyée à un service externe.
