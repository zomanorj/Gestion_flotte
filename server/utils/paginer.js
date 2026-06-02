/**
 * Extrait les paramètres de pagination depuis req.query.
 * Si paginate=true est absent, la pagination est désactivée (backward compat).
 *
 * Usage :
 *   const pg = paginer(req);
 *   if (pg.actif) {
 *     query += ' LIMIT ? OFFSET ?';
 *     params.push(pg.limit, pg.offset);
 *     // + COUNT séparé puis retourner pg.reponse(rows, total)
 *   }
 */
const paginer = (req) => {
  const actif  = req.query.paginate === 'true';
  const page   = Math.max(1, parseInt(req.query.page)  || 1);
  const limite = Math.min(200, Math.max(1, parseInt(req.query.limit) || 20));
  const offset = (page - 1) * limite;

  const reponse = (rows, total) => ({
    data:  rows,
    total: parseInt(total),
    page,
    pages: Math.ceil(total / limite),
    limit: limite
  });

  return { actif, page, limit: limite, offset, reponse };
};

module.exports = paginer;
