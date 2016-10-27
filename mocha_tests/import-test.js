"use strict";

var rimraf = require('rimraf');
var mkdirp = require('mkdirp');
var assert = require('assert');
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

        it('should import a resource container', function() {
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

        it('should import a new resource container', function() {
            return client.importResourceContainer('mocha_tests/en_tit-new_ulb')
                .then(function(container) {
                    assert.equal(container.path, 'mocha_tests/out/containers/en_tit-new_ulb');
                    // attempt to open normally
                    return client.openResourceContainer('en', 'tit-new', 'ulb');
                })
                .then(function(container) {
                    assert.equal(container.path, 'mocha_tests/out/containers/en_tit-new_ulb');

                    // make sure the indexed project is accessible
                    let project = client.indexSync.getProject('en', 'tit-new');
                    assert.ok(project != null);

                    let entries = client.indexSync.getProjectCategories(0, "en", null);
                    assert.equal(entries.length, 1);
                    assert.equal(entries[0].slug, 'bible-nt');
                    assert.equal(entries[0].type, 'category');
                    let subEntries = client.indexSync.getProjectCategories(entries[0].id, "en", null);
                    assert.equal(subEntries.length, 1);
                    assert.equal(subEntries[0].slug, 'tit-new');
                    assert.equal(subEntries[0].type, 'project');
                });
        });
    });
});