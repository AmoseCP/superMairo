/**
 * Shared "use real art if it exists, otherwise keep the procedural
 * placeholder shape" helper — see src/config/assets.js + ART.md. Every
 * entity that supports art swap follows the same shape:
 *
 *   const art = tryArtSprite(scene, x, y, PLAYER_ART.bunny, width, height)
 *   if (art) { this.artSprite = art; this.rect.setVisible(false) }
 *
 * The physics/collision body (`this.rect`) never changes — only what's
 * drawn on top of it does. This means swapping in real art can never affect
 * hitboxes, jump arcs, or any of the physics tuning already in place.
 */
export function tryArtSprite(scene, x, y, artConfig, hitboxWidth, hitboxHeight) {
  if (!artConfig || !scene.textures.exists(artConfig.key)) return null
  const scale = artConfig.scale ?? 1
  return scene.add.image(x, y, artConfig.key).setDisplaySize(hitboxWidth * scale, hitboxHeight * scale)
}
