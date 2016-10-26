"use strict";

var rimraf = require('rimraf');
var mkdirp = require('mkdirp');
var assert = require('assert');
var fileUtils = require('../lib/utils/files');
var ncp = require('ncp').ncp;
describe('Import', function() {
    let client;

    beforeEach(function() {
        rimraf.sync('mocha_tests/out');
        let Door43Client = require('../');
        // TRICKY: copy test index so we don't persist test data
        ncp('mocha_tests/index.sqlite', 'mocha_tests/out/index.sqlite');
        client = new Door43Client('mocha_tests/out/index.sqlite', 'mocha_tests/out/containers');
    });

    describe('import container', function() {
        this.timeout(10000);

        it('should import an open resource container successfully', function() {
            return client.importResourceContainer('mocha_tests/zzz_php_cdw')
                .then(function(container) {
                    assert.equal(container.path, 'mocha_tests/out/containers/zzz_php_cdw');
                    // attempt to open normally
                    return client.openResourceContainer('zzz', 'php', 'cdw');
                })
                .then(function(container) {
                    assert.equal(container.path, 'mocha_tests/out/containers/zzz_php_cdw');
                });
        });
    });
});