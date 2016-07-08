var _ = require('lodash');

/**
 * Manages the indexed library content
 * @param sqliteHelper {sqlite-helper}
 * @returns {library}
 */
function library(sqliteHelper) {
    var query = sqliteHelper.query;
    var save = sqliteHelper.save;
    
    // TODO: methods for adding content
    
    return this;
}

function zipper (r) {
    return r.length ? _.map(r[0].values, _.zipObject.bind(_, r[0].columns)) : [];
}

module.exports = library;