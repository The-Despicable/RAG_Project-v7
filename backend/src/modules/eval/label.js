export function labelData(rows) {
  return rows.map((row) => {
    const good = (row.match >= 0.6) && (row.refusalAccuracy === 1);

    return {
      ...row,
      label: good ? 1 : 0
    };
  });
}
