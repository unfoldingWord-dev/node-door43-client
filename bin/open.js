'use strict';

const path = require('path');
const Door43Client = require('../');

exports.command = 'open <language> <project> <resource>';
exports.describe = 'Opens a resource container';
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
    console.log('Opening resource container');

    // begin open
    var compression = 'tar';
    // if(argv.zip) compression = 'zip';
    var client = new Door43Client(argv.index, argv.dir, {compression_method:compression});
    client.openResourceContainer(argv.language, argv.project, argv.resource)
        .then(function(container) {
            console.log('Container opened: ' + container.path);
        })
        .catch(function(err) {
            console.error(err);
        });
};