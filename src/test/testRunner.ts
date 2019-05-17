// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// tslint:disable:no-require-imports no-var-requires import-name no-function-expression no-any prefer-template no-console no-var-self
// Most of the source is in node_modules/vscode/lib/testrunner.js

'use strict';
import * as fs from 'fs-extra';
import * as glob from 'glob';
import * as istanbul from 'istanbul';
import * as Mocha from 'mocha';
import * as path from 'path';
import * as process from 'process';
import { MochaSetupOptions } from 'vscode/lib/testrunner';
const remapIstanbul = require('remap-istanbul');
import { IS_SMOKE_TEST } from './constants';
import { initialize } from './initialize';

interface ITestRunnerOptions {
    enabled?: boolean;
    relativeCoverageDir: string;
    relativeSourcePath: string;
    ignorePatterns: string[];
    includePid?: boolean;
    reports?: string[];
    verbose?: boolean;
}

// http://gotwarlost.github.io/istanbul/public/apidocs/files/lib_instrumenter.js.html#l478.
type CoverState = {
    path: string;
    s: {};
    b: {};
    f: {};
    fnMap: {};
    statementMap: {};
    branchMap: {};
};

type Instrumenter = istanbul.Instrumenter & { coverState: CoverState };
type TestCallback = (error?: Error, failures?: number) => void;

// Linux: prevent a weird NPE when mocha on Linux requires the window size from the TTY.
// Since we are not running in a tty environment, we just implement the method statically.
const tty = require('tty');
if (!tty.getWindowSize) {
    tty.getWindowSize = function (): number[] {
        return [80, 75];
    };
}

let mocha = new Mocha(<any>{
    ui: 'tdd',
    colors: true
});

export type SetupOptions = MochaSetupOptions & {
    testFilesSuffix?: string;
    reporter?: string;
    reporterOptions?: {
        mochaFile?: string;
        properties?: string;
    };
};

let testFilesGlob = 'test';
let coverageOptions: { coverageConfig: string } | undefined;

export function configure(setupOptions: SetupOptions, coverageOpts?: { coverageConfig: string }): void {
    if (setupOptions.testFilesSuffix) {
        testFilesGlob = setupOptions.testFilesSuffix;
    }
    // Force Mocha to exit.
    (setupOptions as any).exit = true;
    mocha = new Mocha(setupOptions);
    coverageOptions = coverageOpts;
}
/**
 * Exits Mocha when Mocha itself has finished execution, regardless of
 * what the tests or code under test is doing.
 * @param {number} code - Exit code; typically # of failures
 * @ignore
 * @private
 */
const exitMocha = (code: number) => {
    const clampedCode = Math.min(code, 255);
    let draining = 0;

    // Eagerly set the process's exit code in case stream.write doesn't
    // execute its callback before the process terminates.
    (process as any).exitCode = clampedCode;

    // flush output for Node.js Windows pipe bug
    // https://github.com/joyent/node/issues/6247 is just one bug example
    // https://github.com/visionmedia/mocha/issues/333 has a good discussion
    const done = () => {
// tslint:disable-next-line: no-increment-decrement
        if (!draining--) {
            process.exit(clampedCode);
        }
    };

    const streams = [process.stdout, process.stderr];

    streams.forEach(stream => {
        // submit empty write request and wait for completion
        draining += 1;
        stream.write('', done);
    });

    done();
};

export function run(testsRoot: string, callback: TestCallback): void {
    // Enable source map support.
    require('source-map-support').install();

    // nteract/transforms-full expects to run in the browser so we have to fake
    // parts of the browser here.
    if (!IS_SMOKE_TEST) {
        const reactHelpers = require('./datascience/reactHelpers') as typeof import('./datascience/reactHelpers');
        reactHelpers.setUpDomEnvironment();
    }

    // Check whether code coverage is enabled.
    const options = getCoverageOptions(testsRoot);
    if (options && options.enabled) {
        // Setup coverage pre-test, including post-test hook to report.
        // tslint:disable-next-line:no-use-before-declare
        const coverageRunner = new CoverageRunner(options, testsRoot, callback);
        coverageRunner.setupCoverage();
    }

    /**
     * Waits until the Python Extension completes loading or a timeout.
     * When running tests within VSC, we need to wait for the Python Extension to complete loading,
     * this is where `initialize` comes in, we load the PVSC extension using VSC API, wait for it
     * to complete.
     * That's when we know out PVSC extension specific code is ready for testing.
     * So, this code needs to run always for every test running in VS Code (what we call these `system test`) .
     * @returns
     */
    function initializationScript() {
        const ex = new Error('Failed to initialize Python extension for tests after 2 minutes');
        let timer: NodeJS.Timer | undefined;
        const failed = new Promise((_, reject) => {
            timer = setTimeout(() => reject(ex), 120_000);
        });
        const promise = Promise.race([initialize(), failed]);
        promise.then(() => clearTimeout(timer!)).catch(() => clearTimeout(timer!));
        return promise;
    }
    // Run the tests.
    glob(
        `**/**.${testFilesGlob}.js`,
        { ignore: ['**/**.unit.test.js', '**/**.functional.test.js'], cwd: testsRoot },
        (error, files) => {
            if (error) {
                return callback(error);
            }
            try {
                files.forEach(file => mocha.addFile(path.join(testsRoot, file)));
                initializationScript()
                    .then(() => mocha.run(failures => {
                        // Force exit, don't wait for process to die.
                        // callback(undefined, failures);
                        exitMocha(failures);
                    }))
                    .catch(callback);
            } catch (error) {
                return callback(error);
            }
        }
    );
}

function getCoverageOptions(testsRoot: string): ITestRunnerOptions | undefined {
    if (!coverageOptions) {
        return undefined;
    }
    const coverConfigPath = path.join(testsRoot, coverageOptions.coverageConfig);
    return fs.existsSync(coverConfigPath) ? JSON.parse(fs.readFileSync(coverConfigPath, 'utf8')) : undefined;
}

class CoverageRunner {
    private readonly coverageVar: string = `$$cov_${new Date().getTime()}$$`;
    private sourceFiles: string[] = [];
    private instrumenter!: Instrumenter;

    private get coverage(): Record<string, CoverState> {
        // @ts-ignore
        if (global[this.coverageVar] === undefined || Object.keys(global[this.coverageVar]).length === 0) {
            console.error('No coverage information was collected, exit without writing coverage information');
            return {};
        } else {
            // @ts-ignore
            return global[this.coverageVar];
        }
    }
    private set coverage(value: Record<string, CoverState>) {
        // @ts-ignore
        global[this.coverageVar] = value;
    }

    constructor(
        private readonly options: ITestRunnerOptions,
        private readonly testsRoot: string,
        endRunCallback: TestCallback
    ) {
        if (!options.relativeSourcePath) {
            endRunCallback(new Error('Error - relativeSourcePath must be defined for code coverage to work'));
        }
    }
    /**
     * Information on hooking up code coverage can be found here:
     * http://tannguyen.org/2017/04/gulp-mocha-and-istanbul/
     * http://gotwarlost.github.io/istanbul/public/apidocs/classes/HookOptions.html
     * @memberof CoverageRunner
     */
    public setupCoverage(): void {
        const reportingDir = path.join(this.testsRoot, this.options.relativeCoverageDir);
        fs.emptyDirSync(reportingDir);

        // Set up Code Coverage, hooking require so that instrumented code is returned.
        this.instrumenter = new istanbul.Instrumenter({ coverageVariable: this.coverageVar }) as Instrumenter;
        const sourceRoot = path.join(this.testsRoot, this.options.relativeSourcePath);

        // Glob source files
        const srcFiles = glob.sync('**/**.js', {
            ignore: this.options.ignorePatterns,
            cwd: sourceRoot
        });

        // Create a match function - taken from the run-with-cover.js in istanbul.
        const decache = require('decache');
        const fileMap = new Set<string>();
        srcFiles
            .map(file => path.join(sourceRoot, file))
            .forEach(fullPath => {
                fileMap.add(fullPath);

                // On Windows, extension is loaded pre-test hooks and this mean we lose
                // our chance to hook the Require call. In order to instrument the code
                // we have to decache the JS file so on next load it gets instrumented.
                // This doesn't impact tests, but is a concern if we had some integration
                // tests that relied on VSCode accessing our module since there could be
                // some shared global state that we lose.
                decache(fullPath);
            });

        const matchFn = (file: string) => fileMap.has(file);
        this.sourceFiles = Array.from(fileMap.keys());

        // http://gotwarlost.github.io/istanbul/public/apidocs/classes/Hook.html#method_hookRequire.
        // Hook up to the Require function so that when this is called, if any of our source files
        // are required, the instrumented version is pulled in instead. These instrumented versions
        // write to a global coverage variable with hit counts whenever they are accessed.
        const transformer = this.instrumenter.instrumentSync.bind(this.instrumenter);
        const hookOpts = { verbose: false, extensions: ['.js'] };
        (<any>istanbul.hook).hookRequire(matchFn, transformer, hookOpts);

        // Initialize the global variable to store instrumentation details.
        // http://gotwarlost.github.io/istanbul/public/apidocs/classes/Instrumenter.html.
        this.coverage = {};

        // Hook the process exit event to handle reporting,
        // Only report coverage if the process is exiting successfully.
        process.on('exit', () => this.reportCoverage());
    }

    /**
     * Writes a coverage report. Note that as this is called in the process exit callback, all calls must be synchronous.
     * @returns {void}
     * @memberOf CoverageRunner
     */
    public reportCoverage(): void {
        (<any>istanbul.hook).unhookRequire();
        const coverage = this.coverage;

        // Files that are not touched by code ran by the test runner is manually instrumented, to
        // illustrate the missing coverage.
        this.sourceFiles
            .filter(file => !coverage[file])
            .forEach(file => {
                this.instrumenter.instrumentSync(fs.readFileSync(file, 'utf-8'), file);

                // When instrumenting the code, istanbul will give each FunctionDeclaration a value of 1 in coverState.s,
                // presumably to compensate for function hoisting. We need to reset this, as the function was not hoisted,
                // as it was never loaded.
                Object.keys(this.instrumenter.coverState.s).forEach(key => ((this.instrumenter.coverState.s as any)[key] = 0));

                coverage[file] = this.instrumenter.coverState;
            });

        const reportingDir = path.join(this.testsRoot, this.options.relativeCoverageDir);
        const coverageFile = path.join(reportingDir, 'coverage.json');

        fs.mkdirsSync(reportingDir);
        fs.writeFileSync(coverageFile, JSON.stringify(coverage), 'utf8');

        const remappedCollector: istanbul.Collector = remapIstanbul.remap(coverage, {
            warn: (warning: any) => {
                // We expect some warnings as any JS file without a typescript mapping will cause this.
                // By default, we'll skip printing these to the console as it clutters it up.
                if (this.options.verbose) {
                    console.warn(warning);
                }
            }
        });

        const reporter = new istanbul.Reporter(undefined, reportingDir);
        const reportTypes = Array.isArray(this.options.reports) ? this.options.reports! : ['lcov'];
        reporter.addAll(reportTypes);
        reporter.write(remappedCollector, true, () => console.log(`reports written to ${reportingDir}`));
    }
}
