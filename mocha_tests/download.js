var rimraf = require('rimraf');
var mkdirp = require('mkdirp');
var assert = require('assert');
describe('Download', function() {
    let client;

    beforeEach(function() {
        rimraf.sync('mocha_tests/out');
        let Door43Client = require('../');
        client = new Door43Client('mocha_tests/index.sqlite', 'mocha_tests/out/containers');
    });

    describe('download container', function() {
        this.timeout(10000);
        it('should download a resource container successfully', function() {
            return client.downloadResourceContainer('en', 'gen', 'ulb');
        });
    });
});