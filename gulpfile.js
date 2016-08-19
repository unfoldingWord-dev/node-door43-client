var gulp = require('gulp');
var mocha = require('gulp-mocha');
var argv = require('yargs').argv;
var rimraf = require('rimraf');
var promiseUtils = require('./lib/utils/promises');
var Door43Client = require('./');
var readline = require('readline');

const catalogUrl = 'https://api.unfoldingword.org/ts/txt/2/catalog.json';
const indexPath = './out/library.sqlite';
const resourceDir = './out/res';

function writePercent(percent) {
    readline.cursorTo(process.stdout, 0);
    readline.clearLine(process.stdout, 0);
    process.stdout.write(percent + '%');
}

gulp.task('clean', function (done) {
    rimraf.sync('./out');
    done();
});

gulp.task('index', function (done) {
    var client = new Door43Client(indexPath, resourceDir);
    client.updatePrimaryIndex(catalogUrl, function(total, completed) {
        var percent = Math.round(10 * (100 * completed) / total) / 10;
        writePercent(percent);
    }).then(function() {
        console.log();
        return Promise.resolve();
    }).then(done, done);
});

gulp.task('download', function (done) {
    var compression = 'tar';
    if(argv.zip) compression = 'zip';
    var client = new Door43Client(indexPath, resourceDir, {compression_method:compression});
    var getLanguages = function(lang) {
        if(lang) {
            return client.index.getSourceLanguage(lang)
                .then(function(language) {
                    return [language];
                });
        } else {
            return client.index.getSourceLanguages();
        }
    };

    if(argv.catalogs) {
        client.index.getCatalogs()
            .then(function(catalogs) {
                var list = [];
                for(var catalog of catalogs) {
                    list.push(catalog.slug);
                }
                return promiseUtils.chain(client.updateCatalogIndex, function (err, data) {
                    console.log(err);
                    return false;
                }, {compact: true, onProgress: function(total, completed) {
                    var percent = Math.round(10 * (100 * completed) / total) / 10;
                    writePercent(percent);
                }})(list);
            })
            .then(function() {
                // so gulp doesn't choke
                console.log();
                return Promise.resolve();
            })
            .then(done, done);
        return;
    }

    getLanguages(argv.lang)
        .then(function(languages) {
            var list = [];
            for(var language of languages) {
                if(argv.proj) {
                    list.push({
                        languageSlug: language.slug,
                        projectSlug: argv.proj
                    })
                } else {
                    list.push(language.slug);
                }
            }
            var errHandler = function(err, data){
                console.log(err);
                return false;
            };

            if(argv.proj) {
                return promiseUtils.chain(client.index.getProject, errHandler)(list);
            } else {
                return promiseUtils.chain(client.index.getProjects, errHandler)(list);
            }
        })
        .then(function(projectGroups) {
            var list = [];
            for(var group of projectGroups) {
                if(group.constructor !== Array) group = [group];
                for(project of group) {
                    list.push({
                        projectSlug: project.slug,
                        languageSlug: project.source_language_slug
                    });
                }
            }
            return promiseUtils.chain(client.index.getResources, function(err, data) {
                console.log(err);
                return false;
            })(list);
        })
        .then(function(resourceGroups) {
            var list = [];
            for(var group of resourceGroups) {
                for(var resource of group) {
                    list.push({
                        languageSlug: resource.source_language_slug,
                        projectSlug: resource.project_slug,
                        resourceSlug: resource.slug,
                    });
                }
            }
            console.log('Downloading ' + list.length + ' items...');
            return promiseUtils.chain(client.downloadResourceContainer, function(err, data) {

                if(err.message === 'Resource container already exists') {
                    readline.cursorTo(process.stdout, 0);
                    readline.clearLine(process.stdout, 0);
                    console.log('\nSkipping', data);
                } else {
                    readline.cursorTo(process.stdout, 0);
                    readline.clearLine(process.stdout, 0);
                    console.log('\n', err, 'while downloading', data);
                }
                return false;
            }, {compact: true, onProgress: function(total, completed) {
                var percent = Math.round(10 * (100 * completed) / total) / 10;
                writePercent(percent);
            }})(list);
        })
        .then(function() {
            // so gulp doesn't choke
            console.log();
            return Promise.resolve();
        })
        .then(done, done);
});
gulp.task('default', ['test']);