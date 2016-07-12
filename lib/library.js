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
            (resource.status.pub_date || 'NULL') + '", "' + (resource.status.license || 'NULL') + '", "' + resource.status.version +
            '", ' + project_id + ');' +
            'update resource set name="' + resource.name + '", translate_mode="' + resource.translate_mode +
            '", checking_level="' + resource.status.checking_level + '", comments="' +
            (resource.status.comments || '') + '", pub_date="' + (resource.status.pub_date || 'NULL') +
            '", license="' + (resource.status.license || 'NULL') + '", version="' + resource.status.version +
            '" where slug="' + resource.slug + '" and project_id=' + project_id + ';');
        var id = -1,
            result = zipper(query('select id from resource where slug="' + resource.slug + '" and project_id=' +
            project_id));
        if(result.length > 0) {
            id = result[0].id;
        }

        // add formats
        for(var format of resource.formats) {
            run('insert or ignore into resource_format' +
                ' (syntax_version, mime_type, modified_at, url, resource_id)' +
                ' values ("' + format.syntax_version + '", "' + format.mime_type + '", ' + (format.mod || 0) + ', "' + format.url + '", ' + id + ');' +
                'update resource_format set syntax_version="' + format.syntax_version + '", modified_at="' +
                (format.mod || 0) + '", url="' + format.url + '"' +
                'where mime_type="' + format.mime_type + '" and resource_id=' + id + ';');
        }
        save();

        return id;
    };
    
    this.getters = {
        /**
         * Returns a source language
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
        },

        /**
         * Returns a project
         * @param languageSlug
         * @param projectSlug
         * @returns {json} the project object or null if it does not exist
         */
        getProject: function(languageSlug, projectSlug) {
            var result =  zipper(query('select * from project' +
                ' where slug="' + projectSlug + '" and source_language_id in (' +
                '  select id from source_language where slug="' + languageSlug + '")' +
                ' limit 1'));
            if(result.length > 0) {
                return result[0];
            }
            return null;
        },

        /**
         * Returns a list of projects available in the given language
         * @param languageSlug
         * @return [json]
         */
        getProjects: function(languageSlug) {
            return zipper(query('select * from project' +
                ' where source_language_id in (' +
                '  select id from source_language where slug="' + languageSlug + '")' +
                ' order by sort desc'));
        },

        /**
         * Returns a resource
         * @param languageSlug
         * @param projectSlug
         * @param resourceSlug
         * @returns {json} the resource object or null if it does not exist
         */
        getResource: function(languageSlug, projectSlug, resourceSlug) {
            var result =  zipper(query('select r.*, rf.syntax_version as f_syntax_version, rf.mime_type as f_mime_type,' +
                ' rf.modified_at as f_modified_at, rf.url as f_url from resource as r' +
                ' left join resource_format as rf on rf.resource_id=r.id' +
                ' where r.slug="' + resourceSlug + '" and r.project_id in (' +
                '  select id from project where slug="' + projectSlug + '" and source_language_id in (' +
                '   select id from source_language where slug="' + languageSlug + '"))' +
                ' and rf.mime_type like ("application/ts+%")' +
                ' limit 1'));
            if(result.length > 0) {
                var res = result[0];
                // organize the resource container format
                res.container_format = {
                    syntax_version:res.f_syntax_version,
                    mime_type:res.f_mime_type,
                    modified_at:res.f_modified_at,
                    url:res.f_url
                };
                delete res.f_syntax_version;
                delete res.f_mime_type;
                delete res.f_modified_at;
                delete res.f_url;

                return res;
            }
            return null;
        },

        /**
         * Returns a list of resources available in the given project
         * @param languageSlug
         * @param projectSlug
         * @return [json]
         */
        getResources: function(languageSlug, projectSlug) {
            var result = zipper(query('select r.*, rf.syntax_version as f_syntax_version, rf.mime_type as f_mime_type,' +
                ' rf.modified_at as f_modified_at, rf.url as f_url from resource as r' +
                ' left join resource_format as rf on rf.resource_id=r.id' +
                ' where project_id in (' +
                '  select id from project where slug="' + projectSlug + '" and source_language_id in (' +
                '   select id from source_language where slug="' + languageSlug + '"))' +
                ' and rf.mime_type like ("application/ts+%")' +
                ' order by slug desc'));

            for(var res of result) {
                // organize the resource container format
                res.container_format = {
                    syntax_version:res.f_syntax_version,
                    mime_type:res.f_mime_type,
                    modified_at:res.f_modified_at,
                    url:res.f_url
                };
                delete res.f_syntax_version;
                delete res.f_mime_type;
                delete res.f_modified_at;
                delete res.f_url;
            }
            return result;
        }
    };
    
    return this;
}

module.exports = library;