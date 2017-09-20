"use strict";
import * as path from 'path';
import { IInterpreterProvider } from '../contracts';
import { getInterpreterDisplayName } from '../../../common/utils';
import { getFirstNonEmptyLineFromMultilineString } from '../helpers';
import * as child_process from 'child_process';
import * as _ from 'lodash';
import { PythonSettings } from '../../../common/configSettings';

const settings = PythonSettings.getInstance();

export class CurrentPathProvider implements IInterpreterProvider {
    public constructor() { }
    public getInterpreters() {
        return this.suggestionsFromKnownPaths();
    }

    private suggestionsFromKnownPaths() {
        const currentPythonInterpreter = this.getInterpreter(settings.pythonPath, '').then(interpreter => [interpreter]);
        const python = this.getInterpreter('python', '').then(interpreter => [interpreter]);
        const python2 = this.getInterpreter('python2', '').then(interpreter => [interpreter]);
        const python3 = this.getInterpreter('python3', '').then(interpreter => [interpreter]);
        return Promise.all<string[]>([currentPythonInterpreter, python, python2, python3])
            .then(listOfInterpreters => _.flatten(listOfInterpreters))
            .then(interpreters => interpreters.filter(item => item.length > 0))
            .then(interpreters => Promise.all(interpreters.map(interpreter => this.getInterpreterDetails(interpreter))));
    }
    private getInterpreterDetails(interpreter: string) {
        return getInterpreterDisplayName(interpreter).catch(() => path.basename(interpreter))
            .then(displayName => {
                return {
                    displayName,
                    path: interpreter
                };
            });
    }
    private getInterpreter(pythonPath: string, defaultValue: string) {
        return new Promise<string>(resolve => {
            child_process.execFile(pythonPath, ["-c", "import sys;print(sys.executable)"], (_, stdout) => {
                resolve(getFirstNonEmptyLineFromMultilineString(stdout));
            });
        })
            .then(value => value.length === 0 ? defaultValue : value);
    }
}
