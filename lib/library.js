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

    this.addSourceLanguage = function(language) {
        // query('insert into source_language (slug, project_id, name, project_name, project_description, direction,' +
        //     ' modified_at, resource_catalog_server_modified_at, resoure_catalog_url)' +
        //     ' values ("' + language.language.slug + '", "' + language.language.slug + '", )')
    };

    this.addResource = function(resource) {
        // console.log(resource);
    };

    this.addProject = function(project) {
        // TODO: update if exists otherwise insert
        query('insert into project ' +
            '(slug, sort, modified_at, source_language_catalog_url, source_language_catalog_local_modified_at, source_language_catalog_server_modified_at)' +
            ' values ("' + project.slug + '", "' + project.sort + '", ' + project.date_modified + ', "' + project.lang_catalog + '", 0, 0)');
        if(project.meta) {
            // TODO: add categories
        }
        save();
    };
    
    return this;
}

function zipper (r) {
    return r.length ? _.map(r[0].values, _.zipObject.bind(_, r[0].columns)) : [];
}

module.exports = library;