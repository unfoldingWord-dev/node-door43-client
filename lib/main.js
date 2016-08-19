'use strict';

const request = require('./request'),
    mkdirp = require('mkdirp'),
    path = require('path'),
    _ = require('lodash'),
    promiseUtils = require('./utils/promises'),
    compressionUtils = require('./utils/compression'),
    fileUtils = require('./utils/files'),
    fs = require('fs'),
    SqliteHelper = require('./sqlite-helper'),
    rimraf = require('rimraf'),
    Library = require('./library'),
    YAML = require('yamljs');

/**
 * Initializes a new api client
 * @param dbPath the path to the db where information will be indexed.
 * @param resourceDir the directory where resources will be stored
 * @opts advanced options. compression_method: the type of compression to use for resource containers [tar|zip].
 * @returns {API}
 * @constructor
 */
function API(dbPath, resourceDir, opts) {
    mkdirp.sync(resourceDir);
    opts = opts || {compression_method: 'tar'};

    const helper = new SqliteHelper('./lib/schema.sqlite', dbPath);
    const library = new Library(helper);
    // highly compressed containers are 'ts' and regular zipped containers are 'tstudio'
    // TODO: we will likely settle on a single extension and compression method
    const containerExt = opts.compression_method === 'tar' ? 'ts' : 'tstudio';

    /**
     * Returns the read only index
     * @returns {*}
     */
    let index = {};
    for(var method in library.getters) {
        index[method] = promiseUtils.promisify(library.getters[method]);
    }

    /**
     * Extracts a compressed resource container to the destination
     * @param file the compressed resource container to be extracted
     * @param dest the directory to which the resource container will be extracted
     * @returns {Promise<String>} the path to the destination directory
     */
    const extractContainer = function(file, dest) {
        if(opts.compression_method === 'zip') {
            return compressionUtils.unzip(file, dest);
        } else {
            return compressionUtils.untar(file, dest);
        }
    };

    /**
     * Compresses a resource container
     * @param dir the resource container directory to be compressed
     * @returns {Promise<String>} the path to the compressed file
     */
    const compressContainer = function(dir) {
        if(opts.compression_method === 'zip') {
            return compressionUtils.zip(dir, dir + '.' + containerExt);
        } else {
            return compressionUtils.tar(dir, dir + '.' + containerExt);
        }
    };

    /**
     * Creates a properly formatted container id
     * @param languageSlug
     * @param projectSlug
     * @param containerType
     * @param resourceSlug
     * @returns {string}
     */
    const buildContainerId = function(languageSlug, projectSlug, containerType, resourceSlug) {
        return languageSlug + '_' + projectSlug + '_' + containerType + '_' + resourceSlug;
    };

    /**
     * Retrieves the container type from a resource.
     *
     * @param resource
     * @returns {*}
     * @throws one of several exceptions if data is missing
     */
    const getContainerType = function(resource) {
        if(!resource.formats) throw new Error('Missing resource formats');
        let containerFormat = getResourceContainerFormat(resource.formats);
        if(!containerFormat) throw new Error('Missing resource container format');
        return containerFormat.mime_type.split('+')[1];
    };

    /**
     * Downloads the source languages for a project
     * @param project
     * @returns {Promise.<{}[]>}
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

                    let projectId = library.addProject({
                        slug: project.slug,
                        name: language.project.name,
                        desc: language.project.desc,
                        icon: project.icon,
                        sort: project.sort,
                        chunks_url: project.chunks_url,
                        categories: project.categories,
                    }, language_id);

                    // TODO: index the chunks

                    projects.push({
                        id: projectId,
                        slug: project.slug,
                        resourceUrl: language.res_catalog,
                        source_language_id: language_id
                    });
                }

                // TRICKY: we just flipped the data hierarchy from project->lang to lang->project for future compatibility
                return projects;
            });
    };

    /**
     * Downloads the resources for a source language
     * @param project
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
                        syntax_version: '1.0',
                        mime_type: 'application/ts+book',
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
                            syntax_version: '1.0',
                            mime_type: 'application/ts+help',
                            mod: resource.date_modified,
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
                        syntax_version: '1.0',
                        mime_type: 'application/ts+help',
                        mod: resource.date_modified,
                        url: resource.checking_questions
                    }];
                    helpResource.status.source_translations = [{
                        language_slug: project.source_language_slug,
                        resource_slug: 'tq',
                        version: resource.status.version
                    }];
                    library.addResource(helpResource, project.id);

                    // add words project (this is insert/update so it will only be added once)
                    let wordsProjectId = library.addProject({
                        slug: 'bible',
                        name: 'translationWords',
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
                        syntax_version: '1.0',
                        mime_type: 'application/ts+dict',
                        mod: resource.date_modified,
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
     * Injects the global catalogs since they are missing from api v2
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
        return Promise.resolve();
    };

    /**
     * Indexes the Door43 catalog
     * @param url the entry resource api catalog
     * @param onProgress an optional progress listener
     * @returns {Promise}
     */
    const updateIndex = function(url, onProgress) {
        return injectGlobalCatalogs()
            .then(function() {
               return request.read(url);
            })
            .then(function(response) {
                // index projects and source languages
                if(response.status !== 200) throw response;
                let projects = JSON.parse(response.data);

                return promiseUtils.chain(downloadSourceLanguages, function(err, data) {
                    console.err(err);
                    return false;
                })(projects);
            })
            .then(function(projects) {
                // index resources
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
                    console.error(err);
                    return false;
                }, {compact: true, onProgress: onProgress})(list);
            }).then(function() {
                // keep the promise args clean
                return Promise.resolve();
            });
    };

    /**
     * Downloads a global catalog and indexes it
     * @param slug the catalog to download
     * @returns {Promise}
     */
    const downloadCatalog = function(slug) {
        return new Promise(function(resolve, reject) {
                resolve(library.getters.getCatalog(slug));
            })
            .then(function(catalog) {
                if(!catalog) throw new Error('Unknown catalog');
                return request.read(catalog.url);
            })
            .then(function(response) {
                if(response.status != 200) throw response;
                let languages = JSON.parse(response.data);
                for(let language of languages) {
                    language.gl = language.gl ? language.gl : false;
                    library.addTargetLanguage(language);
                }
            });
    };

    /**
     * Returns the first resource container format found in the list.
     * Note: each resource will only have one resource container format
     * @param formats an array of resource formats
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
     * makeResourceContainer will also become deprecated at that time though it may be handy to keep around.
     *
     * @param languageSlug
     * @param projectSlug
     * @param resourceSlug
     * @returns {Promise}
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
                let resource = library.getters.getResource(languageSlug, projectSlug, resourceSlug);
                if(!resource) throw new Error('Unknown resource');
                let containerType = getContainerType(resource);
                let data = fs.readFileSync(path).toString();
                // clean downloaded file
                rimraf.sync(path);
                return makeContainer(languageSlug, projectSlug, containerType, resourceSlug, data);
            });
    };

    /**
     * Downloads a resource container.
     * This expects a correctly formatted resource container
     * and will download it directly to the disk
     *
     * once the api can deliver proper resource containers this method
     * should be renamed to downloadContainer
     *
     * @param languageSlug
     * @param projectSlug
     * @param resourceSlug
     * @returns {Promise.<String>} the path to the downloaded resource container
     */
    const downloadContainer_Future = function(languageSlug, projectSlug, resourceSlug) {
        let destFile;
        return new Promise(function(resolve, reject) {
                resolve(library.getters.getResource(languageSlug, projectSlug, resourceSlug));
            })
            .then(function(resource) {
                if(!resource) throw new Error('Unknown resource');
                let containerType = getContainerType(resource);
                let containerFormat = getResourceContainerFormat(resource.formats);
                let containerId = buildContainerId(languageSlug, projectSlug, containerType, resourceSlug);
                destFile = path.join(resourceDir, containerId + '.' + containerExt);

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
     * Converts a legacy resource catalog into a resource container
     * The container will be placed in.
     *
     * This will be deprecated once the api is updated to support proper resource containers
     *
     * @param languageSlug
     * @param projectSlug
     * @param containerType the type of resource container that will be generated
     * @param resourceSlug
     * @param data the legacy data that will be converted
     * @return {Promise<>}
     */
    const makeContainer = function(languageSlug, projectSlug, containerType, resourceSlug, data) {
        let containerId = languageSlug + '_' + projectSlug + '_' + containerType + '_' + resourceSlug;
        let dir = path.join(resourceDir, containerId);
        let language;
        let project;
        let resource;
        const writeFile = promiseUtils.promisify(fs, 'writeFile');
        const mimeType = projectSlug !== 'obs' && containerType === 'book' ? 'text/usfm' : 'text/markdown';
        const ext = mimeType === 'text/usfm' ? 'usfm' : 'md';

        return new Promise(function(resolve, reject) {
                if(fileUtils.fileExists(path.join(dir + '.' + containerExt))) {
                    reject(new Error('Resource container already exists'));
                } else {
                    // clean opened container
                    rimraf.sync(dir);
                    resolve();
                }
            })
            .then(function() {
                language = library.getters.getSourceLanguage(languageSlug);
                if(!language) throw new Error('Missing language');
                project = library.getters.getProject(languageSlug, projectSlug);
                if(!project) throw new Error('Missing project');
                resource = library.getters.getResource(languageSlug, projectSlug, resourceSlug);
                if(!resource) throw new Error('Missing resource');

                delete language.id;
                delete project.id;
                delete project.source_language_id;
                delete project.source_language_slug;
                delete resource.id;
                delete resource.project_id;
                delete resource.source_language_slug;
                delete resource.project_slug;
                delete resource.formats;
            })
            .then(function() {
                // package
                mkdirp.sync(dir);
                let packageData = {
                    syntax_version: '1.0',
                    type: containerType,
                    content_mime_type: mimeType,
                    language: language,
                    project: project,
                    resource: resource,
                    chunk_status: []
                };
                return writeFile(path.join(dir, 'package.json'), new Buffer(JSON.stringify(packageData, null, 2)));
            })
            .then(function() {
                // license
                // TODO: use a proper license based on the resource license
                return writeFile(path.join(dir, 'LICENSE.md'), new Buffer(resource.status.license));
            })
            .then(function() {
                // content
                return new Promise(function(resolve, reject) {
                    try {
                        let contentDir = path.join(dir, 'content');
                        mkdirp.sync(contentDir);
                        if(containerType === 'book') {
                            if (projectSlug === 'obs') {
                                // add obs images
                                let configPath = path.join(contentDir, 'config.yml');
                                let config = {};
                                try {
                                    let configBytes = fs.readFileSync(configPath);
                                    config = YAML.parse(configBytes.toString());
                                } catch (err) {}
                                if(!config['media']) config['media'] = {};
                                config['media']['image'] = {
                                    mime_type: 'image/jpg',
                                    size: 37620940,
                                    url: 'https://api.unfoldingword.org/obs/jpg/1/en/obs-images-360px.zip'
                                };
                                fs.writeFileSync(configPath, new Buffer(YAML.stringify(config, 4)));
                            }
                            data = JSON.parse(data);
                            for (let chapter of data.chapters) {
                                let chapterDir = path.join(contentDir, chapter.number);
                                mkdirp.sync(chapterDir);
                                if (chapter.ref) {
                                    fs.writeFileSync(path.join(chapterDir, '_reference.' + ext), chapter.ref)
                                }
                                if (chapter.title) {
                                    fs.writeFileSync(path.join(chapterDir, '_title.' + ext), chapter.title)
                                }
                                for (let frame of chapter.frames) {
                                    fs.writeFileSync(path.join(chapterDir, frame.id.split('-')[1] + '.' + ext), frame.text);
                                }
                            }
                        } else if(containerType === 'help') {
                            if(resource.slug === 'tn') {
                                data = JSON.parse(data);
                                for(let chunk of data) {
                                    if(!chunk.tn) continue;
                                    let slugs = chunk.id.split('-');
                                    if(slugs.length !== 2) continue;

                                    let chapterDir = path.join(contentDir, slugs[0]);
                                    mkdirp.sync(chapterDir);
                                    let body = '';
                                    for(let note of chunk.tn) {
                                        body += '\n\n#' + note.ref + '\n\n' + note.text;
                                    }
                                    fs.writeFileSync(path.join(chapterDir, slugs[1] + '.' + ext), body.trim());
                                }
                            } else if(resource.slug == 'tq') {
                                data = JSON.parse(data);
                                for(let chapter of data) {
                                    if(!chapter.cq) continue;
                                    let chapterDir = path.join(contentDir, chapter.id);
                                    mkdirp.sync(chapterDir);
                                    let normalizedChunks = {};
                                    for(let question of chapter.cq) {
                                        let text = '\n\n#' + question.q + '\n\n' + question.a;
                                        for(let slug of question.ref) {
                                            let slugs = slug.split('-');
                                            if(slugs.length !== 2) continue;

                                            if(!normalizedChunks[slugs[1]]) normalizedChunks[slugs[1]] = '';
                                            normalizedChunks[slugs[1]] += text;
                                        }
                                    }
                                    for(let chunk in normalizedChunks) {
                                        fs.writeFileSync(path.join(chapterDir, chunk + '.' + ext), normalizedChunks[chunk].trim())
                                    }
                                }
                            }
                        } else if(containerType === 'dict') {
                            // TODO: convert dict
                        } else {
                            reject(new Error('Unsupported resource container type ' + containerType));
                        }
                    } catch(err) {
                        reject(err);
                    }
                    resolve();
                });
            })
            .then(function() {
                return compressContainer(dir);
            })
            .then(function() {
                // clean opened container
                rimraf.sync(dir);
                return Promise.resolve();
            })
            .catch(function(err) {
                // clean up after an error
                rimraf.sync(dir);
                return Promise.reject(err);
            });
    };

    /**
     * Opens a resource container archive so it's contents can be read.
     * The index will be referenced to validate the resource and retrieve the container type
     *
     * @param languageSlug
     * @param projectSlug
     * @param resourceSlug
     */
    const openContainer = function(languageSlug, projectSlug, resourceSlug) {
        return new Promise(function(resolve, reject) {
                resolve(library.getters.getResource(languageSlug, projectSlug, resourceSlug));
            })
            .then(function(resource) {
                if(!resource) throw new Error('Unknown resource');
                let containerType = getContainerType(resource);
                let containerId = buildContainerId(languageSlug, projectSlug, containerType, resourceSlug);
                let openContainerFile = path.join(resourceDir, containerId);
                let closedContainerFile = openContainerFile + '.' + containerExt;
                if(!fileUtils.fileExists(closedContainerFile)) throw new Error('Missing resource container');
                return extractContainer(closedContainerFile, openContainerFile);
            });
    };

    /**
     * Closes a resource container archive
     * @param languageSlug
     * @param projectSlug
     * @param resourceSlug
     * @returns {Promise}
     */
    const closeContainer = function(languageSlug, projectSlug, resourceSlug) {
        return new Promise(function(resolve, reject) {
                resolve(library.getters.getResource(languageSlug, projectSlug, resourceSlug));
            })
            .then(function(resource) {
                if(!resource) throw new Error('Unknown resource');
                let containerType = getContainerType(resource);
                let containerId = buildContainerId(languageSlug, projectSlug, containerType, resourceSlug);
                let openContainerFile = path.join(resourceDir, containerId);
                let closedContainerFile = openContainerFile + '.' + containerExt;

                // re-compress if closed container is missing
                if(!fileUtils.fileExists(closedContainerFile) && fileUtils.fileExists(openContainerFile)) {
                    return compressContainer(openContainerFile)
                        .then(function() {
                            rimraf.sync(openContainerFile);
                        });
                } else {
                    rimraf.sync(openContainerFile);
                }
            });
    };

    return {
        updateIndex: updateIndex,
        downloadCatalog: downloadCatalog,
        downloadResourceContainer: downloadContainer,
        downloadFutureCompatibleResourceContainer: downloadContainer_Future,
        makeResourceContainer: makeContainer,
        openResourceContainer: openContainer,
        closeResourceContainer: closeContainer,
        index: index
    };
}

module.exports = API;