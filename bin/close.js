'use strict';

const path = require('path');
const Door43Client = require('../');

exports.command = 'close <language> <project> <resource>';
exports.describe = 'Closes a resource container';
exports.builder = {
    i: {
        alias: 'index',
        description: 'The path to the index',
        default: path.join(process.cwd(), 'index.sqlite')
    },
    d: {
        alias: 'dir',
        description: 'The directory where resource containers will be downloaded',
        default: path.join(process.cwd(), 'resource_containers')
    }
};
exports.handler = function(argv) {
    console.log('Closing resource container');

    // begin open
    var compression = 'tar';
    // if(argv.zip) compression = 'zip';
    var client = new Door43Client(argv.index, argv.dir, {compression_method:compression});
    client.closeResourceContainer(argv.language, argv.project, argv.resource)
        .then(function(path) {
            console.log('Container closed: ' + path);
        })
        .catch(function(err) {
            console.error(err);
        });
};