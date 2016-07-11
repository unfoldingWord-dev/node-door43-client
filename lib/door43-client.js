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

    const helper = new SqliteHelper('./lib/schema.sqlite', dbPath);
    const library = new Library(helper);

    const downloadSourceLanguages = function(project) {
        return request.read(project.lang_catalog)
            .then(function(response) {
                process.stdout.write('.');
                // consume language data
                if(response.status !== 200) return;

                var data = JSON.parse(response.data);
                var languages = [];
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

                    languages.push({
                        slug: language.language.slug,
                        resourceUrl: language.res_catalog
                    });
                }

                return {
                    projectId: projectId,
                    projectSlug: project.slug,
                    languages: languages
                };
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
                    resource.status.license = resource.status.license || 'CC BY-SA';
                    library.addResource(resource, project.id);
                }
                
                return true;
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
            // consume project data
            if(response.status !== 200) return;

            var data = JSON.parse(response.data);
            process.stdout.write('Downloading source languages');
            return utils.chain(downloadSourceLanguages, function(err, data) {
                console.error(err.message);
                return false;
            })(data);
        }).then(function(responses) {
            if(!responses) return;
            var list = [];
            process.stdout.write('\nDownloading resources');
            for(var response of responses) {
                for(var language of response.languages) {
                    list.push({
                        id: response.projectId,
                        slug: response.projectSlug,
                        resourceUrl: language.resourceUrl
                    });

                }
            }

            return utils.chain(downloadSourceResources, function(err, data) {
                console.error(err.message);
                return false;
            })(list);

            // return promise; //Promise.all(promises);
        }).then(function() {
            process.stdout.write('\n');
        });
    };



    /**
     * Downloads a resource
     * @param id
     * @returns {Promise.<Boolean>}
     */
    this.downloadResource = function(id) {
        var uri = 'https://api.unfoldingword.org/ts/txt/2/obs/pt-br/resources.json?date_modified=20150129',
            dest = path.join(resourceDir, id + '.json');
        mkdirp(path.dirname(dest));
        // TODO: get uri from index
        return request.download(uri, dest).then(function(response) {
            //console.log(response.data);
            return true;
        });
    };

    /**
     * Returns the read only index
     * @returns {*}
     */
    this.index = {};
    for(method in library.getters) {
        this.index[method] = utils.promisify(library.getters[method]);
    }

    return this;
}

module.exports = API;