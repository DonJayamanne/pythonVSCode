"use strict";
import * as path from 'path';
import * as _ from 'lodash';
import { IInterpreterLocatorService } from '../../contracts';
import { IInterpreterVersionService } from '../../interpreterVersion';
import { fsExistsAsync, IS_WINDOWS } from '../../../common/utils';
import { lookForInterpretersInDirectory } from '../helpers';
const untildify = require('untildify');

export class KnownPathsService implements IInterpreterLocatorService {
    public constructor(private knownSearchPaths: string[],
        private versionProvider: IInterpreterVersionService) { }
    public getInterpreters() {
        return this.suggestionsFromKnownPaths();
    }

    private suggestionsFromKnownPaths() {
        const promises = this.knownSearchPaths.map(dir => this.getInterpretersInDirectory(dir));
        return Promise.all<string[]>(promises)
            .then(listOfInterpreters => _.flatten(listOfInterpreters))
            .then(interpreters => interpreters.filter(item => item.length > 0))
            .then(interpreters => Promise.all(interpreters.map(interpreter => this.getInterpreterDetails(interpreter))));
    }
    private getInterpreterDetails(interpreter: string) {
        return this.versionProvider.getVersion(interpreter, path.basename(interpreter))
            .then(displayName => {
                return {
                    displayName,
                    path: interpreter
                };
            });
    }
    private getInterpretersInDirectory(dir: string) {
        return fsExistsAsync(dir)
            .then(exists => exists ? lookForInterpretersInDirectory(dir) : Promise.resolve<string[]>([]));
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
