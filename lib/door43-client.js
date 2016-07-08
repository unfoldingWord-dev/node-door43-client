var request = require('./request'),
    mkdirp = require('mkdirp'),
    path = require('path'),
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

    /**
     * Downloads the catalog and indexes it
     * @param url
     * @returns {Promise.<Boolean>}
     */
    this.downloadCatalog = function(url) {
        return request.read(url).then(function(catResponse) {
            // consume project data
            var catData = JSON.parse(catResponse.data);
            var langPromises = [];
            for(var project of catData) {
                langPromises.push(request.read(project.lang_catalog));
            }
            
            return Promise.all(langPromises).then(function(langResponses) {
                var promises = [];
                // consume language data
                for(var langResponse of langResponses) {
                    if(langResponse.status != 200) continue;
                    var langData = JSON.parse(langResponse.data);
                    var resPromises = [];
                    for(var lang of langData) {
                        resPromises.push(request.read(lang.res_catalog));
                    }

                    promises.push(Promise.all(resPromises));
                }

                return Promise.all(promises).then(function(resResponses) {
                    for(var langResponse of resResponses) {
                        for(var resResponse of langResponse) {
                            if(resResponse.status != 200) continue;
                            console.log(resResponse);
                            var resData = JSON.parse(resResponse.data);
                            // TODO: do stuff with the resource
                        }
                    }
                });
            });
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