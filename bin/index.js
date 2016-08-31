'use strict';

const path = require('path');
const fs = require('fs');
const mkdirp = require('mkdirp');
const rimraf = require('rimraf');
const Door43Client = require('../');
const promiseUtils = require('../lib/utils/promises');
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

    console.log('Generating primary index:');
    var client = new Door43Client(indexPath, null);
    client.updatePrimaryIndex(argv.url, function(id, total, completed) {
        util.logProgress(id, total, completed);
    }).then(function() {
        // index the catalogs
        console.log('\n\nGenerating catalog indexes:');
        return indexCatalogs(client);
    }).catch(function(err) {
        console.error(err);
    });
};

function indexCatalogs(client) {
    return client.index.getCatalogs()
        .then(function(catalogs) {
            var list = [];
            for(var catalog of catalogs) {
                list.push({
                    slug: catalog.slug,
                    onProgress: util.logProgress
                });
            }
            return promiseUtils.chain(client.updateCatalogIndex, function (err, data) {
                console.log(err);
                return false;
            })(list);
        })
        .then(function() {
            // so gulp doesn't choke
            console.log('\nFinished!');
        });
}