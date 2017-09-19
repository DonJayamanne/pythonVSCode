"use strict";
import * as path from "path";
import { IInterpreterProvider } from './contracts';
import { fsExistsAsync, execPythonFile, IS_WINDOWS } from "../../common/utils";
import { PythonInterpreter } from '../index';
import { lookForInterpretersInDirectory, getFirstNonEmptyLineFromMultilineString } from './helpers';
import * as child_process from 'child_process';
import * as _ from 'lodash';
import * as untildify from 'untildify';

export class KnownPathsProvider implements IInterpreterProvider {
    public constructor(private knownSearchPaths: string[]) { }
    public getInterpreters() {
        return this.suggestionsFromKnownPaths();
    }

    private suggestionsFromKnownPaths() {
        const promises = this.knownSearchPaths.map(dir => this.getInterpretersInDirectory(dir));
        const currentPythonInterpreter = this.getCurrentInterpreter().then(interpreter => [interpreter]);
        const defaultPythonInterpreter = this.getDefaultInterpreter().then(interpreter => [interpreter]);
        return Promise.all<string[]>(promises.concat(currentPythonInterpreter, defaultPythonInterpreter))
            .then(listOfInterpreters => _.flatten(listOfInterpreters))
            .then(interpreters => interpreters.filter(item => item.length > 0))
            .then(interpreters => interpreters.map(interpreter => this.getInterpreterDetails(interpreter)));
    }
    private getInterpreterDetails(interpreter: string): PythonInterpreter {
        return {
            displayName: path.basename(interpreter),
            path: interpreter
        };
    }
    private getInterpretersInDirectory(dir: string) {
        return fsExistsAsync(dir)
            .then(exists => exists ? lookForInterpretersInDirectory(dir) : Promise.resolve<string[]>([]));
    }
    private getCurrentInterpreter() {
        return execPythonFile("python", ["-c", "import sys;print(sys.executable)"], __dirname)
            .then(stdout => getFirstNonEmptyLineFromMultilineString(stdout))
            .catch(() => '');
    }
    private getDefaultInterpreter() {
        return new Promise<string>(resolve => {
            child_process.execFile("python", ["-c", "import sys;print(sys.executable)"], (_, stdout) => {
                resolve(getFirstNonEmptyLineFromMultilineString(stdout));
            });
        });
    }

}

export function getKnownSearchPathsForInterpreters(): string[] {
    if (IS_WINDOWS) {
        return [];
    } else {
        let paths = ['/usr/local/bin', '/usr/bin', '/bin', '/usr/sbin', '/sbin', '/usr/local/sbin'];
        paths.forEach(p => {
            paths.push(untildify('~' + p));
        });
        // Add support for paths such as /Users/xxx/anaconda/bin
        if (process.env['HOME']) {
            paths.push(path.join(process.env['HOME'], 'anaconda', 'bin'));
            paths.push(path.join(process.env['HOME'], 'python', 'bin'));
        }
        return paths;
    }
}
