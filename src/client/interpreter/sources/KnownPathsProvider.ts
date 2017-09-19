"use strict";
import * as path from "path";
import { IInterpreterProvider } from './contracts';
import { fsExistsAsync, IS_WINDOWS } from "../../common/utils";
import { PythonInterpreter } from '../index';
import { lookForInterpretersInDirectory, getFirstNonEmptyLineFromMultilineString } from './helpers';
import * as child_process from 'child_process';
import * as _ from 'lodash';
import * as untildify from 'untildify';
import { PythonSettings } from '../../common/configSettings';

const settings = PythonSettings.getInstance();

export class KnownPathsProvider implements IInterpreterProvider {
    public constructor(private knownSearchPaths: string[]) { }
    public getInterpreters() {
        return this.suggestionsFromKnownPaths();
    }

    private suggestionsFromKnownPaths() {
        const promises = this.knownSearchPaths.map(dir => this.getInterpretersInDirectory(dir));
        const currentPythonInterpreter = this.getInterpreter(settings.pythonPath).then(interpreter => [interpreter]);
        const defaultPythonInterpreter = this.getInterpreter('python').then(interpreter => [interpreter]);
        const python3 = this.getInterpreter('python3').then(interpreter => interpreter.indexOf('/anaconda') > 0 ? [] : [interpreter]);
        const python2 = this.getInterpreter('python2').then(interpreter => interpreter.indexOf('/anaconda') > 0 ? [] : [interpreter]);
        return Promise.all<string[]>(promises.concat(currentPythonInterpreter, defaultPythonInterpreter, python3, python2))
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
    private getInterpreter(pythonPath: string) {
        return new Promise<string>(resolve => {
            child_process.execFile(pythonPath, ["-c", "import sys;print(sys.executable)"], (_, stdout) => {
                console.error(stdout);
                resolve(getFirstNonEmptyLineFromMultilineString(stdout));
            });
        })
            .then(value => value.length === 0 ? pythonPath : value);
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
