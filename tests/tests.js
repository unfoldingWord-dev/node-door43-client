;(function() {
    var assert = require('assert'),
        Door43Client = require('../'),
        rimraf = require('rimraf');

    describe('@Door43', function () {
        var client = new Door43Client('./out/library.sqlite', './out/res');
        
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
                    }).then(done, done);
                });

                it('returns a single resource', (done) => {
                    client.index.getResource('en', 'obs', 'obs').then(function(result) {
                        assert(result.slug === 'obs');
                    }).then(done, done);
                });

                it('returns null for a missing resource', (done) => {
                    client.index.getResource('fake-lang', 'fake-project', 'fake-resource').then(function(result) {
                        assert(result === null);
                    }).then(done, done);
                });
            });
        });
        
        describe('@Server Calls', function() {
            this.timeout(1000000);

            before((done) => {
                rimraf.sync('./out');
                done();
            });

            it('downloads the resource catalog from the api and indexes it', (done) => {
                client.downloadCatalog('https://api.unfoldingword.org/ts/txt/2/catalog.json').then(() => {
                    assert(client.index.getSourceLanguages().length > 0);
                }).then(done, done);
            });

            it('downloads a resource container from the api and stores it', (done) => {
                client.downloadResource('en-gen-ulb').then((result) => {
                    // todo check if it worked
                }).then(done, done);
            });
        });
    });
})();