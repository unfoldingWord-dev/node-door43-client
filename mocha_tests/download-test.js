"use strict";

var rimraf = require('rimraf');
var mkdirp = require('mkdirp');
var assert = require('assert');
var ncp = require('ncp').ncp;
var fileUtils = require('../lib/utils/files');
describe('Download', function() {
    let client;

    beforeEach(function(done) {
        rimraf.sync('mocha_tests/out');
        mkdirp.sync('mocha_tests/out');
        let Door43Client = require('../');
        // TRICKY: copy test index so we don't persist test data
        ncp('mocha_tests/index.sqlite', 'mocha_tests/out/download_index.sqlite', function(err) {
            if(err) console.log(err);
            client = new Door43Client('mocha_tests/out/download_index.sqlite', 'mocha_tests/out/containers');
            done();
        });
    });

    describe('download container', function() {
        this.timeout(10000);

        it('should download a resource container successfully', function() {
            var progressCalled = false;
            return client.downloadResourceContainer('en', 'gen', 'ulb', function(size, progress) {
                    progressCalled = true;
                })
                .then(function(container) {
                    assert.ok(progressCalled);
                    assert.notEqual(null, container);
                });
        });

        it('should download, close, and reopen a resource container successfully', function() {
            return client.downloadResourceContainer('en', 'gen', 'udb')
                .then(function(container) {
                    assert.notEqual(null, container);
                    return client.closeResourceContainer('en', 'gen', 'udb');
                })
                .then(function(path) {
                    assert.notEqual(null, path);
                    assert.ok(fileUtils.fileExists(path));
                    return client.openResourceContainer('en', 'gen', 'udb');
                })
                .then(function(container) {
                    assert.notEqual(null, container);
                });
        });
    });
});