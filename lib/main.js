'use strict';

const request = require('./request'),
    mkdirp = require('mkdirp'),
    path = require('path'),
    _ = require('lodash'),
    promiseUtils = require('./utils/promises'),
    fileUtils = require('./utils/files'),
    fs = require('fs'),
    SqliteHelper = require('./sqlite-helper'),
    rimraf = require('rimraf'),
    Library = require('./library'),
    rc = require('resource-container');

/**
 * Initializes a new api client.
 *
 * @param dbPath {string} the path to the db where information will be indexed.
 * @param resourceDir {string} the directory where resources will be stored
 * @param opts {{}} advanced options. compression_method: the type of compression to use for resource containers [tar|zip].
 * @returns {Client}
 * @constructor
 */
function Client(dbPath, resourceDir, opts) {
    // in case we need the client but don't want to build a resource dir.
    if(resourceDir) mkdirp.sync(resourceDir);
    opts = opts || {compression_method: 'tar'};

    const schemaPath = path.normalize(path.join(__dirname, './schema.sqlite'));
    const helper = new SqliteHelper(schemaPath, dbPath);
    const library = new Library(helper);

    /**
     * Provides read only access to the index.
     *
     * @type {{}}
     */
    let index = {};
    for(var method in library.public_getters) {
        index[method] = promiseUtils.promisify(library.public_getters[method]);
    }

    /**
     * Retrieves the container type from a resource.
     *
     * @param resource {{}}
     * @returns {string}
     * @throws {error} if information is missing
     */
    const getResourceContainerType = function(resource) {
        if(!resource.formats) throw new Error('Missing resource formats');
        let containerFormat = getResourceContainerFormat(resource.formats);
        if(!containerFormat) throw new Error('Missing resource container format');
        return rc.tools.mimeToType(containerFormat.mime_type);
    };

    /**
     * Downloads the chunks for a project
     * @param project {{}}
     */
    const downloadChunks = function(project) {
        return request.read(project.chunks_url)
            .then(function(response) {
                // consume chunk data
                if(response.status !== 200) throw response;

                let data = JSON.parse(response.data);
                // TODO: pull the correct versification slug from the data. For now there is only one versification
                let versification_slug = 'en-US';
                let versification = library.public_getters.getVersification(project.source_language_slug, versification_slug);
                if(versification) {
                    for (let chunk of data) {
                        library.addChunkMarker({
                            chapter: chunk.chp,
                            verse: chunk.firstvs
                        }, project.slug, versification.id);
                    }
                } else {
                    console.error('Unknown versification ' + versification_slug + ' while downloading chunks for project', project);
                }
            });
    };

    /**
     * Downloads the source languages for a project
     * @param project {{}}
     * @returns {Promise}
     */
    const downloadSourceLanguages = function(project) {
        return request.read(project.lang_catalog)
            .then(function(response) {
                // consume language data
                if(response.status !== 200) throw response;

                let data = JSON.parse(response.data);
                let projects = [];
                for(let language of data) {
                    let language_id = library.addSourceLanguage({
                        slug: language.language.slug,
                        name: language.language.name,
                        direction: language.language.direction
                    });

                    project.categories = _.map(project.meta, function(names, slug, index) {
                        return {name: names[index], slug: slug};
                    }.bind(this, language.project.meta));

                    if(project.slug.toLowerCase() !== 'obs') {
                        project.chunks_url = 'https://api.unfoldingword.org/bible/txt/1/' + project.slug + '/chunks.json';
                    }

                    // TODO: retrieve the correct versification name(s) from the source language
                    library.addVersification({
                        slug: 'en-US',
                        name: 'American English'
                    }, language_id);

                    let projectId = library.addProject({
                        slug: project.slug,
                        name: language.project.name,
                        desc: language.project.desc,
                        icon: project.icon,
                        sort: project.sort,
                        chunks_url: project.chunks_url,
                        categories: project.categories,
                    }, language_id);

                    projects.push({
                        id: projectId,
                        chunks_url: project.chunks_url,
                        slug: project.slug,
                        resourceUrl: language.res_catalog,
                        source_language_slug: language.language.slug,
                        source_language_id: language_id
                    });
                }

                // TRICKY: we just flipped the data hierarchy from project->lang to lang->project for future compatibility
                return projects;
            });
    };

    /**
     * Downloads the resources for a source language.
     *
     * @param project {{}}
     * @returns {Promise}
     */
    const downloadSourceResources = function(project) {
        return request.read(project.resourceUrl)
            .then(function(response) {
                // consume resource data
                if(response.status !== 200) throw response;

                let data = JSON.parse(response.data);
                for(let resource of data) {
                    resource.status.translate_mode = resource.slug.toLowerCase() === 'obs' ? 'all' : 'gl';
                    resource.status.pub_date = resource.status.publish_date;
                    resource.formats = [{
                        package_version: rc.tools.spec.version,
                        mime_type: rc.tools.typeToMime('book'),
                        modified_at: resource.date_modified,
                        url: resource.source
                    }];
                    library.addResource(resource, project.id);

                    // coerce notes to resource
                    let helpResource = {
                        slug: 'tn',
                        name: 'translationNotes',
                        status: resource.status,
                        formats: [{
                            package_version: rc.tools.spec.version,
                            mime_type: rc.tools.typeToMime('help'),
                            modified_at: resource.date_modified,
                            url: resource.notes
                        }]
                    };
                    helpResource.status.translate_mode = 'gl';
                    helpResource.status.source_translations = [{
                        language_slug: project.source_language_slug,
                        resource_slug: 'tn',
                        version: resource.status.version
                    }];
                    library.addResource(helpResource, project.id);

                    // coerce questions to resource
                    helpResource.slug = 'tq';
                    helpResource.name = 'translationQuestions';
                    helpResource.formats = [{
                        package_version: rc.tools.spec.version,
                        mime_type: rc.tools.typeToMime('help'),
                        modified_at: resource.date_modified,
                        url: resource.checking_questions
                    }];
                    helpResource.status.source_translations = [{
                        language_slug: project.source_language_slug,
                        resource_slug: 'tq',
                        version: resource.status.version
                    }];
                    library.addResource(helpResource, project.id);

                    // add words project (this is insert/update so it will only be added once)
                    // TRICKY: obs tw has not been unified with bible tw yet so we add it as separate project.
                    let wordsProjectId = library.addProject({
                        slug: project.slug === 'obs' ? 'bible-obs' : 'bible',
                        name: 'translationWords' + (project.slug === 'obs' ? ' OBS' : ''),
                        desc: '',
                        icon: '',
                        sort: 100,
                        chunks_url: '',
                        categories: []
                    }, project.source_language_id);

                    // add resource to words project
                    helpResource.slug = 'tw';
                    helpResource.name = 'translationWords';
                    helpResource.formats = [{
                        package_version: rc.tools.spec.version,
                        mime_type: rc.tools.typeToMime('dict'),
                        modified_at: resource.date_modified,
                        url: resource.terms
                    }];
                    helpResource.status.source_translations = [{
                        language_slug: project.source_language_slug,
                        resource_slug: 'tw',
                        version: resource.status.version
                    }];
                    library.addResource(helpResource, wordsProjectId);
                }
            });
    };

    /**
     * Injects the global catalogs since they are missing from api v2.
     *
     * @returns {Promise}
     */
    const injectGlobalCatalogs = function() {
        library.addCatalog({
            slug: 'langnames',
            url: 'http://td.unfoldingword.org/exports/langnames.json',
            modified_at: 0
        });
        library.addCatalog({
            slug: 'new-language-questions',
            url: 'http://td.unfoldingword.org/api/questionnaire/',
            modified_at: 0
        });
        library.addCatalog({
            slug: 'temp-langnames',
            url: 'http://td.unfoldingword.org/api/templanguages/',
            modified_at: 0
        });
        // library.addCatalog({
        //     slug: 'assigned-temp-langnames',
        //     url: 'http://td.unfoldingword.org/api/templanguages/assignment/',
        //     modified_at: 0
        // });
        library.addCatalog({
            slug: 'approved-temp-langnames',
            url: 'http://td.unfoldingword.org/api/templanguages/assignment/changed/',
            modified_at: 0
        });
        return Promise.resolve();
    };

    /**
     * Indexes the Door43 catalog.
     *
     * @param url {string} the entry resource api catalog
     * @param onProgress {function} an optional progress listener. This should receive progress id, total, completed
     * @returns {Promise}
     */
    const updatePrimaryIndex = function(url, onProgress) {
        onProgress = onProgress || function(){};
        return injectGlobalCatalogs()
            .then(function() {
                library.commit();
               return request.read(url);
            })
            .then(function(response) {
                // disable saves for better performance
                library.autosave(false);
                // index projects and source languages
                if(response.status !== 200) throw response;
                let projects = JSON.parse(response.data);

                return promiseUtils.chain(downloadSourceLanguages, function(err, data) {
                    console.error(err, data);
                    return false;
                }, {compact: true, onProgress: onProgress.bind(null, 'projects')})(projects);
            })
            .then(function(projects) {
                // index chunks
                library.commit();
                if(!projects) throw new Error('No projects found');
                let list = [];

                for(let localizedProjects of projects) {
                    // TRICKY: chunks do not rely on localization so we only need one
                    let project = localizedProjects[0];
                    if(project.slug.toLowerCase() !== 'obs') {
                        list.push(project);
                    }
                }

                return promiseUtils.chain(downloadChunks, function(err, data) {
                    console.error(err, data);
                    return false;
                }, {compact: true, onProgress: onProgress.bind(null, 'chunks')})(list).then(function() {
                    return projects
                });
            })
            .then(function(projects) {
                // index resources
                library.commit();
                if(!projects) throw new Error('No projects found');
                let list = [];
                for(let project of projects) {
                    for(let localizedProject of project) {
                        list.push({
                            id: localizedProject.id,
                            slug: localizedProject.slug,
                            source_language_id: localizedProject.source_language_id,
                            resourceUrl: localizedProject.resourceUrl
                        });
                    }
                }

                return promiseUtils.chain(downloadSourceResources, function(err, data) {
                    console.error(err, data);
                    return false;
                }, {compact: true, onProgress: onProgress.bind(null, 'resources')})(list);
            }).then(function() {
                // keep the promise args clean
                library.commit();
                library.autosave(true);
                return Promise.resolve();
            }).catch(function(err) {
                library.autosave(true);
                return Promise.reject(err);
            });
    };

    /**
     * Downloads a global catalog and indexes it.
     * Note: you may provide a single object parameter if you prefer.
     *
     * @param slug {string|{}} the slug of the catalog to download. Or an object containing all the args.
     * @param onProgress {function} an optional progress listener. This should receive progress id, total, completed
     * @returns {Promise}
     */
    const updateCatalogIndex = function(slug, onProgress) {
        // support passing args as an object
        if(slug != null && typeof slug == 'object') {
            onProgress = slug.onProgress;
            slug = slug.slug;
        }
        onProgress = onProgress || function() {};
        onProgress = onProgress.bind(null, slug);

        return new Promise(function(resolve, reject) {
                try {
                    resolve(library.public_getters.getCatalog(slug));
                } catch(err) {
                    reject(err);
                }
            })
            .then(function(catalog) {
                if(!catalog) throw new Error('Unknown catalog');
                return request.read(catalog.url);
            })
            .then(function(response) {
                if(response.status != 200) throw response;
                return response.data;
            })
            .then(function(data) {
                library.autosave(false);
                if(slug === 'langnames') {
                    return indexTargetLanguageCatalog(data, onProgress);
                } else if(slug === 'new-language-questions') {
                    return indexNewLanguageQuestionsCatalog(data, onProgress);
                } else if(slug === 'temp-langnames') {
                    return indexTempLangsCatalog(data, onProgress);
                } else if(slug === 'approved-temp-langnames') {
                    return indexApprovedTempLangsCatalog(data, onProgress);
                } else {
                    throw new Error('Parsing this catalog has not been implemented');
                }
            })
            .then(function(response) {
                library.commit();
                library.autosave(true);
                return Promise.resolve(response);
            })
            .catch(function(err) {
                library.autosave(true);
                return Promise.reject(err);
            });
    };

    /**
     * Parses the target language catalog and indexes it.
     *
     * @param data {string}
     * @param onProgress {function} an optional progress listener. This should receive progress id, total, completed
     * @returns {Promise}
     */
    const indexTargetLanguageCatalog = function(data, onProgress) {
        onProgress = onProgress || function() {};
        return new Promise(function(resolve, reject) {
            let languages = JSON.parse(data);
            languages.forEach(function(language, index) {
                language.slug = language.lc;
                language.name = language.ln;
                language.anglicized_name = language.ang;
                language.direction = language.ld;
                language.region = language.lr;
                language.country_codes = language.cc || [];
                language.aliases = language.alt || [];
                language.is_gateway_language = language.gl ? language.gl : false;

                try {
                    library.addTargetLanguage(language);
                } catch (err) {
                    console.error('Failed to add target language', language);
                    reject(err);
                    return;
                }
                onProgress(languages.length, index + 1);
            });
            resolve();
        });
    };

    /**
     * Parses the new language questions catalog and indexes it.
     *
     * @param data {string}
     * @param onProgress {function} an optional progress listener. This should receive progress id, total, completed
     * @returns {Promise}
     */
    const indexNewLanguageQuestionsCatalog = function(data, onProgress) {
        onProgress = onProgress || function() {};
        return new Promise(function(resolve, reject) {
            let obj = JSON.parse(data);
            obj.languages.forEach(function(questionnaire, index) {
                // format
                questionnaire.language_slug = questionnaire.slug;
                questionnaire.language_name = questionnaire.name;
                questionnaire.td_id = questionnaire.questionnaire_id;
                questionnaire.language_direction = questionnaire.dir.toLowerCase() === 'rtl' ? 'rtl' : 'ltr';

                try {
                    let id = library.addQuestionnaire(questionnaire);
                    if(id > 0) {
                        // add questions
                        questionnaire.questions.forEach(function(question, n) {
                            // format
                            question.is_required = question.required ? 1 : 0;
                            question.td_id = question.id;

                            try {
                                library.addQuestion(question, id);
                            } catch (err) {
                                console.error('Failed to add question', question);
                                reject(err);
                                return;
                            }
                            // broadcast itemized progress if there is only one questionnaire
                            if(obj.languages.length == 1) {
                                onProgress(questionnaire.questions.length, n + 1);
                            }
                        });
                    } else {
                        console.error('Failed to add questionnaire', questionnaire);
                    }
                } catch (err) {
                    console.error('Failed to add questionnaire', questionnaire);
                    reject(err);
                    return;
                }
                // broadcast overall progress if there are multiple questionnaires.
                if(obj.languages.length > 1) {
                    onProgress(obj.languages.length, index + 1);
                }
            });
            resolve();
        });
    };

    /**
     * Parses the temporary language codes catalog and indexes it.
     *
     * @param data {string}
     * @param onProgress {function} an optional progress listener. This should receive progress id, total, completed
     * @returns {Promise}
     */
    const indexTempLangsCatalog = function(data, onProgress) {
        onProgress = onProgress || function() {};
        return new Promise(function(resolve, reject) {
            let languages = JSON.parse(data);
            languages.forEach(function(language, index) {
                // format
                language.slug = language.lc;
                language.name = language.ln;
                language.anglicized_name = language.ang;
                language.direction = language.ld;
                language.region = language.lr;
                language.country_codes = language.cc || [];
                language.aliases = language.alt || [];
                language.is_gateway_language = language.gl ? language.gl : false;

                try {
                    library.addTempTargetLanguage(language);
                } catch (err) {
                    console.error('Failed to add temporary target language', language);
                    reject(err);
                    return;
                }
                onProgress(languages.length, index + 1);
            });
            resolve();
        });
    };

    /**
     * Parses the approved temporary language codes catalog and indexes it.
     *
     * @param data {string}
     * @param onProgress {function} an optional progress listener. This should receive progress id, total, completed
     * @returns {Promise}
     */
    const indexApprovedTempLangsCatalog = function(data, onProgress) {
        onProgress = onProgress || function() {};
        return new Promise(function(resolve, reject) {
            let languages = JSON.parse(data);
            languages.forEach(function(language, index) {
                try {
                    let tempCode = Object.keys(language)[0];
                    library.setApprovedTargetLanguage(tempCode, language[tempCode]);
                } catch (err) {
                    console.error('Failed to set the approved language code', language);
                    reject(err);
                    return;
                }
                onProgress(languages.length, index + 1);
            });
            resolve();
        });
    };

    /**
     * Returns the first resource container format found in the list.
     * E.g. the array may contain binary formats such as pdf, mp3, etc. This basically filters those.
     *
     * @param formats {[]} an array of resource formats
     * @returns {{}} the resource container format
     */
    const getResourceContainerFormat = function(formats) {
        for(let format of formats) {
            if(format.mime_type.match(/application\/ts\+.+/)) {
                return format;
            }
        }
        return null;
    };

    /**
     * Downloads a resource container.
     * Note: You may provide a single object parameter if you prefer
     *
     * TRICKY: to keep the interface stable we've abstracted some things.
     * once the api supports real resource containers this entire method can go away and be replace
     * with downloadContainer_Future (which should be renamed to downloadContainer).
     * convertLegacyResourceToContainer will also become deprecated at that time though it may be handy to keep around.
     *
     * @param languageSlug {string}
     * @param projectSlug {string}
     * @param resourceSlug {string}
     * @returns {Promise.<Container>} The new container
     */
    const downloadContainer = function(languageSlug, projectSlug, resourceSlug) {
        // support passing args as an object
        if(languageSlug != null && typeof languageSlug == 'object') {
            resourceSlug = languageSlug.resourceSlug;
            projectSlug = languageSlug.projectSlug;
            languageSlug = languageSlug.languageSlug;
        }

        // get the legacy data as if it were a real resource container
        return downloadContainer_Future(languageSlug, projectSlug, resourceSlug)
            .then(function(path) {
                // migrate to resource container
                let resource = library.public_getters.getResource(languageSlug, projectSlug, resourceSlug);
                if(!resource) throw new Error('Unknown resource');
                let containerType = getResourceContainerType(resource);
                let data = fs.readFileSync(path).toString();
                // clean downloaded file
                rimraf.sync(path);
                return convertLegacyResourceToContainer(languageSlug, projectSlug, containerType, resourceSlug, data);
            });
    };

    /**
     * Downloads a resource container.
     * This expects a correctly formatted resource container
     * and will download it directly to the disk
     *
     * Note: You may provide a single object parameter if you prefer
     *
     * once the api can deliver proper resource containers this method
     * should be renamed to downloadContainer
     *
     * @param languageSlug {string}
     * @param projectSlug {string}
     * @param resourceSlug {string}
     * @returns {Promise.<String>} the path to the downloaded resource container
     */
    const downloadContainer_Future = function(languageSlug, projectSlug, resourceSlug) {
        // support passing args as an object
        if(languageSlug != null && typeof languageSlug == 'object') {
            resourceSlug = languageSlug.resourceSlug;
            projectSlug = languageSlug.projectSlug;
            languageSlug = languageSlug.languageSlug;
        }

        let destFile;
        return new Promise(function(resolve, reject) {
                try {
                    resolve(library.public_getters.getResource(languageSlug, projectSlug, resourceSlug));
                } catch(err) {
                    reject(err);
                }
            })
            .then(function(resource) {
                if(!resource) throw new Error('Unknown resource');
                let containerType = getResourceContainerType(resource);
                let containerFormat = getResourceContainerFormat(resource.formats);
                let containerSlug = rc.tools.makeSlug(languageSlug, projectSlug, containerType, resourceSlug);
                destFile = path.join(resourceDir, containerSlug + '.' + rc.tools.spec.file_ext);

                if(fileUtils.fileExists(destFile)) throw new Error('Resource container already exists');

                mkdirp(path.dirname(destFile));
                if(!containerFormat.url) throw new Error('Missing resource format url');
                return request.download(containerFormat.url, destFile);
            })
            .then(function(response) {
                if(response.status !== 200) {
                    rimraf.sync(destFile);
                    throw response;
                }
                return destFile;
            });
    };

    /**
     * Converts a legacy resource catalog into a resource container.
     * The container will be placed in.
     *
     * This will be deprecated once the api is updated to support proper resource containers.
     *
     * @param languageSlug {string}
     * @param projectSlug {string}
     * @param containerType {string} the type of resource container that will be generated
     * @param resourceSlug {string}
     * @param data {string} the legacy data that will be converted
     * @return {Promise.<Container>}
     */
    const convertLegacyResourceToContainer = function(languageSlug, projectSlug, containerType, resourceSlug, data) {
        let containerSlug = rc.tools.makeSlug(languageSlug, projectSlug, containerType, resourceSlug);
        let dir = path.join(resourceDir, containerSlug);

        return new Promise(function(resolve, reject) {
                let props = {
                    close: true,
                    container_type: containerType
                };

                props.language = library.public_getters.getSourceLanguage(languageSlug);
                if(!props.language) {
                    reject(new Error('Missing language'));
                    return;
                }
                props.project = library.public_getters.getProject(languageSlug, projectSlug);
                if(!props.project) {
                    reject(new Error('Missing project'));
                    return;
                }
                props.resource = library.public_getters.getResource(languageSlug, projectSlug, resourceSlug);
                if(!props.resource) {
                    reject(new Error('Missing resource'));
                    return;
                }

                let format = getResourceContainerFormat(props.resource.formats);
                props.resource.modified_at = format && format.modified_at ? format.modified_at : 0;

                delete props.language.id;
                delete props.project.id;
                delete props.project.source_language_id;
                delete props.project.source_language_slug;
                delete props.resource.id;
                delete props.resource.project_id;
                delete props.resource.source_language_slug;
                delete props.resource.project_slug;
                delete props.resource.formats;

                resolve(props);
            })
            .then(function(props) {
                return rc.tools.convertResource(data, dir, props, opts);
            });
    };

    /**
     * Opens a resource container archive so it's contents can be read.
     * The index will be referenced to validate the resource and retrieve the container type.
     *
     * @param languageSlug {string}
     * @param projectSlug {string}
     * @param resourceSlug {string}
     * @returns {Promise.<Container>}
     */
    const openContainer = function(languageSlug, projectSlug, resourceSlug) {
        return new Promise(function(resolve, reject) {
                try {
                    resolve(library.public_getters.getResource(languageSlug, projectSlug, resourceSlug));
                } catch(err) {
                    reject(err);
                }
            })
            .then(function(resource) {
                if(!resource) throw new Error('Unknown resource');
                let containerType = getResourceContainerType(resource);
                let containerSlug = rc.tools.makeSlug(languageSlug, projectSlug, containerType, resourceSlug);
                let directory = path.join(resourceDir, containerSlug);
                let archive = directory + '.' + rc.tools.spec.file_ext;
                return rc.open(archive, directory, opts);
            });
    };

    /**
     * Closes a resource container archive.
     *
     * @param languageSlug {string}
     * @param projectSlug {string}
     * @param resourceSlug {string}
     * @returns {Promise.<string>} the path to the closed container
     */
    const closeContainer = function(languageSlug, projectSlug, resourceSlug) {
        return new Promise(function(resolve, reject) {
                try {
                    resolve(library.public_getters.getResource(languageSlug, projectSlug, resourceSlug));
                } catch(err) {
                    reject(err);
                }
            })
            .then(function(resource) {
                if(!resource) throw new Error('Unknown resource');
                let containerType = getResourceContainerType(resource);
                let containerSlug = rc.tools.makeSlug(languageSlug, projectSlug, containerType, resourceSlug);
                let directory = path.join(resourceDir, containerSlug);
                return rc.close(directory, opts);
            });
    };

    /**
     * Returns a list of resource containers that have been downloaded
     * @returns {Promise.<[{}]>} an array of resource container info objects (package.json).
     */
    const listResourceContainers = function() {
        return new Promise(function(resolve, reject) {
            try {
                let files;
                if(fileUtils.fileExists(resourceDir)) {
                    files = fs.readdirSync(resourceDir);
                    files = _.uniqBy(files, function (f) {
                        return path.basename(f, '.' + rc.tools.spec.file_ext);
                    }).map(function(f) { return path.join(resourceDir, f);});
                }
                if(!files) files = [];
                resolve(files);
            } catch (err) {
                reject(err);
            }
        }).then(function(files) {
            return promiseUtils.chain(rc.tools.inspect, function(err) {
                console.error(err);
                return false;
            })(files);
        });
    };

    /**
     * Prepares a list of items that are eligible for updates.
     * Note: This is different than what's available for download. Everything in the index is technically available for download.
     *
     * Eligibility is determined by:
     * * available items who's modified_at exceeds the local equivalent
     * * available items who's modified_at is 0 and accompanying local item's modified_at is 0
     *
     * @param local {{}} keyed object of local (downloaded) items.
     * @param available {[{slug, modified_at}]} an array of available (indexed) items
     * @returns {Promise.<Array>}
     */
    const inferUpdates = function(local, available) {
        let updates = [];
        for(var a of available) {
            try {
                if (a.modified_at > local[a.slug]
                    || (a.modified_at == 0 && local[a.slug] == 0)) updates.push(a.slug);
            } catch(err) {
                console.error(err);
            }
        }
        return Promise.resolve(updates);
    };

    /**
     * Returns a list of source languages that are eligible for updates.
     *
     * @returns {Promise.<Array>} An array of slugs
     */
    const listSourceLanguageUpdates = function() {
        return new Promise(function(resolve, reject) {
            try{
                resolve(library.listSourceLanguagesLastModified());
            } catch (err) {
                reject(err);
            }
        }).then(function(languages) {
            return listResourceContainers()
                .then(function(results) {
                    // flatten modified_at
                    let local = {};
                    for(var info of results) {
                        try {
                            if(!local[info.language.slug]) local[info.language.slug] = -1;
                            let old = local[info.language.slug];
                            local[info.language.slug] = info.modified_at > old ? info.modified_at : old;
                        } catch (err) {
                            console.error(err);
                        }
                    }
                    return inferUpdates(local, languages);
                });
        });
    };

    /**
     * Returns a list of projects that are eligible for updates.
     * If no language is given the results will include all projects in all languages. This is helpful if you need to view updates based on project first rather than source language first.
     *
     * @param languageSlug {string|null} the slug of a source language who's projects will be checked.
     * @returns {Promise.<Array>} An array of slugs
     */
    const listProjectUpdates = function(languageSlug) {
       return new Promise(function(resolve, reject) {
            try{
                resolve(library.listProjectsLastModified(languageSlug));
            } catch (err) {
                reject(err);
            }
        }).then(function(projects) {
            return listResourceContainers()
                .then(function(results) {
                    // flatten modified_at
                    let local = {};
                    for(var info of results) {
                        try {
                            if(languageSlug && info.language.slug !== languageSlug) continue;
                            if(!local[info.project.slug]) local[info.project.slug] = -1;
                            let old = local[info.project.slug];
                            local[info.project.slug] = info.modified_at > old ? info.modified_at : old;
                        } catch (err) {
                            console.error(err);
                        }
                    }
                    return inferUpdates(local, projects);
                });
        });
    };

    return {
        updatePrimaryIndex: updatePrimaryIndex,
        updateCatalogIndex: updateCatalogIndex,
        downloadResourceContainer: downloadContainer,
        legacy_tools: {
            downloadFutureCompatibleResourceContainer: downloadContainer_Future,
            convertResource: convertLegacyResourceToContainer
        },
        openResourceContainer: openContainer,
        closeResourceContainer: closeContainer,
        listResourceContainers: listResourceContainers,
        findUpdates: {
            sourceLanguages:listSourceLanguageUpdates,
            projects:listProjectUpdates
        },
        index: index
    };
}

module.exports = Client;