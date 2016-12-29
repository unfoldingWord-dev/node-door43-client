'use strict';

const path = require('path');
const fs = require('fs');
const mkdirp = require('mkdirp');
const readline = require('readline');
const rimraf = require('rimraf');
const Door43Client = require('../');
const promiseUtils = require('../lib/utils/promises');
const util = require('./util');

exports.command = 'download';
exports.describe = 'Downloads the resource container for each indexed resource.';
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
    },
    l: {
        alias: 'lang',
        description: 'Limit the download to only resources in the given language. e.g. "en"'
    },
    p: {
        alias: 'proj',
        description: 'Limit the download to a single project. e.g. "gen"'
    },
    f: {
        alias: 'force',
        description: 'Overwrites the directory if it already exists',
        default: false
    },
    log: {
        description: 'Log errors to log.txt',
        default: false
    },
    v: {
        alias: 'verbose',
        description: 'Display errors to the console',
        default: false
    },
    c: {
        alias: 'close',
        description: 'Will close the downloaded resource containers',
        default: false
    }
};
exports.handler = function(argv) {
    // don't overwrite
    if(!argv.force) {
        let exists = false;
        try {
            exists = fs.statSync(argv.dir).isFile();
        } catch (err) {
        }
        if (exists) throw new Error('The resource container directory already exist. Aborting.');
    } else {
        rimraf.sync(argv.dir);
    }

    mkdirp.sync(argv.dir);

    console.log('Downloading resource containers:', argv.dir);

    // begin download
    let compression = 'tar';
    // if(argv.zip) compression = 'zip';
    let client = new Door43Client(argv.index, argv.dir, {compression_method:compression});
    let getLanguages = function(lang) {
        if(lang) {
            return client.index.getSourceLanguage(lang)
                .then(function(language) {
                    return [language];
                });
        } else {
            return client.index.getSourceLanguages();
        }
    };

    let download = function(opts) {
        return client.downloadResourceContainer(opts)
            .then(function(c) {
                if(argv.close) {
                    return client.closeResourceContainer(c.info.language.slug, c.info.project.slug, c.info.resource.slug)
                        .then(function() {
                            // make response empty
                            return Promise.resolve();
                        });
                }
                return Promise.resolve();
            });
    };

    getLanguages(argv.lang)
        .then(function(languages) {
            let list = [];
            for(let language of languages) {
                if(argv.proj) {
                    list.push({
                        languageSlug: language.slug,
                        projectSlug: argv.proj
                    })
                } else {
                    list.push(language.slug);
                }
            }
            let errHandler = function(err, data){
                if(argv.verbose) console.log(err);
                return false;
            };

            if(argv.proj) {
                return promiseUtils.chain(client.index.getProject, errHandler)(list);
            } else {
                return promiseUtils.chain(client.index.getProjects, errHandler)(list);
            }
        })
        .then(function(projectGroups) {
            let list = [];
            for(let group of projectGroups) {
                if(group.constructor !== Array) group = [group];
                for(let project of group) {
                    list.push({
                        projectSlug: project.slug,
                        languageSlug: project.source_language_slug
                    });
                }
            }
            return promiseUtils.chain(client.index.getResources, function(err, data) {
                if(argv.verbose) console.log(err);
                return false;
            })(list);
        })
        .then(function(resourceGroups) {
            let list = [];
            for(let group of resourceGroups) {
                for(let resource of group) {
                    list.push({
                        languageSlug: resource.source_language_slug,
                        projectSlug: resource.project_slug,
                        resourceSlug: resource.slug,
                    });
                }
            }
            console.log('Downloading ' + list.length + ' items...');
            return promiseUtils.chain(download, function(err, data) {

                if(err.message === 'Resource container already exists') {
                    if(argv.verbose) {
                        readline.cursorTo(process.stdout, 0);
                        readline.clearLine(process.stdout, 0);
                        console.log('\nSkipping', data);
                    }
                } else {
                    if(argv.log) {
                        let errMessage = err.status ? err.status : err.toString();
                        fs.writeFileSync(path.join(argv.dir, 'log.txt'), errMessage + ': while downloading:\n' + JSON.stringify(data) + '\n\n', {flag: 'a'});
                    }
                    if(argv.verbose) {
                        readline.cursorTo(process.stdout, 0);
                        readline.clearLine(process.stdout, 0);
                        console.log('\n', err, 'while downloading', data);
                    }
                }
                return false;
            }, {compact: true, onProgress: function(total, completed) {
                util.logProgress('container', total, completed);
            }})(list);
        })
        .then(function() {
            console.log('\nFinished!');
        })
        .catch(function(err) {
            if(argv.verbose) console.error(err);
        });
};