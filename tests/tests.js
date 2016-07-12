;(function() {
    var assert = require('assert'),
        Door43Client = require('../'),
        utils = require('../lib/utils'),
        rimraf = require('rimraf');

    const catalogUrl = 'https://api.unfoldingword.org/ts/txt/2/catalog.json'
        , indexPath = './out/library.sqlite'
        , resourceDir = './out/res';

    describe('@Door43', function () {
        var client = new Door43Client(indexPath, resourceDir);
        
        describe('@Library Calls', function() {
            describe('@Source Languages', function() {
                it('returns a list of source languages', (done) => {
                    client.index.getSourceLanguages().then(function(result)  {
                        assert(result.length > 0);
                    }).then(done, done);
                });

                it('returns a single source language', (done) => {
                    client.index.getSourceLanguage('en').then(function(result) {
                        assert(result.slug === 'en');
                    }).then(done, done);
                });

                it('returns null for a missing source language', (done) => {
                    client.index.getSourceLanguage('fake-lang').then(function(result) {
                        assert(result === null);
                    }).then(done, done);
                });
            });

            describe('@Projects', function() {
                it('returns an empty list of projects for a missing source language', (done) => {
                    client.index.getProjects('fake-lang').then(function(result)  {
                        assert(result.length === 0);
                    }).then(done, done);
                });

                it('returns a list of projects in a source language', (done) => {
                    client.index.getProjects('en').then(function(result)  {
                        assert(result.length > 0);
                        assert(result[0].language_slug === 'en');
                    }).then(done, done);
                });

                it('returns a single project', (done) => {
                    client.index.getProject('en', 'obs').then(function(result) {
                        assert(result.slug === 'obs');
                        assert(result.language_slug === 'en');
                    }).then(done, done);
                });

                it('returns null for a missing project', (done) => {
                    client.index.getProject('fake-lang', 'fake-project').then(function(result) {
                        assert(result === null);
                    }).then(done, done);
                });
            });

            describe('@Resources', function() {
                it('returns an empty list of resource for a fake project', (done) => {
                    client.index.getResources('fake-lang', 'fake-project').then(function(result)  {
                        assert(result.length === 0);
                    }).then(done, done);
                });

                it('returns a list of resource in a project', (done) => {
                    client.index.getResources('en', 'obs').then(function(result)  {
                        assert(result.length > 0);
                        assert(result[0].container_format !== null);
                        assert(result[0].language_slug === 'en');
                        assert(result[0].project_slug === 'obs');
                    }).then(done, done);
                });

                it('returns a single resource', (done) => {
                    client.index.getResource('en', 'obs', 'obs').then(function(result) {
                        assert(result.slug === 'obs');
                        assert(result.container_format !== null);
                        assert(result.language_slug === 'en');
                        assert(result.project_slug === 'obs');
                    }).then(done, done);
                });

                it('returns null for a missing resource', (done) => {
                    client.index.getResource('fake-lang', 'fake-project', 'fake-resource').then(function(result) {
                        assert(result === null);
                    }).then(done, done);
                });
            });
        });

        describe('@Library Generation Test', function() {
            this.timeout(1000000);

            before((done) => {
                rimraf.sync('./out');
                // TRICKY: we have to re-initialize to load the latest schema
                client = new Door43Client(indexPath, resourceDir);
                done();
            });

            it('downloads the resource catalog from the api and indexes it', (done) => {
                client.downloadCatalogTest(catalogUrl, 'obs').then(() => {
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
                    return utils.chain(client.index.getProjects, function(err, data) {
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
                    return utils.chain(utilGetResources, function(err, data) {
                        console.error(err.message);
                        return false;
                    })(list);
                }).then((resources) => {
                    for(var proj of resources) {
                        for(var res of proj) {
                            countdata[res.language_slug][res.project_slug][res.slug] = {};
                        }
                    }
                    return client.downloadCatalogTest(catalogUrl, 'obs');
                }).then(() => {
                    // begin comparing counts
                    return client.index.getSourceLanguages();
                }).then((languages) => {
                    assert(languages.length === Object.keys(countdata).length);
                    list = [];
                    for(var lang of languages) {
                        list.push(lang.slug);
                    }
                    return utils.chain(client.index.getProjects, function(err, data) {
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
                    return utils.chain(utilGetResources, function(err, data) {
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
                rimraf.sync('./build');
                // TRICKY: we have to re-initialize to load the latest schema
                client = new Door43Client('./build/library.sqlite', './build/res');
                done();
            });

            it('downloads the resource catalog from the api and indexes it', (done) => {
                client.downloadCatalog(catalogUrl).then(() => {
                    assert(client.index.getSourceLanguages().length > 0);
                }).then(done, done);
            });
        });
        
        describe('@Server Calls', function() {
            it('downloads a resource container from the api and stores it', (done) => {
                client.downloadResourceContainer('en', 'gen', 'ulb').then((result) => {
                    assert(result === true);
                }).then(done, done);
            });
        });
    });
})();