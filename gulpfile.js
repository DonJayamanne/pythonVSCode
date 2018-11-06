/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

/* jshint node: true */
/* jshint esversion: 6 */

'use strict';

const gulp = require('gulp');
const filter = require('gulp-filter');
const es = require('event-stream');
const tsfmt = require('typescript-formatter');
const tslint = require('tslint');
const relative = require('relative');
const ts = require('gulp-typescript');
const cp = require('child_process');
const spawn = require('cross-spawn');
const colors = require('colors/safe');
const gitmodified = require('gulp-gitmodified');
const path = require('path');
const debounce = require('debounce');
const jeditor = require("gulp-json-editor");
const del = require('del');
const sourcemaps = require('gulp-sourcemaps');
const fs = require('fs');
const remapIstanbul = require('remap-istanbul');
const istanbul = require('istanbul');
const glob = require('glob');
const os = require('os');
const _ = require('lodash');
const nativeDependencyChecker = require('node-has-native-dependencies');
const flat = require('flat');
const inlinesource = require('gulp-inline-source');
const webpack = require('webpack');
const webpack_config = require('./webpack.default.config');
const formatWebpackMessages = require('react-dev-utils/formatWebpackMessages');
const chalk = require('chalk');
const printBuildError = require('react-dev-utils/printBuildError');

const isCI = process.env.TRAVIS === 'true' || process.env.TF_BUILD !== undefined;

const noop = function () { };
/**
* Hygiene works by creating cascading subsets of all our files and
* passing them through a sequence of checks. Here are the current subsets,
* named according to the checks performed on them. Each subset contains
* the following one, as described in mathematical notation:
*
* all ⊃ indentation ⊃ typescript
*/

const all = [
    'src/**/*',
    'src/client/**/*',
];

const tsFilter = [
    'src/**/*.ts*',
    '!out/**/*'
];

const indentationFilter = [
    'src/**/*.ts*',
    '!**/typings/**/*',
];

const tslintFilter = [
    'src/**/*.ts*',
    'test/**/*.ts*',
    '!**/node_modules/**',
    '!out/**/*',
    '!images/**/*',
    '!.vscode/**/*',
    '!pythonFiles/**/*',
    '!resources/**/*',
    '!snippets/**/*',
    '!syntaxes/**/*',
    '!**/typings/**/*',
    '!**/*.d.ts'
];

const copyrightHeader = [
    '// Copyright (c) Microsoft Corporation. All rights reserved.',
    '// Licensed under the MIT License.',
    '',
    '\'use strict\';'
];
const copyrightHeaderNoSpace = [
    '// Copyright (c) Microsoft Corporation. All rights reserved.',
    '// Licensed under the MIT License.',
    '\'use strict\';'
];
const copyrightHeaders = [copyrightHeader.join('\n'), copyrightHeader.join('\r\n'), copyrightHeaderNoSpace.join('\n'), copyrightHeaderNoSpace.join('\r\n')];

gulp.task('precommit', (done) => run({ exitOnError: true, mode: 'staged' }, done));

gulp.task('hygiene-watch', () => gulp.watch(tsFilter, gulp.series('hygiene-modified')));

gulp.task('hygiene', (done) => run({ mode: 'all', skipFormatCheck: true, skipIndentationCheck: true }, done));

gulp.task('compile', (done) => run({ mode: 'compile', skipFormatCheck: true, skipIndentationCheck: true, skipLinter: true }, done));

gulp.task('hygiene-modified', gulp.series('compile', (done) => run({ mode: 'changes' }, done)));

gulp.task('watch', gulp.parallel('hygiene-modified', 'hygiene-watch'));

// Duplicate to allow duplicate task in tasks.json (one ith problem matching, and one without)
gulp.task('watchProblems', gulp.parallel('hygiene-modified', 'hygiene-watch'));

gulp.task('debugger-coverage', buildDebugAdapterCoverage);

gulp.task('hygiene-watch-branch', () => gulp.watch(tsFilter, gulp.series('hygiene-branch')));

gulp.task('hygiene-all', (done) => run({ mode: 'all' }, done));

gulp.task('hygiene-branch', (done) => run({ mode: 'diffMaster' }, done));

gulp.task('cover:clean', () => del(['coverage', 'debug_coverage*']));

gulp.task('output:clean', () => del(['coverage', 'debug_coverage*']));

gulp.task('clean', gulp.parallel('output:clean', 'cover:clean'));

gulp.task('clean:ptvsd', () => del(['coverage', 'pythonFiles/experimental/ptvsd/*']));

gulp.task('checkNativeDependencies', (done) => {
    if (hasNativeDependencies()) {
        throw new Error('Native dependencies deteced');
    }
    done();
});

gulp.task('cover:enable', () => {
    return gulp.src("./build/coverconfig.json")
        .pipe(jeditor((json) => {
            json.enabled = true;
            return json;
        }))
        .pipe(gulp.dest("./out", { 'overwrite': true }));
});

gulp.task('cover:disable', () => {
    return gulp.src("./build/coverconfig.json")
        .pipe(jeditor((json) => {
            json.enabled = false;
            return json;
        }))
        .pipe(gulp.dest("./out", { 'overwrite': true }));
});

/**
 * Inline CSS into the coverage report for better visualizations on
 * the VSTS report page for code coverage.
 */
gulp.task('inlinesource', () => {
    return gulp.src('./coverage/lcov-report/*.html')
        .pipe(inlinesource({ attribute: false }))
        .pipe(gulp.dest('./coverage/lcov-report-inline'));
});

gulp.task('compile-webviews', (done) => {
    // Clear screen before starting
    console.log('\x1Bc');

    // First copy the files/css/svg/png files to the output folder
    gulp.src('./src/**/*.{png,svg,css}')
        .pipe(gulp.dest('./out'));

    // Then our theme json
    gulp.src('./src/**/*theme*.json')
        .pipe(gulp.dest('./out'));

    // Then run webpack on the output files
    gulp.src('./out/**/*react/index.js')
        .pipe(es.through(file => webify(file, false)));

    done();
});

gulp.task('compile-webviews-watch', () => {
    // Watch all files that are written by the compile task, except for the bundle generated
    // by compile-webviews. Watch the css files too, but in the src directory because webpack
    // will modify the output ones.
    gulp.watch(['./out/**/*react*/*.js', './src/**/*react*/*.{png,svg,css}', './out/**/react*/*.js', '!./out/**/*react*/*_bundle.js'], gulp.series('compile-webviews'));
});

const webify = (file) => {
    console.log('Webpacking ' + file.path);

    // Replace the entry with our actual file
    let config = Object.assign({}, webpack_config);
    config.entry = [...config.entry, file.path];

    // Update the output path to be next to our bundle.js
    const split = path.parse(file.path);
    config.output.path = split.dir;

    // Update our template to be based on our source
    const srcpath = path.join(__dirname, 'src', file.relative);
    const html = path.join(path.parse(srcpath).dir, 'index.html');
    config.plugins[0].options.template = html;

    // Then spawn our webpack on the base name
    let compiler = webpack(config);
    return new Promise((resolve, reject) => {

        // Create a callback for errors and such
        const compilerCallback = (err, stats) => {
            if (err) {
                return reject(err);
            }
            const messages = formatWebpackMessages(stats.toJson({}, true));
            if (messages.errors.length) {
                // Only keep the first error. Others are often indicative
                // of the same problem, but confuse the reader with noise.
                if (messages.errors.length > 1) {
                    messages.errors.length = 1;
                }
                return reject(new Error(messages.errors.join('\n\n')));
            }
            if (
                process.env.CI &&
                (typeof process.env.CI !== 'string' ||
                    process.env.CI.toLowerCase() !== 'false') &&
                messages.warnings.length
            ) {
                console.log(
                    chalk.yellow(
                        '\nTreating warnings as errors because process.env.CI = true.\n' +
                        'Most CI servers set it automatically.\n'
                    )
                );
                return reject(new Error(messages.warnings.join('\n\n')));
            }
            return resolve({
                stats,
                warnings: messages.warnings,
            });
        }

        // Watch doesn't seem to work
        compiler.run(compilerCallback);
    }).then(
        stats => {
            console.log(chalk.white('Finished ' + file.path + '.\n'));
            printBuildError(stats.warnings);
        }).catch(
            err => {
                console.log(chalk.red('Failed to compile.\n'));
                printBuildError(err);
            }
        )
}

function hasNativeDependencies() {
    let nativeDependencies = nativeDependencyChecker.check(path.join(__dirname, 'node_modules'));
    if (!Array.isArray(nativeDependencies) || nativeDependencies.length === 0) {
        return false;
    }
    const dependencies = JSON.parse(spawn.sync('npm', ['ls', '--json', '--prod']).stdout.toString());
    const jsonProperties = Object.keys(flat.flatten(dependencies));
    nativeDependencies = _.flatMap(nativeDependencies, item => path.dirname(item.substring(item.indexOf('node_modules') + 'node_modules'.length)).split(path.sep))
        .filter(item => item.length > 0)
        .filter(item => jsonProperties.findIndex(flattenedDependency => flattenedDependency.endsWith(`dependencies.${item}.version`)) >= 0);
    if (nativeDependencies.length > 0) {
        console.error('Native dependencies detected', nativeDependencies);
        return true;
    }
    return false;
}

function buildDebugAdapterCoverage(done) {
    const matches = glob.sync(path.join(__dirname, 'debug_coverage*/coverage.json'));
    matches.forEach(coverageFile => {
        const finalCoverageFile = path.join(path.dirname(coverageFile), 'coverage-final-upload.json');
        const remappedCollector = remapIstanbul.remap(JSON.parse(fs.readFileSync(coverageFile, 'utf8')), {
            warn: warning => {
                // We expect some warnings as any JS file without a typescript mapping will cause this.
                // By default, we'll skip printing these to the console as it clutters it up.
                console.warn(warning);
            }
        });

        const reporter = new istanbul.Reporter(undefined, path.dirname(coverageFile));
        reporter.add('lcov');
        reporter.write(remappedCollector, true, () => { });
    });

    done();
}

/**
* @typedef {Object} hygieneOptions - creates a new type named 'SpecialType'
* @property {'changes'|'staged'|'all'|'compile'|'diffMaster'} [mode=] - Mode.
* @property {boolean=} skipIndentationCheck - Skip indentation checks.
* @property {boolean=} skipFormatCheck - Skip format checks.
* @property {boolean=} skipCopyrightCheck - Skip copyright checks.
* @property {boolean=} skipLinter - Skip linter.
*/

const tsProjectMap = {};
/**
 *
 * @param {hygieneOptions} options
 */
function getTsProject(options) {
    const tsOptions = options.mode === 'compile' ? undefined : { strict: true, noImplicitAny: false, noImplicitThis: false };
    const mode = tsOptions && tsOptions.mode ? tsOptions.mode : '';
    return tsProjectMap[mode] ? tsProjectMap[mode] : tsProjectMap[mode] = ts.createProject('tsconfig.json', tsOptions);
}

let configuration;
/**
 *
 * @param {hygieneOptions} options
 */
function getLinter(options) {
    configuration = configuration ? configuration : tslint.Configuration.findConfiguration(null, '.');
    const program = tslint.Linter.createProgram('./tsconfig.json');
    const linter = new tslint.Linter({ formatter: 'json' }, program);
    return { linter, configuration };
}
let compilationInProgress = false;
let reRunCompilation = false;
/**
 *
 * @param {hygieneOptions} options
 * @returns {NodeJS.ReadWriteStream}
 */
const hygiene = (options, done) => {
    if (compilationInProgress) {
        reRunCompilation = true;
        return done();
    }
    const fileListToProcess = options.mode === 'compile' ? undefined : getFileListToProcess(options);
    if (Array.isArray(fileListToProcess) && fileListToProcess !== all
        && fileListToProcess.filter(item => item.endsWith('.ts')).length === 0) {
        return done();
    }

    const started = new Date().getTime();
    compilationInProgress = true;
    options = options || {};
    let errorCount = 0;
    const addedFiles = options.skipCopyrightCheck ? [] : getAddedFilesSync();
    const copyrights = es.through(function (file) {
        if (addedFiles.indexOf(file.path) !== -1) {
            const contents = file.contents.toString('utf8');
            if (!copyrightHeaders.some(header => contents.indexOf(header) === 0)) {
                // Use tslint format.
                console.error(`ERROR: (copyright) ${file.relative}[1,1]: Missing or bad copyright statement`);
                errorCount++;
            }
        }

        this.emit('data', file);
    });

    const indentation = es.through(function (file) {
        file.contents
            .toString('utf8')
            .split(/\r\n|\r|\n/)
            .forEach((line, i) => {
                if (/^\s*$/.test(line) || /^\S+.*$/.test(line)) {
                    // Empty or whitespace lines are OK.
                } else if (/^(\s\s\s\s)+.*/.test(line)) {
                    // Good indent.
                } else if (/^[\t]+.*/.test(line)) {
                    console.error(file.relative + '(' + (i + 1) + ',1): Bad whitespace indentation (use 4 spaces instead of tabs or other)');
                    errorCount++;
                }
            });

        this.emit('data', file);
    });

    const formatOptions = { verify: true, tsconfig: true, tslint: true, editorconfig: true, tsfmt: true };
    const formatting = es.map(function (file, cb) {
        tsfmt.processString(file.path, file.contents.toString('utf8'), formatOptions)
            .then(result => {
                if (result.error) {
                    let message = result.message.trim();
                    let formattedMessage = '';
                    if (message.startsWith(__dirname)) {
                        message = message.substr(__dirname.length);
                        message = message.startsWith(path.sep) ? message.substr(1) : message;
                        const index = message.indexOf('.ts ');
                        if (index === -1) {
                            formattedMessage = colors.red(message);
                        } else {
                            const file = message.substr(0, index + 3);
                            const errorMessage = message.substr(index + 4).trim();
                            formattedMessage = `${colors.red(file)} ${errorMessage}`;
                        }
                    } else {
                        formattedMessage = colors.red(message);
                    }
                    console.error(formattedMessage);
                    errorCount++;
                }
                cb(null, file);
            })
            .catch(cb);
    });

    let reportedLinterFailures = [];
    /**
     * Report the linter failures
     * @param {any[]} failures
     */
    function reportLinterFailures(failures) {
        return failures
            .map(failure => {
                const name = failure.name || failure.fileName;
                const position = failure.startPosition;
                const line = position.lineAndCharacter ? position.lineAndCharacter.line : position.line;
                const character = position.lineAndCharacter ? position.lineAndCharacter.character : position.character;

                // Output in format similar to tslint for the linter to pickup.
                const message = `ERROR: (${failure.ruleName}) ${relative(__dirname, name)}[${line + 1}, ${character + 1}]: ${failure.failure}`;
                if (reportedLinterFailures.indexOf(message) === -1) {
                    console.error(message);
                    reportedLinterFailures.push(message);
                    return true;
                } else {
                    return false;
                }
            })
            .filter(reported => reported === true)
            .length > 0;
    }

    const { linter, configuration } = getLinter(options);
    const tsl = es.through(function (file) {
        const contents = file.contents.toString('utf8');
        // Don't print anything to the console, we'll do that.
        console.log('.');
        // Yes this is a hack, but tslinter doesn't provide an option to prevent this.
        const oldWarn = console.warn;
        console.warn = () => { };
        linter.failures = [];
        linter.fixes = [];
        linter.lint(file.relative, contents, configuration.results);
        console.warn = oldWarn;
        const result = linter.getResult();
        if (result.failureCount > 0 || result.errorCount > 0) {
            const reported = reportLinterFailures(result.failures);
            if (result.failureCount && reported) {
                errorCount += result.failureCount;
            }
            if (result.errorCount && reported) {
                errorCount += result.errorCount;
            }
        }
        this.emit('data', file);
    });

    const tsFiles = [];
    const tscFilesTracker = es.through(function (file) {
        tsFiles.push(file.path.replace(/\\/g, '/'));
        tsFiles.push(file.path);
        this.emit('data', file);
    });

    const tsProject = getTsProject(options);

    const tsc = function () {
        function customReporter() {
            return {
                error: function (error, typescript) {
                    const fullFilename = error.fullFilename || '';
                    const relativeFilename = error.relativeFilename || '';
                    if (tsFiles.findIndex(file => fullFilename === file || relativeFilename === file) === -1) {
                        return;
                    }
                    console.error(`Error: ${error.message}`);
                    errorCount += 1;
                },
                finish: function () {
                    // forget the summary.
                    console.log('Finished compilation');
                }
            };
        }
        const reporter = customReporter();
        return tsProject(reporter);
    }

    const files = options.mode === 'compile' ? tsProject.src() : getFilesToProcess(fileListToProcess);
    const dest = options.mode === 'compile' ? './out' : '.';
    let result = files
        .pipe(filter(f => f && f.stat && !f.stat.isDirectory()));

    if (!options.skipIndentationCheck) {
        result = result.pipe(filter(indentationFilter))
            .pipe(indentation);
    }

    result = result
        .pipe(filter(tslintFilter));

    if (!options.skipCopyrightCheck) {
        result = result.pipe(copyrights);
    }

    if (!options.skipFormatCheck) {
        // result = result
        //     .pipe(formatting);
    }

    if (!options.skipLinter) {
        result = result
            .pipe(tsl);
    }
    let totalTime = 0;
    result = result
        .pipe(tscFilesTracker)
        .pipe(sourcemaps.init())
        .pipe(tsc())
        .pipe(sourcemaps.mapSources(function (sourcePath, file) {
            let tsFileName = path.basename(file.path).replace(/js$/, 'ts');
            const qualifiedSourcePath = path.dirname(file.path).replace('out/', 'src/').replace('out\\', 'src\\');
            if (!fs.existsSync(path.join(qualifiedSourcePath, tsFileName))) {
                const tsxFileName = path.basename(file.path).replace(/js$/, 'tsx');
                if (!fs.existsSync(path.join(qualifiedSourcePath, tsxFileName))) {
                    console.error(`ERROR: (source-maps) ${file.path}[1,1]: Source file not found`);
                } else {
                    tsFileName = tsxFileName;
                }
            }
            return path.join(path.relative(path.dirname(file.path), qualifiedSourcePath), tsFileName);
        }))
        .pipe(sourcemaps.write('.', { includeContent: false }))
        .pipe(gulp.dest(dest))
        .pipe(es.through(null, function () {
            if (errorCount > 0) {
                const errorMessage = `Hygiene failed with errors 👎 . Check 'gulpfile.js' (completed in ${new Date().getTime() - started}ms).`;
                console.error(colors.red(errorMessage));
                exitHandler(options);
            } else {
                console.log(colors.green(`Hygiene passed with 0 errors 👍 (completed in ${new Date().getTime() - started}ms).`));
            }
            // Reset error counter.
            errorCount = 0;
            reportedLinterFailures = [];
            compilationInProgress = false;
            if (reRunCompilation) {
                reRunCompilation = false;
                setTimeout(() => {
                    hygiene(options, done);
                }, 10);
            }
            done();
            this.emit('end');
        }))
        .on('error', ex => {
            exitHandler(options, ex);
            done();
        });

    return result;
};

/**
* @typedef {Object} runOptions
* @property {boolean=} exitOnError - Exit on error.
* @property {'changes'|'staged'|'all'} [mode=] - Mode.
* @property {string[]=} files - Optional list of files to be modified.
* @property {boolean=} skipIndentationCheck - Skip indentation checks.
* @property {boolean=} skipFormatCheck - Skip format checks.
* @property {boolean=} skipCopyrightCheck - Skip copyright checks.
* @property {boolean=} skipLinter - Skip linter.
 * @property {boolean=} watch - Watch mode.
*/

/**
* Run the linters.
* @param {runOptions} options
* @param {Error} ex
*/
function exitHandler(options, ex) {
    console.error();
    if (ex) {
        console.error(ex);
        console.error(colors.red(ex));
    }
    if (options.exitOnError) {
        console.log('exit');
        process.exit(1);
    }
}

/**
* Run the linters.
* @param {runOptions} options
*/
function run(options, done) {
    done = done || noop;
    options = options ? options : {};
    options.exitOnError = typeof options.exitOnError === 'undefined' ? isCI : options.exitOnError;
    process.once('unhandledRejection', (reason, p) => {
        console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
        exitHandler(options);
    });

    // Clear screen each time
    console.log('\x1Bc');
    const startMessage = `Hygiene starting`;
    console.log(colors.blue(startMessage));


    hygiene(options, done);
}

function git(args) {
    let result = cp.spawnSync('git', args, { encoding: 'utf-8' });
    return result.output.join('\n');
}

function getStagedFilesSync() {
    const out = git(['diff','--cached','--name-only']);
    return out
        .split(/\r?\n/)
        .filter(l => !!l);
}
function getAddedFilesSync() {
    const out = git(['status','-u','-s']);
    return out
        .split(/\r?\n/)
        .filter(l => !!l)
        .filter(l => _.intersection(['A', '?', 'U'], l.substring(0, 2).trim().split('')).length > 0)
        .map(l => path.join(__dirname, l.substring(2).trim()));
}
function getAzureDevOpsVarValue(varName) {
    return process.env[varName.replace(/\./g, '_').toUpperCase()]
}
function getModifiedFilesSync() {
    if (isCI) {
        const isAzurePR = getAzureDevOpsVarValue('System.PullRequest.SourceBranch') !== undefined;
        const isTravisPR = process.env.TRAVIS_PULL_REQUEST !== undefined && process.env.TRAVIS_PULL_REQUEST !== 'true';
        if (!isAzurePR && !isTravisPR) {
            return [];
        }
        const targetBranch = process.env.TRAVIS_BRANCH || getAzureDevOpsVarValue('System.PullRequest.TargetBranch');
        if (targetBranch !== 'master') {
            return [];
        }

        const repo = process.env.TRAVIS_REPO_SLUG || getAzureDevOpsVarValue('Build.Repository.Name');
        const originOrUpstream = (repo.toUpperCase() === 'MICROSOFT/VSCODE-PYTHON' || repo.toUpperCase() === 'VSCODE-PYTHON-DATASCIENCE/VSCODE-PYTHON') ? 'origin' : 'upstream';

        // If on CI, get a list of modified files comparing against
        // PR branch and master of current (assumed 'origin') repo.
        cp.execSync(`git remote set-branches --add ${originOrUpstream} master`, { encoding: 'utf8', cwd: __dirname });
        cp.execSync('git fetch', { encoding: 'utf8', cwd: __dirname });
        const cmd = `git diff --name-only HEAD ${originOrUpstream}/master`;
        console.info(cmd);
        const out = cp.execSync(cmd, { encoding: 'utf8', cwd: __dirname });
        return out
            .split(/\r?\n/)
            .filter(l => !!l)
            .filter(l => l.length > 0)
            .map(l => l.trim().replace(/\//g, path.sep))
            .map(l => path.join(__dirname, l));
    } else {
        const out = cp.execSync('git status -u -s', { encoding: 'utf8' });
        return out
            .split(/\r?\n/)
            .filter(l => !!l)
            .filter(l => _.intersection(['M', 'A', 'R', 'C', 'U', '?'], l.substring(0, 2).trim().split('')).length > 0)
            .map(l => path.join(__dirname, l.substring(2).trim().replace(/\//g, path.sep)));
    }
}

function getDifferentFromMasterFilesSync() {
    const out = git(['diff','--name-status','master']);
    return out
        .split(/\r?\n/)
        .filter(l => !!l)
        .map(l => path.join(__dirname, l.substring(2).trim()));
}

/**
* @param {hygieneOptions} options
*/
function getFilesToProcess(fileList) {
    const gulpSrcOptions = { base: '.' };
    return gulp.src(fileList, gulpSrcOptions);
}

/**
* @param {hygieneOptions} options
*/
function getFileListToProcess(options) {
    const mode = options ? options.mode : 'all';
    const gulpSrcOptions = { base: '.' };

    // If we need only modified files, then filter the glob.
    if (options && options.mode === 'changes') {
        return getModifiedFilesSync().filter(f => fs.existsSync(f));
    }

    if (options && options.mode === 'staged') {
        return getStagedFilesSync().filter(f => fs.existsSync(f));;
    }

    if (options && options.mode === 'diffMaster') {
        return getDifferentFromMasterFilesSync().filter(f => fs.existsSync(f));;
    }

    return all;
}

exports.hygiene = hygiene;

// this allows us to run hygiene via CLI (e.g. `node gulfile.js`).
if (require.main === module) {
    const args = process.argv0.length > 2 ? process.argv.slice(2) : [];
    const isPreCommit = args.findIndex(arg => arg.startsWith('precommit='));
    const performPreCommitCheck = isPreCommit >= 0 ? args[isPreCommit].split('=')[1].trim().toUpperCase().startsWith('T') : false;
    // Allow precommit hooks for those with a file `./out/precommit.hook`.
    if (args.length > 0 && (!performPreCommitCheck || !fs.existsSync(path.join(__dirname, 'precommit.hook')))) {
        return;
    }
    run({ exitOnError: true, mode: 'staged' }, () => {});
}
