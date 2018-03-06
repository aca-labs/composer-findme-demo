
import * as gulp from 'gulp';
import * as util from 'gulp-util';
import * as install from 'gulp-install';
import * as runSequence from 'run-sequence';
import * as svgo from 'gulp-svgmin';
import * as yargs from 'yargs';

gulp.task('optimise', () => runSequence('optimise:svgs'));

gulp.task('optimise:svgs', () => {
    return gulp.src('src/assets/**/*.svg')
        .pipe(svgo({ plugins: [{ cleanupIDs: false }] }))
        .pipe(gulp.dest('src/assets'));
});
