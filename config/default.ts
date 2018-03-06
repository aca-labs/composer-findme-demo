
import * as del from 'del';
import * as gulp from 'gulp';
import * as bump from 'gulp-bump';
import * as tsc from 'gulp-typescript';
import * as json from 'json-update';
import * as replace from 'gulp-string-replace';
import * as merge from 'merge';
import * as moment from 'moment';
import * as runSequence from 'run-sequence';
import * as yargs from 'yargs';

const tsProject = tsc.createProject('./tsconfig.json');

const npmconfig = require('../package.json');
const tscConfig = require('../tsconfig.json');
const angularConfig = require('../.angular-cli.json');
const settings = require('../src/assets/settings.json');

const baseHref = '';
const paths = {
    src: tscConfig.compilerOptions.baseUrl,
    build: tscConfig.compilerOptions.outDir,
    content: 'docs/',
    public: 'dist/',    // packaged assets ready for deploy
};

const prod_settings = {
    env: 'dev',
    composer: {
        domain: 'demo.aca.im',
        route: baseHref,
        protocol: 'https:'
    }
};

/**
 * Pipe a collection of streams to and arbitrart destination and merge the
 * results.
 */
const pipeTo = (dest: NodeJS.ReadWriteStream) =>
    (...src: NodeJS.ReadableStream[]) =>
        merge(src.map((s) => s.pipe(dest)));

/**
 * Nuke old build assetts.
 */
gulp.task('clean', () => ((...globs: string[]) => del(globs))('dist/', 'compiled/', '_package'));

gulp.task('default', ['build']);

gulp.task('prebuild', (next) => runSequence(
    'sw:base',
    'settings:update',
    next
));

gulp.task('postbuild', (next) => runSequence(
    'settings:reset',
    'sw:unbase',
    'fix:service-worker',
    next
));

gulp.task('sw:base', () => {
    return gulp.src(['./src/app/app.module.ts']) // Any file globs are supported
        .pipe(replace(new RegExp('\'__base__', 'g'), `'${baseHref}/`, { logs: { enabled: false } }))
        .pipe(gulp.dest('./src/app'));
});

gulp.task('sw:unbase', () => {
    return gulp.src(['./src/app/app.module.ts']) // Any file globs are supported
        .pipe(replace(new RegExp(`'${baseHref}/`, 'g'), '\'__base__', { logs: { enabled: false } }))
        .pipe(gulp.dest('./src/app'));
});

gulp.task('bump', () => {
    const argv = yargs.argv;
    const type = argv.major ? 'major' : (argv.minor ? 'minor' : 'patch');
    gulp.src('./package.json')
        .pipe(bump({ type }))
        .pipe(gulp.dest('./'));
});

gulp.task('settings:update', () => {
    const new_settings = {
        version: npmconfig.version,
        build: moment().format('YYYY-MM-DD HH:mm:ss')
    };
    for (const k in prod_settings) {
        if (prod_settings.hasOwnProperty(k)) {
            new_settings[k] = prod_settings[k];
        }
    }
    json.config({ deep: true });
    return json.update('./src/assets/settings.json', new_settings)
});

gulp.task('settings:reset', () => {
    const old_settings = settings;
    old_settings.build = 'local-dev';
    return json.update('./src/assets/settings.json', old_settings);
});

gulp.task('fix:service-worker', (next) => runSequence(
    'fix:service-worker:config',
    'fix:service-worker:runtime',
    next
));

gulp.task('fix:service-worker:config', () => {
    return gulp.src(['./dist/ngsw.json']) // Any file globs are supported
        .pipe(replace(new RegExp('"/', 'g'), `"${baseHref}/`, { logs: { enabled: false } }))
        .pipe(gulp.dest('./dist'));
});

gulp.task('fix:service-worker:runtime', () => {
    const parts = npmconfig.name.split('-');
    return gulp.src(['./dist/ngsw-worker.js']) // Any file globs are supported
        .pipe(replace(new RegExp('ngsw:db:', 'g'), `ngsw:db:${parts.length > 1 ? parts[1] : parts[0]}:`, { logs: { enabled: false } }))
        .pipe(gulp.dest('./dist'));
});

gulp.task('usage', () => {
    console.log(`Commands:`);
    console.log(`    build - Build project`);
    console.log(`    bump  - Update project version`);
    console.log(`    clean - Nuke old build assets`);
    console.log(`    lint  - Lint Typescript and Sass files`);
    console.log(`    test  - Run tests`);
    console.log(`    usage - List available gulp tasks`);
});
