var gulp = require('gulp');
var mocha = require('gulp-mocha');
var argv = require('yargs').argv;
var rimraf = require('rimraf');
var utils = require('./lib/utils');
var Door43Client = require('./');

gulp.task('clean', function (done) {
    rimraf.sync('./out');
    done();
});
gulp.task('index', function (done) {
    const catalogUrl = 'https://api.unfoldingword.org/ts/txt/2/catalog.json'
        , indexPath = './out/library.sqlite'
        , resourceDir = './out/res';
    var client = new Door43Client(indexPath, resourceDir);
    client.updateIndex(catalogUrl).then(done, done);
});
gulp.task('download', function (done) {
    const catalogUrl = 'https://api.unfoldingword.org/ts/txt/2/catalog.json'
        , indexPath = './out/library.sqlite'
        , resourceDir = './out/res';
    rimraf.sync(resourceDir);
    var client = new Door43Client(indexPath, resourceDir);
    // var list = [];

    client.index.getSourceLanguages()
        .then(function(languages) {
            var list = [];
            for(var language of languages) {
                list.push(language.slug);
            }
            return utils.chain(client.index.getProjects, function(err, data){
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
            return utils.chain(client.index.getResources, function(err, data) {
                console.log(err);
                return false;
            })(list);
        })
        .then(function(resourceGroups) {
            list = [];
            for(var group of resourceGroups) {
                for(var resource of group) {
                    list.push({
                        languageSlug: resource.source_language_slug,
                        projectSlug: resource.project_slug,
                        resourceSlug: resource.slug
                    });
                }
            }
            console.log('Downloading ' + list.length + ' items...');
            // utils.chain(client.downloadResourceContainer, function(err, data) {
            //     console.log(err);
            //     return false;
            // })(list);
        })
        .then(done, done);
});
gulp.task('default', ['test']);