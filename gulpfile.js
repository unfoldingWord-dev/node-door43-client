var gulp = require('gulp'),
    mocha = require('gulp-mocha'),
    argv = require('yargs').argv;

gulp.task('test', function () {
    return gulp.src('./tests/tests.js', {read:false})
        .pipe(mocha({reporter: 'spec', grep: (argv.grep || argv.g)}));
});
gulp.task('default', ['test']);