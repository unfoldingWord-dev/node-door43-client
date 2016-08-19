;(function() {
    var assert = require('assert'),
        Door43Client = require('../'),
        promiseUtils = require('../lib/utils/promises'),
        rimraf = require('rimraf');

    const catalogUrl = 'https://api.unfoldingword.org/ts/txt/2/catalog.json'
        , indexPath = './out/library.sqlite'
        , resourceDir = './out/res';

    describe('@Door43', function () {
        describe('@Library Generation Test', function() {
            this.timeout(1000000);

            before((done) => {
                var altLibraryPath = './out/alt-library.sqlite';
                rimraf.sync(altLibraryPath);
                // TRICKY: we have to re-initialize to load the latest schema
                client = new Door43Client(altLibraryPath, resourceDir);
                done();
            });

            it('downloads the resource catalog from the api and indexes it', (done) => {
                client.updatePrimaryIndex(catalogUrl, 'gen').then(() => {
                    return client.index.getSourceLanguages();
                }).then((languages) => {
                    assert(languages.length > 0);
                }).then(done, done);
            });

            it('downloads the resource catalog from the api and updates the existing indexes without creating duplicates', (done) => {
                const utilGetResources = function(data) {
                    return client.index.getResources(data.languageSlug, data.projectSlug);
                };
                var countdata = {};
                client.index.getSourceLanguages().then((languages) => {
                    var list = [];
                    for(var lang of languages) {
                        countdata[lang.slug] = {};
                        list.push(lang.slug);
                    }
                    return promiseUtils.chain(client.index.getProjects, function(err, data) {
                        console.error(err.message);
                        return false;
                    })(list);
                }).then((projects) => {
                    var list = [];
                    for(var proj of projects) {
                        for(var localizedProj of proj) {
                            countdata[localizedProj.language_slug][localizedProj.slug] = {};
                            list.push({
                                languageSlug:localizedProj.language_slug,
                                projectSlug:localizedProj.slug
                            });
                        }
                    }
                    return promiseUtils.chain(utilGetResources, function(err, data) {
                        console.error(err.message);
                        return false;
                    })(list);
                }).then((resources) => {
                    for(var proj of resources) {
                        for(var res of proj) {
                            countdata[res.language_slug][res.project_slug][res.slug] = {};
                        }
                    }
                    return client.updatePrimaryIndex(catalogUrl, 'gen');
                }).then(() => {
                    // begin comparing counts
                    return client.index.getSourceLanguages();
                }).then((languages) => {
                    assert(languages.length === Object.keys(countdata).length);
                    list = [];
                    for(var lang of languages) {
                        list.push(lang.slug);
                    }
                    return promiseUtils.chain(client.index.getProjects, function(err, data) {
                        console.error(err.message);
                        return false;
                    })(list);
                }).then((projects) => {
                    var list = [];
                    for(var proj of projects) {
                        assert(proj.length === Object.keys(countdata[proj[0].language_slug]).length);
                        for(var localizedProj of proj) {
                            list.push({
                                languageSlug:localizedProj.language_slug,
                                projectSlug:localizedProj.slug
                            });
                        }
                    }
                    return promiseUtils.chain(utilGetResources, function(err, data) {
                        console.error(err.message);
                        return false;
                    })(list);
                }).then((resources) => {
                    for(var proj of resources) {
                        assert(proj.length === Object.keys(countdata[proj[0].language_slug][proj[0].project_slug]).length);
                    }
                }).then(done, done);
            });
        });

        describe('@Generate Library', function() {
            this.timeout(1000000);

            before((done) => {
                rimraf.sync('./out');
                // TRICKY: we have to re-initialize to load the latest schema
                client = new Door43Client(indexPath, resourceDir);
                done();
            });

            it('downloads the resource catalog from the api and indexes it', (done) => {
                client.updatePrimaryIndex(catalogUrl).then(() => {
                    assert(client.index.getSourceLanguages().length > 0);
                }).then(done, done);
            });
        });
        
        describe('@Server Calls', function() {
            it('downloads a resource container from the api and stores it', (done) => {
                client.downloadFutureCompatibleResourceContainer('en', 'gen', 'ulb').then((result) => {
                    assert(result === true);
                }).then(done, done);
            });
        });
    });
})();