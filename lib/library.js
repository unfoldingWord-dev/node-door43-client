'use strict';

function firstId(r) {
    if(r && r.length > 0 && r[0].id) {
        return r[0].id;
    }
    return -1;
}

/**
 * Manages the indexed library content
 * @param sqliteHelper {sqlite-helper}
 * @param opts
 * @returns {library}
 */
function library(sqliteHelper, opts) {
    const query = sqliteHelper.query;
    const run = sqliteHelper.run;
    opts = opts || {autosave: true};

    /**
     * Performs an insert+update on the db
     * @param table
     * @param params {Object} keys must be valid column names
     * @param unique Array a list of unique columns on this table. This should be a subset of params
     * @returns int the id of the inserted row or -1
     */
    const insertUpdate = function(table, params, unique) {
        unique = unique || [];

        let columns = _.keys(params);
        let whereStatements = _.map(unique, function(c) { return c + '=:' + c});
        let updatedColumns = _.map(_.filter(columns, function(c) { return unique.indexOf(c) }), function(c) { return c + '=:' + c });
        let insertHolders = _.map(columns, function(k) { return ':' + k; });

        run('insert or ignore into ' + table + ' (' + columns.join(', ') + ') values (' + insertHolders.join(', ') + ')', params);
        run('update or fail ' + table + ' set ' + updatedColumns.join(', ') + ' where ' + whereStatements.join(' and '), params);

        save();

        let result = query('select id from ' + table + ' where ' + whereStatements.join(' and ') + ' order by id desc limit 1', params);
        return firstId(result);
    };

    /**
     * Enables or disables automatically saving after db change
     * @param autosave
     */
    this.autosave = function(autosave) {
        opts.autosave = autosave;
    };

    /**
     * Manually persists all changes in the db to the disk
     */
    this.commit = function() {
        sqliteHelper.save();
    };

    const save = function() {
        if(opts.autosave) {
            sqliteHelper.save();
        }
    };

    /**
     * Performs an empty validation check on an object or scalar.
     * In general this is only necessary for string properties
     * since invalid integers values should be correctly caught by the db schema.
     *
     * @param obj the object or scalar to be validated
     * @param required_props an array of required properties. default is all properties in obj. If obj is a scalar this should be the name of the property for reporting purposes.
     */
    const validateNotEmpty = function(obj, required_props) {
        if(typeof obj === 'object') {
            required_props = required_props || Object.keys(obj);
            for (let prop of required_props) {
                if (obj[prop] === undefined || obj[prop] === null || obj[prop] === '') {
                    throw new Error('Missing required property "' + prop + '"');
                }
            }
        } else if(obj === undefined || obj === null || obj === '') {
            throw new Error('Missing required property "' + required_props + '"');
        }
    };

    /**
     * Inserts or updates a source language in the library
     * @param language
     * @returns int the id of the source language row
     */
    this.addSourceLanguage = function(language) {
        validateNotEmpty(language, ['slug', 'name', 'direction']);
        if(!language.slug || !language.name || !language.direction) throw new Error();
        return insertUpdate('source_language', {
            slug: language.slug,
            name: language.name,
            direction: language.direction
        }, ['slug']);
    };

    /**
     * Inserts or updates a target language in the library
     * @param language
     * @returns int the id of the target language row
     */
    this.addTargetLanguage = function(language) {
        validateNotEmpty(language, ['slug', 'name', 'direction', 'region']);
        return insertUpdate('target_language', {
            slug: language.slug,
            name: language.name,
            anglicized_name: language.anglicized_name,
            direction: language.direction,
            region: language.region,
            is_gateway_language: language.is_gateway_language ? 1 : 0
        }, ['slug']);
    };

    /**
     * Inserts or updates a project in the library
     * @param project
     * @param source_language_id the parent source language row id
     * @returns int the id of the project row
     */
    this.addProject = function(project, source_language_id) {
        validateNotEmpty(project, ['slug', 'name']);

        // add categories
        var parent_category_id = 0;
        if(project.categories) {
            // build categories
            for(var category of project.categories) {
                run('insert or ignore into category' +
                    ' (slug, parent_id) values (?, ?)',
                    [category.slug, parent_category_id]);

                parent_category_id = query('select id from category where slug=? and parent_id=?',
                    [category.slug, parent_category_id])[0].id;

                insertUpdate('category_name', {
                    source_language_id: source_language_id,
                    category_id: parent_category_id,
                    name: category.name
                }, ['source_language_id', 'category_id']);
            }
        }

        // add project
        return insertUpdate('project', {
            slug: project.slug,
            name: project.name,
            desc: project.desc || '',
            icon: project.icon || '',
            sort: project.sort,
            chunks_url: project.chunks_url || '',
            source_language_id: source_language_id,
            category_id: parent_category_id
        }, ['slug', 'source_language_id']);
    };

    /**
     * Inserts or updates a versification in the library
     * @param versification
     * @param source_language_id the parent source language row id
     * @returns int the id of the versification
     */
    this.addVersification = function(versification,  source_language_id) {
        validateNotEmpty(versification, ['name']);
        run('insert or ignore into versification' +
            ' (slug) values (?)', [versification.slug]);
        var versification_id = firstId(query('select id from versification where slug=? order by id desc', [versification.slug]));
        insertUpdate('versification_name', {
            source_language_id: source_language_id,
            versification_id: versification_id,
            name: versification.name
        }, ['source_language_id', 'versification_id']);
        return versification_id;
    };

    /**
     * Inserts a chunk marker in the library
     * @param chunk
     * @param project_slug the project that this marker exists in
     * @param versification_id the versification this chunk is a member of
     */
    this.addChunkMarker = function(chunk, project_slug, versification_id) {
        validateNotEmpty(chunk, ['chapter', 'verse']);
        validateNotEmpty(project_slug, 'project_slug');
        run('insert or ignore into chunk_marker' +
            ' (chapter, verse, versification_id, project_slug)' +
            ' values(:chapter, :verse, :versification, :project);', {
            chapter: chunk.chapter,
            verse: chunk.verse,
            project: project_slug,
            versification: versification_id
        });
        save();
        return firstId(query('select id from chunk_marker' +
            ' where versification_id=?' +
            ' and project_slug=?' +
            ' order by id desc', [versification_id, project_slug]));
    };

    /**
     * Inserts or updates a catalog in the library
     * @param catalog
     * @returns int the id of the catalog
     */
    this.addCatalog = function(catalog) {
        validateNotEmpty(catalog, ['slug', 'url']);
        return insertUpdate('catalog', {
            slug: catalog.slug,
            url: catalog.url,
            modified_at: catalog.modified_at
        }, ['slug']);
    };

    /**
     * Inserts or updates a resource in the library
     * @param resource
     * @param project_id the parent project row id
     * @returns int the id of the resource row
     */
    this.addResource = function(resource, project_id) {
        validateNotEmpty(resource, ['slug', 'name']);
        validateNotEmpty(resource.status, ['translate_mode', 'checking_level', 'version']);
        let resourceId = insertUpdate('resource', {
            slug: resource.slug,
            name: resource.name,
            translate_mode: resource.status.translate_mode,
            checking_level: resource.status.checking_level,
            comments: resource.status.comments || '',
            pub_date: resource.status.pub_date,
            license: resource.status.license || '',
            version: resource.status.version,
            project_id: project_id
        }, ['slug', 'project_id']);

        // add formats
        for(var format of resource.formats) {
            insertUpdate('resource_format', {
                package_version: format.package_version,
                mime_type: format.mime_type,
                modified_at: format.modified_at || 0,
                url: format.url,
                resource_id: resourceId
            }, ['mime_type', 'resource_id']);
        }

        return resourceId;
    };
    
    this.getters = {
        /**
         * Returns a source language
         * @param slug
         * @return {json} the language object or null if it does not exist
         */
        getSourceLanguage: function(slug) {
            var result =  query('select * from source_language where slug=? limit 1', [slug]);
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
            return query('select * from source_language order by slug desc');
        },

        /**
         * Returns a target language
         * @param slug
         * @return {json} the language object or null if it does not exist
         */
        getTargetLanguage: function(slug) {
            var result =  query('select * from target_language where slug=? limit 1', [slug]);
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
            return query('select * from target_language order by slug desc');
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
            var result =  query('select * from project' +
                ' where slug=? and source_language_id in (' +
                '  select id from source_language where slug=?)' +
                ' limit 1', [projectSlug, languageSlug]);
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
            var result = query('select * from project' +
                ' where source_language_id in (select id from source_language where slug=?)' +
                ' order by sort desc', [languageSlug]);
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
            var result =  query('select * from resource' +
                ' where slug=? and project_id in (' +
                '  select id from project where slug=? and source_language_id in (' +
                '   select id from source_language where slug=?))' +
                ' limit 1', [resourceSlug, projectSlug, languageSlug]);
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
                var formatResults =  query('select * from resource_format' +
                    ' where resource_id=? limit 1', [res.id]);
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

            var result = query('select * from resource' +
                ' where project_id in (' +
                '  select id from project where slug=? and source_language_id in (' +
                '   select id from source_language where slug=?))' +
                ' order by slug desc', [projectSlug, languageSlug]);

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
                var formatResults =  query('select * from resource_format' +
                    ' where resource_id=? limit 1', [res.id]);
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
            var result = query('select * from catalog where slug=?', [slug]);
            if(result.length > 0) {
                return result[0];
            }
            return null;
        },

        /**
         * Returns a list of catalogs
         * @returns [json]
         */
        getCatalogs: function() {
            return query('select * from catalog');
        },

        /**
         * Returns a versification
         * @param languageSlug
         * @param versificationSlug
         * @returns {json}
         */
        getVersification: function(languageSlug, versificationSlug) {
            var result = query('' +
                'select vn.name, v.slug, v.id from versification_name as vn' +
                ' left join versification as v on v.id=vn.versification_id' +
                ' left join source_language as sl on sl.id=vn.source_language_id' +
                ' where sl.slug=? and v.slug=?', [languageSlug, versificationSlug]);
            if(result.length > 0) {
                return result[0];
            }
            return null;
        },

        /**
         * Returns a list of versifications
         * @param languageSlug
         * @returns [json]
         */
        getVersifications: function(languageSlug) {
            return query('' +
                'select vn.name, v.slug, v.id from versification_name as vn' +
                ' left join versification as v on v.id=vn.versification_id' +
                ' left join source_language as sl on sl.id=vn.source_language_id' +
                ' where sl.slug=?', [languageSlug]);
        },

        /**
         * Returns a list of chunk markers for a project
         * @param projectSlug
         * @param versificationSlug
         */
        getChunkMarkers: function(projectSlug, versificationSlug) {
            return query('' +
                'select cm.* from chunk_marker as cm' +
                ' left join versification as v on v.id=cm.versification_id' +
                ' where v.slug=? and cm.project_slug=?', [versificationSlug, projectSlug]);
        }
    };
    
    return this;
}

module.exports = library;