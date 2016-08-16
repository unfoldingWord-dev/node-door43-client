var gulp = require('gulp');
var mocha = require('gulp-mocha');
var argv = require('yargs').argv;
var rimraf = require('rimraf');
var Door43Client = require('./');

gulp.task('index', function (done) {
    const catalogUrl = 'https://api.unfoldingword.org/ts/txt/2/catalog.json'
        , indexPath = './out/library.sqlite'
        , resourceDir = './out/res';
    rimraf.sync('./out');
    client = new Door43Client(indexPath, resourceDir);
    client.updateIndex(catalogUrl).then(done, done);
});
gulp.task('default', ['test']);