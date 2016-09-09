'use strict';

const _ = require('lodash');

/**
 * Returns the id of the first object in an array
 * @param arry {[]} the array
 * @returns {int}
 */
function firstId(arry) {
    if(arry && arry.length > 0 && arry[0].id) {
        return arry[0].id;
    }
    return -1;
}

/**
 * Manages the indexed library content.
 *
 * @param sqliteHelper {SQLiteHelper}
 * @param opts {{}}
 * @constructor
 */
function Library(sqliteHelper, opts) {
    const query = sqliteHelper.query;
    const run = sqliteHelper.run;
    opts = opts || {autosave: true};

    /**
     * Enables or disables automatically saving after db change
     * @param autosave {boolean}
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

    /**
     * Saves the database if autosave is enabled
     */
    const save = function() {
        if(opts.autosave) {
            sqliteHelper.save();
        }
    };

    /**
     * A utility to perform insert+update operations.
     * Insert failures are ignored.
     * Update failures are thrown.
     *
     * @param table {string}
     * @param params {{}} keys must be valid column names
     * @param unique {[]} a list of unique columns on this table. This should be a subset of params
     * @returns {int} the id of the inserted/updated row or -1
     */
    const insertOrUpdate = function(table, params, unique) {
        unique = unique || [];

        let columns = _.keys(params);
        let whereStatements = _.map(unique, function(c) { return c + '=:' + c});
        let updatedColumns = _.map(_.filter(columns, function(c) { return unique.indexOf(c) }), function(c) { return c + '=:' + c });
        let insertHolders = _.map(columns, function(k) { return ':' + k; });

        run('insert or ignore into ' + table + ' (' + columns.join(', ') + ') values (' + insertHolders.join(', ') + ')', params);
        run('update or fail ' + table + ' set ' + updatedColumns.join(', ') + ' where ' + whereStatements.join(' and '), params);

        save();

        // TRICKY: in this module we are strictly dealing with inserts or *full* updates.
        // Therefore we can rely on the existence of the unique columns to retrieve the id
        let result = query('select id from ' + table + ' where ' + whereStatements.join(' and ') + ' order by id desc limit 1', params);
        return firstId(result);
    };

    /**
     * Performs an empty validation check on an object or scalar.
     * This should only be used to validate string properties
     * since invalid integers values are handled by the db schema.
     *
     * @param obj {{}|string} the object or string to be validated
     * @param required_props {[string]} an array of required properties. default is all properties in obj. If obj is a scalar this should be the name of the property for reporting purposes.
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
     * Inserts or updates a source language in the library.
     *
     * @param language {{}}
     * @returns {int} the id of the source language row
     * @throws {Error}
     */
    this.addSourceLanguage = function(language) {
        validateNotEmpty(language, ['slug', 'name', 'direction']);
        return insertOrUpdate('source_language', {
            slug: language.slug,
            name: language.name,
            direction: language.direction
        }, ['slug']);
    };

    /**
     * Inserts or updates a target language in the library.
     *
     * Note: the result is boolean since you don't need the row id. See getTargetLanguages for more information
     *
     * @param language {{}}
     * @returns {boolean} indicates if the target language was successfully added.
     */
    this.addTargetLanguage = function(language) {
        validateNotEmpty(language, ['slug', 'name', 'direction']);
        let id = insertOrUpdate('target_language', {
            slug: language.slug,
            name: language.name,
            anglicized_name: language.anglicized_name,
            direction: language.direction,
            region: language.region,
            is_gateway_language: language.is_gateway_language ? 1 : 0
        }, ['slug']);
        return id > 0;
    };

    /**
     * Inserts or updates a temporary target language in the library.
     *
     * Note: the result is boolean since you don't need the row id. See getTargetLanguages for more information
     *
     * @param language {{}}
     * @returns {boolean} indicates if the temporary target language was successfully added.
     */
    this.addTempTargetLanguage = function(language) {
        validateNotEmpty(language, ['slug', 'name', 'direction']);
        let id = insertOrUpdate('temp_target_language', {
            slug: language.slug,
            name: language.name,
            anglicized_name: language.anglicized_name,
            direction: language.direction,
            region: language.region,
            is_gateway_language: language.is_gateway_language ? 1 : 0
        }, ['slug']);
        return id > 0;
    };

    /**
     * Updates the target language assigned to a temporary target language
     * @param temp_target_language_slug {string} the temporary target language that is being assigned a target language
     * @param target_language_slug {string} the assigned target language
     * @returns {boolean} indicates if the approved language was successfully set
     */
    this.setApprovedTargetLanguage = function(temp_target_language_slug, target_language_slug) {
        run('update temp_target_language set' +
            ' approved_target_language_slug=?' +
            ' where slug=?', [target_language_slug, temp_target_language_slug]);
        let result = query('select id from temp_target_language' +
            ' where slug=? and approved_target_language_slug=?', [temp_target_language_slug, target_language_slug]);
        return firstId(result) > 0;
    };

    /**
     * Inserts or updates a project in the library
     * @param project {{}}
     * @param source_language_id {int} the parent source language row id
     * @returns {int} the id of the project row
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

                insertOrUpdate('category_name', {
                    source_language_id: source_language_id,
                    category_id: parent_category_id,
                    name: category.name
                }, ['source_language_id', 'category_id']);
            }
        }

        // add project
        return insertOrUpdate('project', {
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
     * Inserts or updates a versification in the library.
     *
     * @param versification {{}}
     * @param source_language_id {int} the parent source language row id
     * @returns {int} the id of the versification
     */
    this.addVersification = function(versification,  source_language_id) {
        validateNotEmpty(versification, ['name']);
        run('insert or ignore into versification' +
            ' (slug) values (?)', [versification.slug]);
        var versification_id = firstId(query('select id from versification where slug=? order by id desc', [versification.slug]));
        insertOrUpdate('versification_name', {
            source_language_id: source_language_id,
            versification_id: versification_id,
            name: versification.name
        }, ['source_language_id', 'versification_id']);
        return versification_id;
    };

    /**
     * Inserts a chunk marker in the library.
     *
     * @param chunk {{}}
     * @param project_slug {string} the project that this marker exists in
     * @param versification_id {int} the versification this chunk is a member of
     * return {int} the id of the chunk marker
     */
    this.addChunkMarker = function(chunk, project_slug, versification_id) {
        validateNotEmpty(chunk, ['chapter', 'verse']);
        validateNotEmpty(project_slug, ['project_slug']);
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
     * Inserts or updates a catalog in the library.
     *
     * @param catalog {{}}
     * @returns {int} the id of the catalog
     */
    this.addCatalog = function(catalog) {
        validateNotEmpty(catalog, ['slug', 'url']);
        return insertOrUpdate('catalog', {
            slug: catalog.slug,
            url: catalog.url,
            modified_at: catalog.modified_at
        }, ['slug']);
    };

    /**
     * Inserts or updates a resource in the library.
     *
     * @param resource {{}}
     * @param project_id {int} the parent project row id
     * @returns {int} the id of the resource row
     */
    this.addResource = function(resource, project_id) {

        validateNotEmpty(resource, ['slug', 'name', 'type', 'formats']);
        validateNotEmpty(resource.status, ['translate_mode', 'checking_level', 'version']);
        let resourceId = insertOrUpdate('resource', {
            slug: resource.slug,
            name: resource.name,
            type: resource.type,
            translate_mode: resource.status.translate_mode,
            checking_level: resource.status.checking_level,
            comments: resource.status.comments || '',
            pub_date: resource.status.pub_date || 0,
            license: resource.status.license || '',
            version: resource.status.version,
            project_id: project_id
        }, ['slug', 'project_id']);

        // add formats
        for (var format of resource.formats) {
            insertOrUpdate('resource_format', {
                package_version: format.package_version,
                mime_type: format.mime_type,
                modified_at: format.modified_at || 0,
                url: format.url,
                resource_id: resourceId
            }, ['mime_type', 'resource_id']);
        }

        // add legacy data
        if(resource.translation_words_assignments_url) {
            insertOrUpdate('legacy_resource_info', {
                translation_words_assignments_url: resource.translation_words_assignments_url,
                resource_id: resourceId
            }, ['resource_id']);
        }

        return resourceId;
    };

    /**
     * Inserts or updates a questionnaire in the library.
     *
     * @param questionnaire {{}} the questionnaire to add
     * @returns {int} the id of the questionnaire row
     */
    this.addQuestionnaire = function(questionnaire) {
        validateNotEmpty(questionnaire, ['language_slug', 'language_name', 'language_direction']);
        return insertOrUpdate('questionnaire', {
            language_slug: questionnaire.language_slug,
            language_name: questionnaire.language_name,
            language_direction: questionnaire.language_direction.toLowerCase() === 'rtl' ? 'rtl' : 'ltr',
            td_id: questionnaire.td_id
        }, ['td_id', 'language_slug']);
    };

    /**
     * Inserts or updates a question in the library.
     *
     * @param question {{}} the questionnaire to add
     * @param questionnaire_id {int} the parent questionnaire row id
     * @returns {int} the id of the question row
     */
    this.addQuestion = function(question, questionnaire_id) {
        validateNotEmpty(question, ['text', 'input_type']);
        return insertOrUpdate('question', {
            text: question.text,
            help: question.help,
            is_required: question.is_required,
            input_type: question.input_type,
            sort: question.sort,
            depends_on: question.depends_on,
            td_id: question.td_id,
            questionnaire_id: questionnaire_id
        }, ['td_id', 'questionnaire_id']);
    };

    /**
     * Returns a list of source languages and when they were last modified.
     * The value is taken from the max modified resource format date within the language
     *
     * @returns {[{slug, modified_at}]}
     */
    this.listSourceLanguagesLastModified = function() {
        return query('select sl.slug, max(rf.modified_at) as modified_at from resource_format as rf'
            + ' left join resource  as r on r.id=rf.resource_id'
            + ' left join project as p on p.id=r.project_id'
            + ' left join source_language as sl on sl.id=p.source_language_id'
            + ' where rf.mime_type like("application/ts+%")'
            + ' group by sl.slug');
    };

    /**
     * Returns a list of projects and when they were last modified
     * The value is taken from the max modified resource format date within the project
     *
     * @param languageSlug {string} the source language who's projects will be selected. If left empty the results will include all projects in all languages.
     * @returns {[{slug, modified_at}]}
     */
    this.listProjectsLastModified = function(languageSlug) {
        if(languageSlug) {
            return query('select p.slug, max(rf.modified_at) as modified_at from resource_format as rf'
                + ' left join resource  as r on r.id=rf.resource_id'
                + ' left join project as p on p.id=r.project_id'
                + ' left join source_language as sl on sl.id=p.source_language_id'
                + ' where rf.mime_type like("application/ts+%") and sl.slug=?'
                + ' group by p.slug', languageSlug);
        } else {
            return query('select p.slug, max(rf.modified_at) as modified_at from resource_format as rf'
                + ' left join resource  as r on r.id=rf.resource_id'
                + ' left join project as p on p.id=r.project_id'
                + ' where rf.mime_type like("application/ts+%")'
                + ' group by p.slug');
        }
    };

    /**
     * These are methods designed for public use
     */
    this.public_getters = {
        /**
         * Returns a source language.
         *
         * @param slug {string}
         * @return {{}|null} the language object or null if it does not exist
         */
        getSourceLanguage: function(slug) {
            var result =  query('select * from source_language where slug=? limit 1', [slug]);
            if(result.length > 0) {
                return result[0];
            }
            return null;
        },
    
        /**
         * Returns a list of every source language.
         *
         * @returns {[{}]} an array of source languages
         */
        getSourceLanguages: function() {
            return query('select * from source_language order by slug desc');
        },

        /**
         * Returns a target language.
         * The result may be a temp target language.
         *
         * Note: does not include the row id. You don't need it
         *
         * @param slug {string}
         * @returns {{}|null} the language object or null if it does not exist
         */
        getTargetLanguage: function(slug) {
            var result = query('select * from (' +
                '  select slug, name, anglicized_name, direction, region, is_gateway_language from target_language' +
                '  union' +
                '  select slug, name, anglicized_name, direction, region, is_gateway_language from temp_target_language' +
                '  where approved_target_language_slug is null' +
                ') where slug=? limit 1', [slug]);
            if(result.length > 0) {
                return result[0];
            }
            return null;
        },

        /**
         * Returns a list of every target language.
         * The result may include temp target languages.
         *
         * Note: does not include the row id. You don't need it
         *
         * @returns {[{}]} an array of target languages
         */
        getTargetLanguages: function() {
            return query('select * from (' +
                '  select slug, name, anglicized_name, direction, region, is_gateway_language from target_language' +
                '  union' +
                '  select slug, name, anglicized_name, direction, region, is_gateway_language from temp_target_language' +
                '  where approved_target_language_slug is null' +
                ') order by slug asc, name desc');
        },

        /**
         * Returns the target language that has been assigned to a temporary target language.
         *
         * Note: does not include the row id. You don't need it
         *
         * @param temp_target_language_slug {string} the temporary target language with the assignment
         * @returns {{}|null} the language object or null if it does not exist
         */
        getApprovedTargetLanguage: function(temp_target_language_slug) {
            let result = query('select tl.* from target_language as tl' +
                ' left join temp_target_language as ttl on ttl.approved_target_language_slug=tl.slug' +
                ' where ttl.slug=?', [temp_target_language_slug]);
            if(result.length > 0) {
                delete result[0].id;
                return result[0];
            }
            return null;
        },

        /**
         * Returns a project.
         *
         * @param languageSlug {string|{languageSlug, projectSlug}}
         * @param projectSlug {string}
         * @returns {{}|null} the project object or null if it does not exist
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
         * Returns a list of projects available in the given language.
         *
         * @param languageSlug {string}
         * @returns {[{}]} an array of projects
         */
        getProjects: function(languageSlug) {
            var result = query('select * from project' +
                ' where source_language_id in (select id from source_language where slug=?)' +
                ' order by sort asc', [languageSlug]);
            for(var project of result) {
                // store the language slug for convenience
                project.source_language_slug = languageSlug;
            }
            return result;
        },

        /**
         * Returns an array of categories that exist underneath the parent category.
         * The results of this method are a combination of categories and projects.
         *
         * @param parentCategoryId {int} the category who's children will be returned. If 0 then all top level categories will be returned.
         * @param languageSlug {string} the language in which the category titles will be displayed
         * @param translateMode {string} limit the results to just those with the given translate mode. Leave this falsy to not filter
         * @returns {[{}]} an array of project categories
         */
        getProjectCategories: function(parentCategoryId, languageSlug, translateMode) {
            var preferredSlug = [languageSlug, 'en', '%'];
            var categories = [];
            if(translateMode) {
                categories = query('select \'category\' as type, c.slug as name, \'\' as source_language_slug,' +
                    ' c.id, c.slug, c.parent_id, count(p.id) as num from category as c' +
                    ' left join (' +
                    '  select p.id, p.category_id, count(r.id) as num from project as p' +
                    '  left join resource as r on r.project_id=p.id and r.translate_mode like(?)' +
                    '  group by p.slug' +
                    ' ) p on p.category_id=c.id and p.num > 0' +
                    ' where parent_id=? and num > 0 group by c.slug', [translateMode, parentCategoryId]);
            } else {
                categories = query('select \'category\' as type, category.slug as name, \'\' as source_language_slug, * from category where parent_id=?', [parentCategoryId]);
            }

            // find best name
            var catNameQuery = 'select sl.slug as source_language_slug, cn.name as name' +
                ' from category_name as cn' +
                ' left join source_language as sl on sl.id=cn.source_language_id' +
                ' where sl.slug like(?) and cn.category_id=?';
            for(var cat of categories) {
                for(var slug of preferredSlug) {
                    var result = query(catNameQuery, [slug, cat.id]);
                    if(result.length > 0) {
                        cat.name = result[0]['name'];
                        cat.source_language_slug = result[0]['source_language_slug'];
                        break;
                    }
                }
            }

            var projects = query('select * from (' +
                ' select \'project\' as type, \'\' as source_language_slug,' +
                ' p.id, p.slug, p.sort, p.name, count(r.id) as num from project as p' +
                ' left join resource as r on r.project_id=p.id and r.translate_mode like (?)' +
                ' where p.category_id=? group by p.slug' +
                ')' + (translateMode ? ' where num > 0' : ''), [translateMode || '%', parentCategoryId]);
            // find best name
            var projNameQuery = 'select sl.slug as source_language_slug, p.name as name' +
                ' from project as p' +
                ' left join source_language as sl on sl.id=p.source_language_id' +
                ' where sl.slug like(?) and p.slug=? order by sl.slug asc';
            for(var proj of projects) {
                for(var slug of preferredSlug) {
                    var result = query(projNameQuery, [slug, proj.slug]);
                    if(result.length > 0) {
                        proj.name = result[0]['name'];
                        proj.source_language_slug = result[0]['source_language_slug'];
                        break;
                    }
                }
            }
            return categories.concat(projects);
        },

        /**
         * Returns a resource.
         *
         * @param languageSlug {string}
         * @param projectSlug {string}
         * @param resourceSlug {string}
         * @returns {{}|null} the resource object or null if it does not exist
         */
        getResource: function(languageSlug, projectSlug, resourceSlug) {
            var result =  query('select r.*, lri.translation_words_assignments_url from resource as r' +
                ' left join legacy_resource_info as lri on lri.resource_id=r.id' +
                ' where r.slug=? and r.project_id in (' +
                '  select id from project where slug=? and source_language_id in (' +
                '   select id from source_language where slug=?)' +
                ' )' +
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
                    ' where resource_id=?', [res.id]);
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
         * @param languageSlug {string|null|{languageSlug, projectSlug}} the language of the resource. If null then all resources of the project will be returned.
         * @param projectSlug {string} the project who's resources will be returned
         * @return {[{}]} an array of resources
         */
        getResources: function(languageSlug, projectSlug) {
            // support passing args as an object
            if(languageSlug != null && typeof languageSlug == 'object') {
                projectSlug = languageSlug.projectSlug;
                languageSlug = languageSlug.languageSlug;
            }

            var result = [];
            if(languageSlug) {
                // filter by language
                result = query('select r.*, lri.translation_words_assignments_url from resource as r' +
                    ' left join legacy_resource_info as lri on lri.resource_id=r.id' +
                    ' where r.project_id in (' +
                    '  select id from project where slug=? and source_language_id in (' +
                    '   select id from source_language where slug=?)' +
                    ' )' +
                    ' order by r.slug desc', [projectSlug, languageSlug]);
            } else {
                // no language filtering
                result = query('select sl.slug as source_language_slug, r.*, lri.translation_words_assignments_url from resource as r' +
                    ' left join legacy_resource_info as lri on lri.resource_id=r.id' +
                    ' left join project as p on p.id=r.project_id' +
                    ' left join (' +
                    '  select id, slug from source_language' +
                    ' ) as sl on sl.id=p.source_language_id' +
                    ' where p.slug=? order by r.slug asc', [projectSlug]);
            }

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
                if(!res.source_language_slug) res.source_language_slug = languageSlug;
                res.project_slug = projectSlug;

                // get formats
                res.formats = [];
                var formatResults =  query('select * from resource_format' +
                    ' where resource_id=?', [res.id]);
                for(var format of formatResults) {
                    delete format.id;
                    delete format.resource_id;
                    res.formats.push(format);
                }
            }
            return result;
        },

        /**
         * Returns a catalog.
         *
         * @param slug {string}
         * @returns {{}|null} the catalog object or null if it does not exist
         */
        getCatalog: function(slug) {
            var result = query('select * from catalog where slug=?', [slug]);
            if(result.length > 0) {
                return result[0];
            }
            return null;
        },

        /**
         * Returns a list of catalogs.
         *
         * @returns {[{}]}
         */
        getCatalogs: function() {
            return query('select * from catalog');
        },

        /**
         * Returns a versification.
         *
         * @param languageSlug {string}
         * @param versificationSlug {string}
         * @returns {{}|null}
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
         * Returns a list of versifications.
         *
         * @param languageSlug {string}
         * @returns {[{}]}
         */
        getVersifications: function(languageSlug) {
            return query('' +
                'select vn.name, v.slug, v.id from versification_name as vn' +
                ' left join versification as v on v.id=vn.versification_id' +
                ' left join source_language as sl on sl.id=vn.source_language_id' +
                ' where sl.slug=?', [languageSlug]);
        },

        /**
         * Returns a list of chunk markers for a project.
         *
         * @param projectSlug {string}
         * @param versificationSlug {string}
         * @returns {[{}]}
         */
        getChunkMarkers: function(projectSlug, versificationSlug) {
            return query('' +
                'select cm.* from chunk_marker as cm' +
                ' left join versification as v on v.id=cm.versification_id' +
                ' where v.slug=? and cm.project_slug=?', [versificationSlug, projectSlug]);
        },

        /**
         * Returns a list of questionnaires.
         *
         * @returns {[{}]} a list of questionnaires
         */
        getQuestionnaires: function() {
            return query('select * from questionnaire');
        },

        /**
         * Returns a list of questions.
         *
         * @param questionnaire_id {int} the parent questionnaire row id
         * @returns {[{}]} a list of questionnaires
         */
        getQuestions: function(questionnaire_id) {
            return query('select * from question where questionnaire_id=?', [questionnaire_id]);
        }
    };
    
    return this;
}

module.exports = Library;