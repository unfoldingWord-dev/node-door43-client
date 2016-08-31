#! /usr/bin/env node

var commandDir = './bin';

var argv = require('yargs')
    .commandDir(commandDir)
    .help('help')
    .alias('h', 'help')
    .strict(true)
    .demand(1)
    .argv;