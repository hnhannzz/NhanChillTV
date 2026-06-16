export function shouldRenderWorldCupPlayer(match) {
  return Boolean(match && !match.isFinished);
}
