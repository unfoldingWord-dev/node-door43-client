;(function() {
    var assert = require('assert'),
        door43API = require('../'),
        rimraf = require('rimraf');

    // clean test data
    rimraf.sync('./out');

    describe('@Door43', function () {
        this.timeout(1000000);
        var api = new door43API('./out/library.sqlite', './out/res');

        before((done) => {
            // TODO: perform cleanup operations here
            done();
        });

        it('downloads the resource catalog from the api and indexes it', (done) => {
            api.downloadCatalog('https://api.unfoldingword.org/ts/txt/2/catalog.json').then((result) => {
                // todo
            }).then(done, done);
        });

        it('downloads a resource from the api', (done) => {
            api.downloadResource('en-gen-ulb').then((result) => {
                 // todo
            }).then(done, done);
        });
    });
})();