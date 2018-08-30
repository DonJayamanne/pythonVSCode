// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { ExtensionContext, Uri } from 'vscode';
import { IApplicationShell } from '../common/application/types';
import '../common/extensions';
import { createDeferred } from '../common/helpers';
import { IPlatformService } from '../common/platform/types';
import { IPythonExecutionFactory, IPythonExecutionService } from '../common/process/types';
import { IServiceContainer } from '../ioc/types';

const DataVersion = 1;

export class InterpreterData {
  constructor(
    public readonly dataVersion: number,
    // tslint:disable-next-line:no-shadowed-variable
    public readonly path: string,
    public readonly version: string,
    public readonly prefix: string,
    public readonly searchPaths: string,
    public readonly hash: string
  ) { }
}

export class InterpreterDataService {
  constructor(
    private readonly context: ExtensionContext,
    private readonly serviceContainer: IServiceContainer) { }

  public async getInterpreterData(resource?: Uri): Promise<InterpreterData | undefined> {
    const executionFactory = this.serviceContainer.get<IPythonExecutionFactory>(IPythonExecutionFactory);
    const execService = await executionFactory.create({ resource });

    const interpreterPath = await execService.getExecutablePath();
    if (interpreterPath.length === 0) {
      return;
    }

    const cacheKey = `InterpreterData-${interpreterPath}`;
    let interpreterData = this.context.globalState.get(cacheKey) as InterpreterData;
    let interpreterChanged = false;
    if (interpreterData) {
      // Check if interpreter executable changed
      if (interpreterData.dataVersion !== DataVersion) {
        interpreterChanged = true;
      } else {
        const currentHash = await this.getInterpreterHash(interpreterPath);
        interpreterChanged = currentHash !== interpreterData.hash;
      }
    }

    if (interpreterChanged || !interpreterData) {
      interpreterData = await this.getInterpreterDataFromPython(execService, interpreterPath);
      this.context.globalState.update(interpreterPath, interpreterData);
    } else {
      // Make sure we verify that search paths did not change. This must be done
      // completely async so we don't delay Python language server startup.
      this.verifySearchPaths(interpreterData.searchPaths, interpreterPath, execService);
    }
    return interpreterData;
  }

  public getInterpreterHash(interpreterPath: string): Promise<string> {
    const platform = this.serviceContainer.get<IPlatformService>(IPlatformService);
    const pythonExecutable = path.join(path.dirname(interpreterPath), platform.isWindows ? 'python.exe' : 'python');
    // Hash mod time and creation time
    const deferred = createDeferred<string>();
    fs.lstat(pythonExecutable, (err, stats) => {
      if (err) {
        deferred.resolve('');
      } else {
        const actual = createHash('sha512').update(`${stats.ctime}-${stats.mtime}`).digest('hex');
        deferred.resolve(actual);
      }
    });
    return deferred.promise;
  }

  private async getInterpreterDataFromPython(execService: IPythonExecutionService, interpreterPath: string): Promise<InterpreterData> {
    const result = await execService.exec(['-c', 'import sys; print(sys.version_info); print(sys.prefix)'], {});
    // 2.7.14 (v2.7.14:84471935ed, Sep 16 2017, 20:19:30) <<SOMETIMES NEW LINE HERE>>
    // [MSC v.1500 32 bit (Intel)]
    // C:\Python27
    if (!result.stdout) {
      throw Error('Unable to determine Python interpreter version and system prefix.');
    }
    const output = result.stdout.splitLines({ removeEmptyEntries: true, trim: true });
    if (!output || output.length < 2) {
      throw Error('Unable to parse version and and system prefix from the Python interpreter output.');
    }
    const majorMatches = output[0].match(/major=(\d*?),/);
    const minorMatches = output[0].match(/minor=(\d*?),/);
    if (!majorMatches || majorMatches.length < 2 || !minorMatches || minorMatches.length < 2) {
      throw Error('Unable to parse interpreter version.');
    }
    const prefix = output[output.length - 1];
    const hash = await this.getInterpreterHash(interpreterPath);
    const searchPaths = await this.getSearchPaths(execService);
    return new InterpreterData(DataVersion, interpreterPath, `${majorMatches[1]}.${minorMatches[1]}`, prefix, searchPaths, hash);
  }

  private async getSearchPaths(execService: IPythonExecutionService): Promise<string> {
    const result = await execService.exec(['-c', 'import sys; print(sys.path);'], {});
    if (!result.stdout) {
      throw Error('Unable to determine Python interpreter search paths.');
    }
    // tslint:disable-next-line:no-unnecessary-local-variable
    const paths = result.stdout.split(',')
      .filter(p => this.isValidPath(p))
      .map(p => this.pathCleanup(p));
    return paths.join(';'); // PTVS uses ; on all platforms
  }

  private pathCleanup(s: string): string {
    s = s.trim();
    if (s[0] === '\'') {
      s = s.substr(1);
    }
    if (s[s.length - 1] === ']') {
      s = s.substr(0, s.length - 1);
    }
    if (s[s.length - 1] === '\'') {
      s = s.substr(0, s.length - 1);
    }
    return s;
  }

  private isValidPath(s: string): boolean {
    return s.length > 0 && s[0] !== '[';
  }

  private verifySearchPaths(currentPaths: string, interpreterPath: string, execService: IPythonExecutionService): void {
    this.getSearchPaths(execService)
      .then(async paths => {
        if (paths !== currentPaths) {
          this.context.globalState.update(interpreterPath, undefined);
          const appShell = this.serviceContainer.get<IApplicationShell>(IApplicationShell);
          await appShell.showWarningMessage('Search paths have changed for this Python interpreter. Please reload the extension to ensure that the IntelliSense works correctly.');
        }
      }).ignoreErrors();
  }
}
