# 🐟 Boids

Une simulation interactive de comportement collectif en 3D basée sur le modèle des **Boids**, réalisée avec **Three.js** et **WebGPU**.

Les poissons évoluent de manière autonome en suivant trois règles principales : **séparation**, **alignement** et **cohésion**. Les différents paramètres de la simulation peuvent être modifiés en temps réel afin d'observer leur influence sur le comportement du groupe.

## ✨ Fonctionnalités

- Simulation de banc de poissons en 3D
- Séparation, alignement et cohésion entre les individus
- Cône et rayon de perception configurables
- Évitement progressif des limites de la zone de simulation
- Modification en temps réel de la population, des vitesses et des comportements
- Attraction et répulsion des poissons avec la souris
- Interface de contrôle intégrée
- Chargement d'un modèle 3D GLB, GLTF ou FBX

## 🖱️ Interactions

- **Clic gauche** : repousse les poissons
- **Clic droit** : attire les poissons
- **⚙️** : affiche ou masque les paramètres de la simulation

Les paramètres permettent notamment d'ajuster la population, la vitesse, la perception, les règles de flocking et l'intensité des interactions.

## 🛠️ Technologies

- HTML
- CSS
- JavaScript
- Three.js
- WebGPU

Aucun framework ni processus de build n'est nécessaire.

## 🚀 Lancer le projet

Le projet étant entièrement statique, il peut être servi directement depuis un serveur web.

Les dépendances Three.js sont chargées depuis un CDN.

```text
index.html
css/
js/
assets/
```

Le fichier `assets/fish.glb` contient le modèle 3D utilisé pour représenter les poissons.

## 💡 À propos

Ce projet a été réalisé afin d'expérimenter les comportements émergents et la simulation de groupes autonomes dans un environnement 3D interactif.