# A Génépi Story

Jeu d'horreur psychologique 2D top-down en HTML/CSS/JavaScript vanilla.

## Lancer

Ouvrez simplement `index.html` dans un navigateur moderne.

## Contrôles

- `WASD` ou `Flèches`: déplacement
- `E`: interaction (maintenir brièvement)
- `Shift`: sprint léger
- `T`: utiliser talisman (si disponible)
- `P`: pause
- `M`: mute
- `R`: recommencer après mort

## Structure

- `index.html`: structure globale + overlays
- `styles.css`: style sombre, HUD, menus
- `js/entities.js`: classes Player, Genepi, Ariel, Noa, Yardena
- `js/audio.js`: AudioManager Web Audio API
- `js/ui.js`: gestion HUD / overlays / alertes
- `js/game.js`: boucle principale, IA, scheduler, stress, rendu canvas
- `js/main.js`: bootstrap et binding des boutons
