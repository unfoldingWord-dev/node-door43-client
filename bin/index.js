'use strict';

const path = require('path');
const fs = require('fs');
const mkdirp = require('mkdirp');
const rimraf = require('rimraf');
const Door43Client = require('../');
const util = require('./util');

exports.command = 'index';
exports.describe = 'Generates a brand new index';
exports.builder = {
    i: {
        alias: 'index',
        description: 'The path to the generated index',
        default: path.join(process.cwd(), 'index.sqlite')
    },
    f: {
        alias: 'force',
        description: 'Overwrites the index if it already exists',
        default: false
    },
    u: {
        alias: 'url',
        description: 'The api url',
        default: 'https://api.unfoldingword.org/ts/txt/2/catalog.json'
    }
};
exports.handler = function(argv) {
    let indexPath = argv.index;

    // don't overwrite
    if(!argv.force) {
        let exists = false;
        try {
            exists = fs.statSync(indexPath).isFile();
        } catch (err) {
        }
        if (exists) throw new Error('The index path already exist. Aborting.');
    } else {
        rimraf.sync(indexPath);
    }

    mkdirp.sync(path.dirname(indexPath));

    console.log('Indexing source:');
    var client = new Door43Client(indexPath, null);
    client.updateSources(argv.url, util.logProgress)
        .then(function() {
            return client.updateChunks(util.logProgress);
        })
        .then(function() {
            // index the catalogs
            console.log('\n\nIndexing catalogs:');
            return client.updateCatalogs(util.logProgress);
        })
        .then(function() {
            // done
            return true;
        })
        .catch(function(err) {
            console.error(err);
        });
};