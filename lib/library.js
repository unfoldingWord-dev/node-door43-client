var _ = require('lodash');

function zipper (r) {
    // TODO: we should manually zip the response instead of using lodash to eliminate dependencies
    return r.length ? _.map(r[0].values, _.zipObject.bind(_, r[0].columns)) : [];
}

function firstId(r) {
    if(r && r.length > 0 && r[0].id) {
        return r[0].id;
    }
    return -1;
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
            ' values (\':slug\', \':name\', \':dir\');' +
            'update source_language set name=\':name\', direction=\':dir\' where slug=\':slug\'', {
            slug: language.slug,
            name: language.name,
            dir: language.direction
        });
        save();
        return firstId(zipper(query('select id from source_language where slug=\'?\'', [language.slug])));
    };

    /**
     * Inserts or updates a target language in the library
     * @param language
     * @returns int the id of the target language row
     */
    this.addTargetLanguage = function(language) {
        run('insert or ignore into target_language ' +
            '(slug, name, anglicized_name, direction, region, is_gateway_language)' +
            ' values (\':slug\', \':name\', \':ang_name\', \':dir\', \':region\', :gl);' +
            'update target_language set name=\':name\', anglicized_name=\':ang_name\', direction=\':dir\', region=\':region\',' +
            ' is_gateway_language=:gl where slug=\':slug\'', {
            slug: language.slug,
            name: language.name,
            ang_name: language.anglicized_name,
            dir: language.direction,
            region: language.region,
            gl: language.is_gateway_language
        });
        save();
        return firstId(zipper(query('select id from target_language where slug=\'?\'',
            [language.slug])));
    };

    /**
     * Inserts or updates a project in the library
     * @param project
     * @param source_language_id the parent source language row id
     * @returns int the id of the project row
     */
    this.addProject = function(project, source_language_id) {
        // add categories
        var parent_category_id = 0;
        if(project.categories) {
            // build categories
            for(var category of project.categories) {
                run('insert or ignore into category' +
                    ' (slug, parent_id) values (\'?\', ?)',
                    [category.slug, parent_category_id]);

                parent_category_id = zipper(query('select id from category where slug=\'?\' and parent_id=?',
                    [category.slug, parent_category_id]))[0].id;

                run('insert or ignore into category_name' +
                    '(source_language_id, category_id, name) values(:source_language, :category, \':name\');' +
                    'update category_name set name=\':name\' where source_language_id=:source_language' +
                    ' and category_id=:category;', {
                    source_language: source_language_id,
                    category: parent_category_id,
                    name: category.name
                })
            }
        }

        // add project
        run('insert or ignore into project ' +
            '(slug, name, desc, icon, sort, chunks_url, source_language_id, category_id)' +
            ' values (\':slug\', \':name\', \':desc\', \':icon\', :sort, \':chunks_url\', :source_language, :category);' +
            'update project set name=\':name\', desc=\':desc\', icon=\':icon\', sort=:sort, chunks_url=\':chunks_url\',' +
            ' category_id=:category' +
            ' where slug=\':slug\' and source_language_id=:source_language;', {
            slug: project.slug,
            name: project.name,
            desc: project.desc || '',
            icon: project.icon || '',
            sort: project.sort,
            chunks_url: project.chunks_url || '',
            source_language: source_language_id,
            category: parent_category_id
        });
        save();

        return firstId(zipper(query('select id from project where slug=\'?\' and source_language_id=?',
            [project.slug, source_language_id])));
    };

    /**
     * Inserts or updates a catalog in the library
     * @param catalog
     * @returns int the id of the catalog
     */
    this.addCatalog = function(catalog) {
        run('insert or ignore into catalog' +
            ' (slug, url, modified_at) values (\':slug\', \':url\', :mod);' +
            'update catalog set url=\':url\', modified_at=:mod where slug=\':slug\';', {
            slug: catalog.slug,
            url: catalog.url,
            mod: catalog.modified_at
        });
        save();
        return firstId(zipper(query('select id from catalog where slug=\'?\'', [catalog.slug])));
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
            ' values (\':slug\', \':name\', \':mode\', \':checking\', \':comments\', \':pub\', \':license\',' +
            ' \':version\', :project);' +
            'update resource set name=\':name\', translate_mode=\':mode\', checking_level=\':checking\',' +
            ' comments=\':comments\', pub_date=\':pub\', license=\':license\', version=\':version\'' +
            ' where slug=\':slug\' and project_id=:project;', {
            slug: resource.slug,
            name: resource.name,
            mode: resource.status.translate_mode,
            checking: resource.status.checking_level,
            comments: resource.status.comments || '',
            pub: resource.status.pub_date,
            license: resource.status.license || '',
            version: resource.status.version,
            project: project_id
        });
        var resourceId = firstId(zipper(query('select id from resource where slug=\'?\' and project_id=?',
            [resource.slug, project_id])));

        // add formats
        for(var format of resource.formats) {
            run('insert or ignore into resource_format' +
                ' (syntax_version, mime_type, modified_at, url, resource_id)' +
                ' values (\':syntax\', \':mime\', :mod, \'url\', :id);' +
                'update resource_format set syntax_version=\':syntax\', modified_at=\':mod\', url=\':url\'' +
                'where mime_type=\':mime\' and resource_id=:id;', {
                syntax:format.syntax_version,
                mime: format.mime_type,
                mod: format.modified_at || 0,
                url: format.url,
                id: resourceId
            });
        }
        save();

        return resourceId;
    };
    
    this.getters = {
        /**
         * Returns a source language
         * @param slug
         * @return {json} the language object or null if it does not exist
         */
        getSourceLanguage: function(slug) {
            var result =  zipper(query('select * from source_language where slug=\'?\' limit 1', [slug]));
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
         * Returns a target language
         * @param slug
         * @return {json} the language object or null if it does not exist
         */
        getTargetLanguage: function(slug) {
            var result =  zipper(query('select * from target_language where slug=\'?\' limit 1', [slug]));
            if(result.length > 0) {
                return result[0];
            }
            return null;
        },

        /**
         * Returns a list of every target language
         * @return [json]
         */
        getTargetLanguages: function() {
            return zipper(query('select * from target_language order by slug desc'));
        },

        /**
         * Returns a project
         * @param languageSlug
         * @param projectSlug
         * @returns {json} the project object or null if it does not exist
         */
        getProject: function(languageSlug, projectSlug) {
            // support passing args as an object
            if(languageSlug != null && typeof languageSlug == 'object') {
                projectSlug = languageSlug.projectSlug;
                languageSlug = languageSlug.languageSlug;
            }
            var result =  zipper(query('select * from project' +
                ' where slug=\'?\' and source_language_id in (' +
                '  select id from source_language where slug=\'?\')' +
                ' limit 1', [projectSlug, languageSlug]));
            if(result.length > 0) {
                // store the language slug for convenience
                result[0].source_language_slug = languageSlug;
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
            var result = zipper(query('select * from project' +
                ' where source_language_id in (select id from source_language where slug=\'?\')' +
                ' order by sort desc', [languageSlug]));
            for(var project of result) {
                // store the language slug for convenience
                project.source_language_slug = languageSlug;
            }
            return result;
        },

        /**
         * Returns a resource
         * @param languageSlug
         * @param projectSlug
         * @param resourceSlug
         * @returns {json} the resource object or null if it does not exist
         */
        getResource: function(languageSlug, projectSlug, resourceSlug) {
            var result =  zipper(query('select * from resource' +
                ' where slug=\'?\' and project_id in (' +
                '  select id from project where slug=\'?\' and source_language_id in (' +
                '   select id from source_language where slug=\'?\'))' +
                ' limit 1', [resourceSlug, projectSlug, languageSlug]));
            if(result.length > 0) {
                var res = result[0];
                // organize the status
                res.status = {
                    translate_mode: res.translate_mode,
                    checking_level: res.checking_level,
                    comments: res.comments,
                    pub_date: res.pub_date,
                    license: res.license,
                    version: res.version
                };
                delete res.translate_mode;
                delete res.checking_level;
                delete res.comments;
                delete res.pub_date;
                delete res.license;
                delete res.version;

                // store language and project slug for convenience
                res.source_language_slug = languageSlug;
                res.project_slug = projectSlug;

                // get formats
                res.formats = [];
                var formatResults =  zipper(query('select * from resource_format' +
                    ' where resource_id=\'?\' limit 1', [res.id]));
                for(var format of formatResults) {
                    delete format.id;
                    delete format.resource_id;
                    res.formats.push(format);
                }

                return res;
            }
            return null;
        },

        /**
         * Returns a list of resources available in the given project
         * Note: You may provide a single object parameter if you prefer
         *
         * @param languageSlug
         * @param projectSlug
         * @return [json]
         */
        getResources: function(languageSlug, projectSlug) {
            // support passing args as an object
            if(languageSlug != null && typeof languageSlug == 'object') {
                projectSlug = languageSlug.projectSlug;
                languageSlug = languageSlug.languageSlug;
            }

            var result = zipper(query('select * from resource' +
                ' where project_id in (' +
                '  select id from project where slug=\'?\' and source_language_id in (' +
                '   select id from source_language where slug=\'?\'))' +
                ' order by slug desc', [projectSlug, languageSlug]));

            for(var res of result) {
                // organize the status
                res.status = {
                    translate_mode: res.translate_mode,
                    checking_level: res.checking_level,
                    comments: res.comments,
                    pub_date: res.pub_date,
                    license: res.license,
                    version: res.version
                };
                delete res.translate_mode;
                delete res.checking_level;
                delete res.comments;
                delete res.pub_date;
                delete res.license;
                delete res.version;

                // store language and project slug for convenience
                res.source_language_slug = languageSlug;
                res.project_slug = projectSlug;

                // get formats
                res.formats = [];
                var formatResults =  zipper(query('select * from resource_format' +
                    ' where resource_id=\'?\' limit 1', [res.id]));
                for(var format of formatResults) {
                    delete format.id;
                    delete format.resource_id;
                    res.formats.push(format);
                }
            }
            return result;
        },

        /**
         * Returns a catalog
         * @param slug
         * @returns {json} the catalog object or null if it does not exist
         */
        getCatalog: function(slug) {
            var result = zipper(query('select * from catalog where slug=\'?\'', [slug]));
            if(result.length > 0) {
                return result[0];
            }
            return null;
        },

        /**
         * Returns a list of catalogs
         */
        getCatalogs: function() {
            return zipper(query('select * from catalog'));
        }
    };
    
    return this;
}

module.exports = library;