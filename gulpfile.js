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
    client.updateIndex(catalogUrl, function(total, completed) {
        var percent = Math.round(10 * (100 * completed) / total) / 10;
        writePercent(percent);
    }).then(function() {
        console.log();
        return Promise.resolve();
    }).then(done, done);
});

gulp.task('download', function (done) {
    var client = new Door43Client(indexPath, resourceDir, {compression_method:'tar'});
    client.index.getSourceLanguages()
        .then(function(languages) {
            var list = [];
            for(var language of languages) {
                list.push(language.slug);
            }
            return promiseUtils.chain(client.index.getProjects, function(err, data){
                console.log(err);
                return false;
            })(list);
        })
        .then(function(projectGroups) {
            var list = [];
            for(var group of projectGroups) {
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
        .then(function(paths) {
            // so gulp doesn't choke
            console.log();
            return Promise.resolve();
        })
        .then(done, done);
});
gulp.task('default', ['test']);