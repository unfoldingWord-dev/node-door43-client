const request = require('./request'),
    mkdirp = require('mkdirp'),
    path = require('path'),
    _ = require('lodash'),
    utils = require('./utils'),
    fs = require('fs'),
    SqliteHelper = require('./sqlite-helper'),
    Library = require('./library'),
    YAML = require('yamljs');

/**
 * Initializes a new api client
 * @param dbPath the path to the db where information will be indexed.
 * @param resourceDir the directory where resources will be stored
 * @returns {API}
 * @constructor
 */
function API(dbPath, resourceDir) {
    mkdirp.sync(resourceDir);

    const helper = new SqliteHelper('./lib/schema.sqlite', dbPath);
    const library = new Library(helper);

    /**
     * Returns the read only index
     * @returns {*}
     */
    var index = {};
    for(method in library.getters) {
        index[method] = utils.promisify(library.getters[method]);
    }

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

                var data = JSON.parse(response.data);
                var projects = [];
                for(var language of data) {
                    var language_id = library.addSourceLanguage({
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

                    var projectId = library.addProject({
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
                        resourceUrl: language.res_catalog
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

                var data = JSON.parse(response.data);
                for(var resource of data) {
                    resource.translate_mode = resource.slug.toLowerCase() === 'obs' ? 'all' : 'gl';
                    resource.status.pub_date = resource.status.publish_date;
                    resource.formats = [{
                        syntax_version: '1.0',
                        mime_type: 'application/ts+book',
                        modified_at: resource.date_modified,
                        url: resource.source
                    }];
                    library.addResource(resource, project.id);
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
     * @returns {Promise}
     */
    const updateIndex = function(url) {
        return injectGlobalCatalogs()
            .then(function() {
               return request.read(url);
            })
            .then(function(response) {
                // index projects and source languages
                if(response.status !== 200) throw response;
                var projects = JSON.parse(response.data);

                return utils.chain(downloadSourceLanguages, function(err, data) {
                    console.err(err);
                    return false;
                })(projects);
            })
            .then(function(projects) {
                // index resources
                if(!projects) throw new Error('No projects found');
                var list = [];
                for(var project of projects) {
                    for(var localizedProject of project) {
                        list.push({
                            id: localizedProject.id,
                            slug: localizedProject.slug,
                            resourceUrl: localizedProject.resourceUrl
                        });
                    }
                }

                return utils.chain(downloadSourceResources, function(err, data) {
                    console.error(err);
                    return false;
                })(list);
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
        return this.index.getCatalog(slug)
            .then(function(catalog) {
                if(!catalog) throw new Error('Unknown catalog');
                return request.read(catalog.url);
            })
            .then(function(response) {
                if(response.status != 200) throw response;
                var languages = JSON.parse(response.data);
                for(var language of languages) {
                    language.gl = language.gl ? language.gl : false;
                    library.addTargetLanguage(language);
                }
            });
    };

    /**
     * Returns the first resource container format found in the list
     * @param formats an array of resource formats
     */
    const getResourceContainerFormat = function(formats) {
        for(var format of formats) {
            if(format.mime_type.match(/application\/ts\+.+/)) {
                return format;
            }
        }
        return null;
    };

    /**
     * Downloads a resource container
     * @param languageSlug
     * @param projectSlug
     * @param resourceSlug
     * @returns {Promise}
     */
    const downloadResourceContainer = function(languageSlug, projectSlug, resourceSlug) {
        return this.index.getResource(languageSlug, projectSlug, resourceSlug)
            .then(function(resource) {
                if(!resource) throw new Error('Unknown resource');
                if(resource && resource.formats) {
                    var format = getResourceContainerFormat(resource.formats);
                    if(format == null) throw new Error('Missing resource container format');

                    var dest = path.join(resourceDir, languageSlug + '_' + projectSlug + '_' + resourceSlug + '.json');
                    mkdirp(path.dirname(dest));

                    return request.download(format.url, dest);
                }
            })
            .then(function(response) {
                if(response.status !== 200) throw response;
                // todo: make sure everything worked and set up resource container correctly
            });
    };

    /**
     * Converts a legacy resource catalog into a resource container
     * The container will be placed in
     * @param languageSlug
     * @param projectSlug
     * @param containerType the type of resource container that will be generated
     * @param resourceSlug
     * @param data the legacy data that will be converted
     */
    const makeResourceContainer = function(languageSlug, projectSlug, containerType, resourceSlug, data) {
        var containerId = languageSlug + '_' + projectSlug + '_' + containerType + '_' + resourceSlug;
        var dir = path.join(resourceDir, containerId);
        var langauge;
        var project;
        var resource;
        const writeFile = utils.promisify(fs, 'writeFile');
        const mimeType = projectSlug !== 'obs' && containerType === 'book' ? 'text/usfm' : 'text/markdown';
        const ext = mimeType === 'text/usfm' ? 'usfm' : 'md';

        return new Promise(function(resolve, reject) {
                try {
                    fs.statSync(dir);
                    reject(new Error('Resource container already exists'));
                } catch(err) {
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
                var packageData = {
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
                        var contentDir = path.join(dir, 'content');
                        mkdirp.sync(contentDir);
                        switch (containerType) {
                            case 'book':
                                if (projectSlug === 'obs') {
                                    // add obs images
                                    var configPath = path.join(contentDir, 'config.yml');
                                    var config = {};
                                    try {
                                        var configBytes = fs.readFileSync(configPath);
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
                                for (var chapter of data.chapters) {
                                    var chapterDir = path.join(contentDir, chapter.number);
                                    mkdirp.sync(chapterDir);
                                    if (chapter.ref) {
                                        fs.writeFileSync(path.join(chapterDir, '_reference.' + ext), chapter.ref)
                                    }
                                    if (chapter.title) {
                                        fs.writeFileSync(path.join(chapterDir, '_title.' + ext), chapter.title)
                                    }
                                    for (var frame of chapter.frames) {
                                        fs.writeFileSync(path.join(chapterDir, frame.id.split('-')[1]), frame.text);
                                    }
                                }
                                break;
                        }
                    } catch(err) {
                        reject(err);
                    }
                    resolve();
                });
            });
    };

    return {
        updateIndex: updateIndex,
        downloadCatalog: downloadCatalog,
        downloadResourceContainer: downloadResourceContainer,
        makeResourceContainer: makeResourceContainer,
        index: index
    };
}

module.exports = API;