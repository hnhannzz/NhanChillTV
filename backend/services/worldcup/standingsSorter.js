function standingNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function sortStandings(rows) {
  return [...rows].sort((a, b) => (
    standingNumber(b.pts) - standingNumber(a.pts)
    || standingNumber(b.gd) - standingNumber(a.gd)
    || standingNumber(b.gf) - standingNumber(a.gf)
    || standingNumber(a.ga) - standingNumber(b.ga)
    || String(a.team_name_vi || '').localeCompare(String(b.team_name_vi || ''), 'vi')
  )).map((row, index) => ({ ...row, rank: index + 1 }));
}

module.exports = {
  standingNumber,
  sortStandings,
};
