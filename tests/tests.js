;(function() {
    var assert = require('assert'),
        Door43Client = require('../'),
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
                    }).then(done, done);
                });

                it('returns a single project', (done) => {
                    client.index.getProject('en', 'obs').then(function(result) {
                        assert(result.slug === 'obs');
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
                    }).then(done, done);
                });

                it('returns a single resource', (done) => {
                    client.index.getResource('en', 'obs', 'obs').then(function(result) {
                        assert(result.slug === 'obs');
                        assert(result.container_format !== null);
                    }).then(done, done);
                });

                it('returns null for a missing resource', (done) => {
                    client.index.getResource('fake-lang', 'fake-project', 'fake-resource').then(function(result) {
                        assert(result === null);
                    }).then(done, done);
                });
            });
        });
        
        describe('@Library Generation', function() {
            this.timeout(1000000);

            before((done) => {
                rimraf.sync('./out');
                // TRICKY: we have to re-initialize to load the latest schema
                client = new Door43Client(indexPath, resourceDir);
                done();
            });

            it('downloads the resource catalog from the api and indexes it', (done) => {
                client.downloadCatalog(catalogUrl).then(() => {
                    assert(client.index.getSourceLanguages().length > 0);
                }).then(done, done);
            });

            it('downloads the resource catalog from the api and updates the existing indexes without creating duplicates', (done) => {
                var data = client.index.getSourceLanguages();
                for(var lang of data) {
                    lang.projects = client.index.getProjects(lang.slug);
                    for(var proj of lang.projects) {
                        proj.resources = client.index.getResources(lang.slug, proj.slug);
                    }
                }
                client.downloadCatalog(catalogUrl).then(() => {
                    assert(client.index.getSourceLanguages().length === data.length);
                    for(var lang of data) {
                        assert(client.index.getProjects(lang.slug).length === lang.projects.length);
                        for(var proj of lang.projects) {
                            assert(client.index.getResources(lang.slug, proj.slug).length === proj.resources.lenght);
                        }
                    }
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