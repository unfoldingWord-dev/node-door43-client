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

    var helper = new SqliteHelper('./lib/schema.sqlite', dbPath);
    this.library = new Library(helper);

    const downloadSourceLanguages = function(project) {
        return request.read(project.lang_catalog)
            .then(function(response) {
                process.stdout.write('.');
                // consume language data
                if(response.status !== 200) return;

                var data = JSON.parse(response.data);
                var languages = [];
                for(var language of data) {

                    // TODO: index the language

                    languages.push({
                        slug: language.language.slug,
                        resourceUrl: language.res_catalog
                    });
                }

                return {
                    projectSlug: project.slug,
                    languages: languages
                };
            });
    };

    const downloadSourceResources = function(language) {
        return request.read(language.resourceUrl)
            .then(function(response) {
                process.stdout.write('.');
                // consume resource data
                if(response.status !== 200) return;

                var data = JSON.parse(response.data);
                var resources = [];
                for(var resource of data) {

                    // TODO: index the resource

                    resources.push(resource.slug);
                }

                return {
                    projectSlug: language.projectSlug,
                    languageSlug: language.languageSlug,
                    resources: resources
                };
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
            return utils.chain(downloadSourceLanguages, function(err, stuff) {
                // could not process
                return false;
            })(data);
        }).then(function(responses) {
            if(!responses) return;
            var list = [];
            process.stdout.write('\nDownloading resources');
            for(var response of responses) {
                for(var language of response.languages) {
                    list.push({
                        projectSlug: response.projectSlug,
                        languageSlug: language.slug,
                        resourceUrl: language.resourceUrl
                    });

                }
            }

            return utils.chain(downloadSourceResources, function(err, stuff) {
                return false;
            })(list);

            // return promise; //Promise.all(promises);
        }).then(function(responses) {
            for(var response of responses) {
                //console.log(response);
            }
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
    
    return this;
}

module.exports = API;