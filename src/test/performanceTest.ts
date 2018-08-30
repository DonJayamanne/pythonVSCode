// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

/*
Comparing performance metrics is not easy (the metrics can and always get skewed).
One approach is to run the tests multile times and gather multiple sample data.
For Extension activation times, we load both extensions x times, and re-load the window y times in each x load.
I.e. capture averages by giving the extensions sufficient time to warm up.
This block of code merely launches the tests by using either the dev or release version of the extension,
and spawning the tests (mimic user starting tests from command line), this way we can run tests multiple times.
*/

// tslint:disable:no-console no-require-imports no-var-requires

import { spawn } from 'child_process';
import * as download from 'download';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as request from 'request';
import { EXTENSION_ROOT_DIR } from '../client/common/constants';

const NamedRegexp = require('named-js-regexp');
const StreamZip = require('node-stream-zip');
const del = require('del');

const tmpFolder = path.join(EXTENSION_ROOT_DIR, 'tmp');
const publishedExtensionPath = path.join(tmpFolder, 'ext', 'testReleaseExtensionsFolder');
const logFilesPath = path.join(tmpFolder, 'test', 'logs');

enum Version {
    Dev, Release
}

class TestRunner {
    public async start() {
        await del([path.join(tmpFolder, '**')]);
        await this.extractLatestExtension(publishedExtensionPath);

        const timesToLoadEachVersion = 3;
        const devLogFiles: string[] = [];
        const releaseLogFiles: string[] = [];
        const newAnalysisEngineLogFiles: string[] = [];

        for (let i = 0; i < timesToLoadEachVersion; i += 1) {
            await this.enableNewAnalysisEngine(false);

            const devLogFile = path.join(logFilesPath, `dev_loadtimes${i}.txt`);
            await this.capturePerfTimes(Version.Dev, devLogFile);
            devLogFiles.push(devLogFile);

            const releaseLogFile = path.join(logFilesPath, `release_loadtimes${i}.txt`);
            await this.capturePerfTimes(Version.Release, releaseLogFile);
            releaseLogFiles.push(releaseLogFile);

            // New Analysis engine.
            await this.enableNewAnalysisEngine(true);
            const newAnalysisEngineLogFile = path.join(logFilesPath, `newAnalysisEngine_loadtimes${i}.txt`);
            await this.capturePerfTimes(Version.Release, newAnalysisEngineLogFile);
            newAnalysisEngineLogFiles.push(newAnalysisEngineLogFile);
        }

        await this.runPerfTest(devLogFiles, releaseLogFiles, newAnalysisEngineLogFiles);
    }
    private async enableNewAnalysisEngine(enable: boolean) {
        const settings = `{ "python.jediEnabled": ${!enable} }`;
        await fs.writeFile(path.join(EXTENSION_ROOT_DIR, 'src', 'test', 'performance', 'settings.json'), settings);
    }

    private async  capturePerfTimes(version: Version, logFile: string) {
        const releaseVersion = await this.getReleaseVersion();
        const devVersion = await this.getDevVersion();
        await fs.ensureDir(path.dirname(logFile));
        const env: { [key: string]: {} } = {
            ACTIVATION_TIMES_LOG_FILE_PATH: logFile,
            ACTIVATION_TIMES_EXT_VERSION: version === Version.Release ? releaseVersion : devVersion,
            CODE_EXTENSIONS_PATH: version === Version.Release ? publishedExtensionPath : EXTENSION_ROOT_DIR
        };

        await this.launchTest(env);
    }
    private async  runPerfTest(devLogFiles: string[], releaseLogFiles: string[], newAnalysisEngineLogFiles: string[]) {
        const env: { [key: string]: {} } = {
            ACTIVATION_TIMES_DEV_LOG_FILE_PATHS: JSON.stringify(devLogFiles),
            ACTIVATION_TIMES_RELEASE_LOG_FILE_PATHS: JSON.stringify(releaseLogFiles),
            ACTIVATION_TIMES_DEV_ANALYSIS_LOG_FILE_PATHS: JSON.stringify(newAnalysisEngineLogFiles)
        };

        await this.launchTest(env);
    }

    private async  launchTest(customEnvVars: { [key: string]: {} }) {
        await new Promise((resolve, reject) => {
            const env: { [key: string]: {} } = {
                TEST_FILES_SUFFIX: 'perf.test',
                CODE_TESTS_WORKSPACE: path.join(EXTENSION_ROOT_DIR, 'src', 'test', 'performance'),
                ...process.env,
                ...customEnvVars
            };

            const proc = spawn('node', [path.join(__dirname, 'standardTest.js')], { cwd: EXTENSION_ROOT_DIR, env });
            proc.stdout.pipe(process.stdout);
            proc.stderr.pipe(process.stderr);
            proc.on('error', reject);
            proc.on('close', code => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(`Failed with code ${code}.`);
                }
            });
        });
    }

    private async extractLatestExtension(targetDir: string): Promise<void> {
        const extensionFile = await this.downloadExtension();
        await this.unzip(extensionFile, targetDir);
    }

    private async  getReleaseVersion(): Promise<string> {
        const url = 'https://marketplace.visualstudio.com/items?itemName=ms-python.python';
        const content = await new Promise<string>((resolve, reject) => {
            request(url, (error, response, body) => {
                if (error) {
                    return reject(error);
                }
                if (response.statusCode === 200) {
                    return resolve(body);
                }
                reject(`Status code of ${response.statusCode} received.`);
            });
        });
        const re = NamedRegexp('"version"\S?:\S?"(:<version>\\d{4}\\.\\d{1,2}\\.\\d{1,2})"', 'g');
        const matches = re.exec(content);
        return matches.groups().version;
    }

    private async  getDevVersion(): Promise<string> {
        // tslint:disable-next-line:non-literal-require
        return require(path.join(EXTENSION_ROOT_DIR, 'package.json')).version;
    }

    private async  unzip(zipFile: string, targetFolder: string): Promise<void> {
        await fs.ensureDir(targetFolder);
        return new Promise<void>((resolve, reject) => {
            const zip = new StreamZip({
                file: zipFile,
                storeEntries: true
            });
            zip.on('ready', async () => {
                zip.extract('extension', targetFolder, err => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                    zip.close();
                });
            });
        });
    }

    private async downloadExtension(): Promise<string> {
        const version = await this.getReleaseVersion();
        const url = `https://marketplace.visualstudio.com/_apis/public/gallery/publishers/ms-python/vsextensions/python/${version}/vspackage`;
        const destination = path.join(__dirname, `extension${version}.zip`);
        if (await fs.pathExists(destination)) {
            return destination;
        }

        await download(url, path.dirname(destination), { filename: path.basename(destination) });
        return destination;
    }
}

new TestRunner().start().catch(ex => console.error('Error in running Performance Tests', ex));
