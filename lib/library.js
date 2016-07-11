var _ = require('lodash');

function zipper (r) {
    return r.length ? _.map(r[0].values, _.zipObject.bind(_, r[0].columns)) : [];
}


/**
 * Manages the indexed library content
 * @param sqliteHelper {sqlite-helper}
 * @returns {library}
 */
function library(sqliteHelper) {
    const query = sqliteHelper.query;
    const run = sqliteHelper.run;
    const save = sqliteHelper.save;

    /**
     * Inserts or updates a source language in the library
     * @param language
     * @returns int the id of the source language row
     */
    this.addSourceLanguage = function(language) {
        run('insert or ignore into source_language ' +
            '(slug, name, direction)' +
            ' values ("' + language.slug + '", "' + language.name + '", "' + language.dir + '");' +
            'update source_language set name="' + language.name + '", direction="' + language.dir + '" where slug="' +
            language.slug + '"');
        save();
        var result = zipper(query('select id from source_language where slug="' + language.slug + '"'));
        if(result.length > 0) {
            return result[0].id;
        }
        return -1;
    };

    /**
     * Inserts or updates a project in the library
     * @param project
     * @param source_language_id the parent source language row id
     * @returns int the id of the project row
     */
    this.addProject = function(project, source_language_id) {
        run('insert or ignore into project ' +
            '(slug, name, desc, icon, sort, chunks_url, source_language_id)' +
            ' values ("' + project.slug + '", "' + project.name + '", "' + (project.desc || '') + '", "' +
            (project.icon || 'NULL') + '", ' + project.sort + ', "' + (project.chunks_url || 'NULL') + '", ' +
            source_language_id + ');' +
            'update project set name="' + project.name + '", desc="' + (project.desc || '') + '", icon="' +
            (project.icon || 'NULL') + '", sort=' + project.sort + ', chunks_url="' + (project.chunks_url || 'NULL') +
            '" where slug="' + project.slug + '" and source_language_id=' + source_language_id + ';');
        if(project.categories) {
            // TODO: add categories
        }
        save();
        var result = zipper(query('select id from project where slug="' + project.slug + '" and source_language_id=' +
            source_language_id));
        if(result.length > 0) {
            return result[0].id;
        }
        return -1;
    };

    /**
     * Inserts or updates a resource in the library
     * @param resource
     * @param project_id the parent project row id
     * @returns int the id of the resource row
     */
    this.addResource = function(resource, project_id) {
        run('insert or ignore into resource ' +
            '(slug, name, translate_mode, checking_level, comments, pub_date, license, version, project_id)' +
            ' values ("' + resource.slug + '", "' + resource.name + '", "' + resource.translate_mode + '", "' +
            resource.status.checking_level + '", "' + (resource.status.comments || '') + '", "' +
            (resource.status.pub_date || 'NULL') + '", "' + resource.status.license + '", "' + resource.status.version +
            '", ' + project_id + ');' +
            'update resource set name="' + resource.name + '", translate_mode="' + resource.translate_mode +
            '", checking_level="' + resource.status.checking_level + '", comments="' +
            (resource.status.comments || '') + '", pub_date="' + (resource.status.pub_date || 'NULL') +
            '", license="' + resource.status.license + '", version="' + resource.status.version +
            '" where slug="' + resource.slug + '" and project_id=' + project_id + ';');
        save();
        var result = zipper(query('select id from resource where slug="' + resource.slug + '" and project_id=' +
            project_id));
        if(result.length > 0) {
            return result[0].id;
        }
        return -1;
    };
    
    this.getters = {
        /**
         * Returns a source language that matches the slug
         * @param slug
         * @return {json} the language object or null if it does not exist
         */
        getSourceLanguage: function(slug) {
            var result =  zipper(query('select * from source_language where slug="' + slug + '" limit 1'));
            if(result.length > 0) {
                return result[0];
            }
            return null;
        },
    
        /**
         * Returns a list of every source language
         * @return [json]
         */
        getSourceLanguages: function() {
            return zipper(query('select * from source_language order by slug desc'));
        }
    };
    
    return this;
}

module.exports = library;