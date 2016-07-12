const request = require('./request'),
    mkdirp = require('mkdirp'),
    path = require('path'),
    utils = require('./utils'),
    SqliteHelper = require('./sqlite-helper'),
    Library = require('./library');

/**
 * Initializes a new api client
 * @param dbPath the path to the db where information will be indexed.
 * @param resourceDir the directory where resources will be stored
 * @returns {API}
 * @constructor
 */
function API(dbPath, resourceDir) {
    mkdirp.sync(resourceDir);

    const _this = this;
    const helper = new SqliteHelper('./lib/schema.sqlite', dbPath);
    const library = new Library(helper);
    this.index = {};

    const downloadSourceLanguages = function(project) {
        return request.read(project.lang_catalog)
            .then(function(response) {
                process.stdout.write('.');
                // consume language data
                if(response.status !== 200) return;

                var data = JSON.parse(response.data);
                var projects = [];
                for(var language of data) {
                    var language_id = library.addSourceLanguage({
                        slug: language.language.slug,
                        name: language.language.name,
                        dir: language.language.direction
                    });
                    var projectId = library.addProject({
                        slug: project.slug,
                        name: language.project.name,
                        desc: language.project.desc,
                        icon: project.icon,
                        sort: project.sort,
                        chunks_url: project.chunks_url
                    }, language_id);

                    projects.push({
                        id: projectId,
                        slug: project.slug,
                        resourceUrl: language.res_catalog
                    });
                }

                // TRICKY: we just the data hierarchy from lang->project to project->lang for future compatibility
                return projects;
            });
    };

    const downloadSourceResources = function(project) {
        return request.read(project.resourceUrl)
            .then(function(response) {
                process.stdout.write('.');
                // consume resource data
                if(response.status !== 200) return;

                var data = JSON.parse(response.data);
                for(var resource of data) {
                    resource.translate_mode = resource.slug.toLowerCase() === 'obs' ? 'all' : 'gl';
                    resource.formats = [{
                        syntax_version: '1.0',
                        'mime_type': 'application/ts+book',
                        'mod': resource.date_modified,
                        'url': resource.source
                    }];
                    library.addResource(resource, project.id);
                }
                
                return true;
            });
    };

    /**
     * Downloads the catalog but only indexes a single project.
     * This is useful for testing when we don't want to wait forever to index everything.
     * TRICKY: make sure this is maintained with this.downloadCatalog otherwise tests will not reflect production
     * @param url
     * @param projectSlug the project that will be indexed
     * @returns {Promise.<Boolean>}
     */
    this.downloadCatalogTest = function(url, projectSlug) {
        console.log('Downloading catalog for project ' + projectSlug);
        return request.read(url).then(function(response) {
           if(response.status !== 200) return false;

            var data = JSON.parse(response.data);
            for(var project of data) {
                if(project.slug === projectSlug) {
                    var list = [];
                    return utils.chain(downloadSourceLanguages, function(err, data) {
                        console.error(err.message);
                        return false;
                    })([project]);
                }
            }
            return false;
        }).then(function(projects) {
            if(!projects) return;
            var list = [];
            process.stdout.write('\nDownloading resources');
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
                console.error(err.message);
                return false;
            })(list);
        }).then(function() {
            process.stdout.write('\n');
        });
    };

    /**
     * Downloads the catalog and indexes it
     * @param url
     * @returns {Promise.<Boolean>}
     */
    this.downloadCatalog = function(url) {
        console.log('Downloading catalog');
        return request.read(url).then(function(response) {
            if(response.status !== 200) return false;

            var data = JSON.parse(response.data);
            process.stdout.write('Downloading source languages');
            return utils.chain(downloadSourceLanguages, function(err, data) {
                console.error(err.message);
                return false;
            })(data);
        }).then(function(projects) {
            if(!projects) return;
            var list = [];
            process.stdout.write('\nDownloading resources');
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
                console.error(err.message);
                return false;
            })(list);
        }).then(function() {
            process.stdout.write('\n');
        });
    };


    /**
     * Downloads a resource container
     * @param languageSlug
     * @param projectSlug
     * @param resourceSlug
     * @returns {Promise.<Boolean>}
     */
    this.downloadResourceContainer = function(languageSlug, projectSlug, resourceSlug) {
        return _this.index.getResource(languageSlug, projectSlug, resourceSlug).then(function(resource) {
            if(resource && resource.container_format) {
                var dest = path.join(resourceDir, languageSlug + '_' + projectSlug + '_' + resourceSlug + '.json');
                mkdirp(path.dirname(dest));

                // if(resource.container_format) {
                return request.download(resource.container_format.url, dest).then(function(response) {
                    console.log(response);
                    // todo make sure everything worked and set up resource container correctly
                    return true;
                });
                // } else {
                //     // legacy
                //     var url = 'https://api.unfoldingword.org/ts/txt/2/' + projectSlug + '/' + languageSlug + '/resources.json';
                //     return request.download(url, dest).then(function(response) {
                //         console.log(response);
                //         // todo make sure everything worked and build a new resource container from legacy content
                //         return true;
                //     });
                // }
            }
            return false;
        });
    };

    /**
     * Returns the read only index
     * @returns {*}
     */
    for(method in library.getters) {
        this.index[method] = utils.promisify(library.getters[method]);
    }

    return this;
}

module.exports = API;