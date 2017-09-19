/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

const gulp = require('gulp');
const filter = require('gulp-filter');
const es = require('event-stream');
const gulptslint = require('gulp-tslint');
const gulpeslint = require('gulp-eslint');
const tsfmt = require('typescript-formatter');
const tslint = require('tslint');
const path = require('path');
const fs = require('fs');

/**
 * Hygiene works by creating cascading subsets of all our files and
 * passing them through a sequence of checks. Here are the current subsets,
 * named according to the checks performed on them. Each subset contains
 * the following one, as described in mathematical notation:
 *
 * all ⊃ eol ⊇ indentation ⊃ copyright ⊃ typescript
 */

const all = [
    'src/**/*',
    'src/client/**/*',
];

const eolFilter = [
    '**',
    '!ThirdPartyNotices.txt',
    '!LICENSE.txt',
    '!extensions/**/out/**',
    '!test/smoke/out/**',
    '!**/node_modules/**',
    '!**/fixtures/**',
    '!**/*.{svg,exe,png,bmp,scpt,bat,cmd,cur,ttf,woff,eot}',
    '!build/{lib,tslintRules}/**/*.js',
    '!build/monaco/**',
    '!build/win32/**',
    '!build/**/*.sh',
    '!build/tfs/**/*.js',
    '!**/Dockerfile',
    '!build/**/*',
    '!out/**/*',
    '!images/**/*',
    '!docs/**/*',
    '!.vscode/**/*',
    '!pythonFiles/**/*',
    '!resources/**/*',
    '!snippets/**/*',
    '!syntaxes/**/*',
    '!typings/**/*',
];

const indentationFilter = [
    '**',
    '!ThirdPartyNotices.txt',
    '!**/*.md',
    '!**/*.ps1',
    '!**/*.template',
    '!**/*.yml',
    '!**/lib/**',
    '!extensions/**/*.d.ts',
    '!src/typings/**/*.d.ts',
    '!src/vs/*/**/*.d.ts',
    '!**/*.d.ts.recipe',
    '!test/assert.js',
    '!**/package.json',
    '!**/npm-shrinkwrap.json',
    '!**/octicons/**',
    '!**/vs/base/common/marked/raw.marked.js',
    '!**/vs/base/common/winjs.base.raw.js',
    '!**/vs/base/node/terminateProcess.sh',
    '!**/vs/nls.js',
    '!**/vs/css.js',
    '!**/vs/loader.js',
    '!extensions/**/snippets/**',
    '!extensions/**/syntaxes/**',
    '!extensions/**/themes/**',
    '!extensions/**/colorize-fixtures/**',
    '!extensions/vscode-api-tests/testWorkspace/**',
    '!build/**/*',
    '!out/**/*',
    '!images/**/*',
    '!docs/**/*',
    '!.vscode/**/*',
    '!pythonFiles/**/*',
    '!resources/**/*',
    '!snippets/**/*',
    '!syntaxes/**/*',
    '!typings/**/*',
];

const copyrightFilter = [
    '**',
    '!**/*.desktop',
    '!**/*.json',
    '!**/*.html',
    '!**/*.template',
    '!**/*.md',
    '!**/*.bat',
    '!**/*.cmd',
    '!**/*.xml',
    '!**/*.sh',
    '!**/*.txt',
    '!**/*.xpm',
    '!**/*.opts',
    '!**/*.disabled',
    '!build/**/*.init',
    '!resources/win32/bin/code.js',
    '!extensions/markdown/media/tomorrow.css',
    '!extensions/html/server/src/modes/typescript/*',
    '!build/**/*',
    '!out/**/*',
    '!images/**/*',
    '!docs/**/*',
    '!.vscode/**/*',
    '!pythonFiles/**/*',
    '!resources/**/*',
    '!snippets/**/*',
    '!syntaxes/**/*',
    '!typings/**/*',
];

const eslintFilter = [
    'src/**/*.js',
    'build/gulpfile.*.js',
    '!src/vs/loader.js',
    '!src/vs/css.js',
    '!src/vs/nls.js',
    '!src/vs/css.build.js',
    '!src/vs/nls.build.js',
    '!src/**/winjs.base.raw.js',
    '!src/**/raw.marked.js',
    '!**/test/**',
    '!build/**/*',
    '!out/**/*',
    '!images/**/*',
    '!docs/**/*',
    '!.vscode/**/*',
    '!pythonFiles/**',
    '!resources/**',
    '!snippets/**',
    '!syntaxes/**',
    '!typings/**',
];

const tslintFilter = [
    'src/**/*.ts',
    'test/**/*.ts',
    'extensions/**/*.ts',
    '!**/fixtures/**',
    '!**/typings/**',
    '!**/node_modules/**',
    '!extensions/typescript/test/colorize-fixtures/**',
    '!extensions/vscode-api-tests/testWorkspace/**',
    '!extensions/**/*.test.ts',
    '!build/**',
    '!out/**',
    '!images/**',
    '!docs/**',
    '!.vscode/**',
    '!pythonFiles/**',
    '!resources/**',
    '!snippets/**',
    '!syntaxes/**',
    '!typings/**',
];

const copyrightHeader = [
    '/*---------------------------------------------------------------------------------------------',
    ' *  Copyright (c) Microsoft Corporation. All rights reserved.',
    ' *  Licensed under the MIT License. See License.txt in the project root for license information.',
    ' *--------------------------------------------------------------------------------------------*/'
].join('\n');

function reportFailures(failures) {
    failures.forEach(failure => {
        const name = failure.name || failure.fileName;
        const position = failure.startPosition;
        const line = position.lineAndCharacter ? position.lineAndCharacter.line : position.line;
        const character = position.lineAndCharacter ? position.lineAndCharacter.character : position.character;

        console.error(`${name}:${line + 1}:${character + 1}:${failure.failure}`);
    });
}

gulp.task('eslint', () => {
    return gulp.src(all, {
            base: '.'
        })
        .pipe(filter(eslintFilter))
        .pipe(gulpeslint('.eslintrc'))
        .pipe(gulpeslint.formatEach('compact'))
        .pipe(gulpeslint.failAfterError());
});

gulp.task('tslint', () => {
    const options = {
        summarizeFailureOutput: true
    };

    return gulp.src(all, {
            base: '.'
        })
        .pipe(filter(tslintFilter))
        .pipe(gulptslint({
            rulesDirectory: 'build/lib/tslint'
        }))
        .pipe(gulptslint.report(reportFailures, options));
});

const hygiene = exports.hygiene = (some, options) => {
    options = options || {};
    let errorCount = 0;
    const eol = es.through(function (file) {
        if (/\r\n?/g.test(file.contents.toString('utf8'))) {
            console.error(file.relative + ': Bad EOL found');
            errorCount++;
        }

        this.emit('data', file);
    });

    const indentation = es.through(function (file) {
        file.contents
            .toString('utf8')
            .split(/\r\n|\r|\n/)
            .forEach((line, i) => {
                if (/^\s*$/.test(line)) {
                    // empty or whitespace lines are OK
                } else if (/^[\t]*[^\s]/.test(line)) {
                    // good indent
                } else if (/^[\t]* \*/.test(line)) {
                    // block comment using an extra space
                } else {
                    console.error(file.relative + '(' + (i + 1) + ',1): Bad whitespace indentation');
                    errorCount++;
                }
            });

        this.emit('data', file);
    });

    const copyrights = es.through(function (file) {
        if (file.contents.toString('utf8').indexOf(copyrightHeader) !== 0) {
            console.error(file.relative + ': Missing or bad copyright statement');
            errorCount++;
        }

        this.emit('data', file);
    });

    const formatting = es.map(function (file, cb) {
        tsfmt.processString(file.path, file.contents.toString('utf8'), {
            verify: true,
            tsfmt: true,
            editorconfig: true
            // verbose: true
        }).then(result => {
            console.error('Has Error');
            console.error(result.error);
            if (result.error) {
                console.error(result.message);
                errorCount++;
            }
            cb(null, file);

        }, err => {
            cb(err);
        });
    });

    const tsl = es.through(function (file) {
        const configuration = tslint.Configuration.findConfiguration(null, '.');
        const options = {
            formatter: 'json',
            // rulesDirectory: ['node_modules/tslint-microsoft-contrib', 'node_modules/tslint-eslint-rules']
        };
        const contents = file.contents.toString('utf8');
        const linter = new tslint.Linter(options);
        linter.lint(file.relative, contents, configuration.results);
        const result = linter.getResult();
        if (result.failureCount > 0 || result.errorCount > 0) {
            reportFailures(result.failures);
            if (result.failureCount) {
                errorCount += result.failureCount;
            }
            if (result.errorCount) {
                errorCount += result.errorCount;
            }
        }

        this.emit('data', file);
    });

    const result = gulp.src(some || all, {
            base: '.'
        })
        .pipe(filter(f => !f.stat.isDirectory()))
        .pipe(filter(eolFilter))
        .pipe(options.skipEOL ? es.through() : eol)
        .pipe(filter(indentationFilter));
    // .pipe(indentation)
    // .pipe(filter(copyrightFilter))
    // .pipe(copyrights);

    const typescript = result
        .pipe(filter(tslintFilter))
        // .pipe(formatting)
        .pipe(tsl);

    // const javascript = result
    //     .pipe(filter(eslintFilter))
    //     .pipe(gulpeslint('.eslintrc'))
    //     .pipe(gulpeslint.formatEach('compact'))
    //     .pipe(gulpeslint.failAfterError());

    return es.merge(typescript)
        .pipe(es.through(null, function () {
            if (errorCount > 0) {
                this.emit('error', 'Hygiene failed with ' + errorCount + ' errors. Check \'build/gulpfile.hygiene.js\'.');
            } else {
                this.emit('end');
            }
        }));
};

gulp.task('hygiene', () => hygiene());

// this allows us to run hygiene as a git pre-commit hook
if (require.main === module) {
    const cp = require('child_process');

    process.on('unhandledRejection', (reason, p) => {
        console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
        process.exit(1);
    });

    cp.exec('git config core.autocrlf', (err, out) => {
        const skipEOL = out.trim() === 'true';

        if (process.argv.length > 2) {
            return hygiene(process.argv.slice(2), {
                skipEOL: skipEOL
            }).on('error', err => {
                console.error();
                console.error(err);
                process.exit(1);
            });
        }

        cp.exec('git diff --cached --name-only', {
            maxBuffer: 2000 * 1024
        }, (err, out) => {
            if (err) {
                console.error();
                console.error(err);
                process.exit(1);
            }

            const some = out
                .split(/\r?\n/)
                .filter(l => !!l);
            hygiene(some, {
                skipEOL: skipEOL
            }).on('error', err => {
                console.error();
                console.error(err);
                process.exit(1);
            });
        });
    });
}