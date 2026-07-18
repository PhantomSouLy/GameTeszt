// Warrior Cherry Whirlwind VFX rendering order
// Frame: 192x192, anchor: (96, 112), 8 frames at 16 FPS.

function drawWarriorWhirlwind(ctx, player, backImage, frontImage, frame) {
  const sx = frame * 192;
  const dx = Math.round(player.x - 96);
  const dy = Math.round(player.y - 112);

  // 1. VFX behind Cherry
  ctx.drawImage(backImage, sx, 0, 192, 192, dx, dy, 192, 192);

  // 2. Draw Cherry here
  drawPlayer(ctx, player);

  // 3. Sparse lower rim and sparks in front of Cherry
  ctx.drawImage(frontImage, sx, 0, 192, 192, dx, dy, 192, 192);
}
