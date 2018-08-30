// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:max-func-body-length no-any no-conditional-assignment no-increment-decrement no-invalid-this insecure-random
import { fail } from 'assert';
import { expect } from 'chai';
import { spawnSync } from 'child_process';
import * as path from 'path';
import * as typeMoq from 'typemoq';
import { EnumEx } from '../../client/common/enumUtils';
import { ILogger, Product } from '../../client/common/types';
import { IServiceContainer } from '../../client/ioc/types';
import { ArgumentsHelper } from '../../client/unittests/common/argumentsHelper';
import { ArgumentsService as NoseTestArgumentsService } from '../../client/unittests/nosetest/services/argsService';
import { ArgumentsService as PyTestArgumentsService } from '../../client/unittests/pytest/services/argsService';
import { IArgumentsHelper, IArgumentsService } from '../../client/unittests/types';
import { ArgumentsService as UnitTestArgumentsService } from '../../client/unittests/unittest/services/argsService';
import { PYTHON_PATH } from '../common';

suite('Unit Tests - argsService', () => {
    [Product.unittest, Product.nosetest, Product.pytest]
        .forEach(product => {
            const productNames = EnumEx.getNamesAndValues(Product);
            const productName = productNames.find(item => item.value === product)!.name;
            suite(productName, () => {
                let argumentsService: IArgumentsService;
                let moduleName = '';
                let expectedWithArgs: string[] = [];
                let expectedWithoutArgs: string[] = [];

                suiteSetup(() => {
                    const serviceContainer = typeMoq.Mock.ofType<IServiceContainer>();
                    const logger = typeMoq.Mock.ofType<ILogger>();

                    serviceContainer
                        .setup(s => s.get(typeMoq.It.isValue(ILogger), typeMoq.It.isAny()))
                        .returns(() => logger.object);

                    const argsHelper = new ArgumentsHelper(serviceContainer.object);

                    serviceContainer
                        .setup(s => s.get(typeMoq.It.isValue(IArgumentsHelper), typeMoq.It.isAny()))
                        .returns(() => argsHelper);

                    switch (product) {
                        case Product.unittest: {
                            argumentsService = new UnitTestArgumentsService(serviceContainer.object);
                            moduleName = 'unittest';
                            break;
                        }
                        case Product.nosetest: {
                            argumentsService = new NoseTestArgumentsService(serviceContainer.object);
                            moduleName = 'nose';
                            break;
                        }
                        case Product.pytest: {
                            moduleName = 'pytest';
                            argumentsService = new PyTestArgumentsService(serviceContainer.object);
                            break;
                        }
                        default: {
                            throw new Error('Unrecognized Test Framework');
                        }
                    }

                    expectedWithArgs = getOptions(product, moduleName, true);
                    expectedWithoutArgs = getOptions(product, moduleName, false);
                });

                test('Check for new/unrecognized options with values', () => {
                    const options = argumentsService.getKnownOptions();
                    const optionsNotFound = expectedWithArgs.filter(item => options.withArgs.indexOf(item) === -1);

                    if (optionsNotFound.length > 0) {
                        fail('', optionsNotFound.join(', '), 'Options not found');
                    }
                });
                test('Check for new/unrecognized options without values', () => {
                    const options = argumentsService.getKnownOptions();
                    const optionsNotFound = expectedWithoutArgs.filter(item => options.withoutArgs.indexOf(item) === -1);

                    if (optionsNotFound.length > 0) {
                        fail('', optionsNotFound.join(', '), 'Options not found');
                    }
                });
                test('Test getting value for an option with a single value', () => {
                    for (const option of expectedWithArgs) {
                        const args = ['--some-option-with-a-value', '1234', '--another-value-with-inline=1234', option, 'abcd'];
                        const value = argumentsService.getOptionValue(args, option);
                        expect(value).to.equal('abcd');
                    }
                });
                test('Test getting value for an option with a multiple value', () => {
                    for (const option of expectedWithArgs) {
                        const args = ['--some-option-with-a-value', '1234', '--another-value-with-inline=1234', option, 'abcd', option, 'xyz'];
                        const value = argumentsService.getOptionValue(args, option);
                        expect(value).to.deep.equal(['abcd', 'xyz']);
                    }
                });
                test('Test getting the test folder in unittest with -s', function () {
                    if (product !== Product.unittest) {
                        return this.skip();
                    }
                    const dir = path.join('a', 'b', 'c');
                    const args = ['anzy', '--one', '--three', '-s', dir];
                    const testDirs = argumentsService.getTestFolders(args);
                    expect(testDirs).to.be.lengthOf(1);
                    expect(testDirs[0]).to.equal(dir);
                });
                test('Test getting the test folder in unittest with -s in the middle', function () {
                    if (product !== Product.unittest) {
                        return this.skip();
                    }
                    const dir = path.join('a', 'b', 'c');
                    const args = ['anzy', '--one', '--three', '-s', dir, 'some other', '--value', '1234'];
                    const testDirs = argumentsService.getTestFolders(args);
                    expect(testDirs).to.be.lengthOf(1);
                    expect(testDirs[0]).to.equal(dir);
                });
                test('Test getting the test folder in unittest with --start-directory', function () {
                    if (product !== Product.unittest) {
                        return this.skip();
                    }
                    const dir = path.join('a', 'b', 'c');
                    const args = ['anzy', '--one', '--three', '--start-directory', dir];
                    const testDirs = argumentsService.getTestFolders(args);
                    expect(testDirs).to.be.lengthOf(1);
                    expect(testDirs[0]).to.equal(dir);
                });
                test('Test getting the test folder in unittest with --start-directory in the middle', function () {
                    if (product !== Product.unittest) {
                        return this.skip();
                    }
                    const dir = path.join('a', 'b', 'c');
                    const args = ['anzy', '--one', '--three', '--start-directory', dir, 'some other', '--value', '1234'];
                    const testDirs = argumentsService.getTestFolders(args);
                    expect(testDirs).to.be.lengthOf(1);
                    expect(testDirs[0]).to.equal(dir);
                });
                test('Test getting the test folder in nosetest', function () {
                    if (product !== Product.nosetest) {
                        return this.skip();
                    }
                    const dir = path.join('a', 'b', 'c');
                    const args = ['anzy', '--one', '--three', dir];
                    const testDirs = argumentsService.getTestFolders(args);
                    expect(testDirs).to.be.lengthOf(1);
                    expect(testDirs[0]).to.equal(dir);
                });
                test('Test getting the test folder in nosetest (with multiple dirs)', function () {
                    if (product !== Product.nosetest) {
                        return this.skip();
                    }
                    const dir = path.join('a', 'b', 'c');
                    const dir2 = path.join('a', 'b', '2');
                    const args = ['anzy', '--one', '--three', dir, dir2];
                    const testDirs = argumentsService.getTestFolders(args);
                    expect(testDirs).to.be.lengthOf(2);
                    expect(testDirs[0]).to.equal(dir);
                    expect(testDirs[1]).to.equal(dir2);
                });
                test('Test getting the test folder in pytest', function () {
                    if (product !== Product.pytest) {
                        return this.skip();
                    }
                    const dir = path.join('a', 'b', 'c');
                    const args = ['anzy', '--one', '--rootdir', dir];
                    const testDirs = argumentsService.getTestFolders(args);
                    expect(testDirs).to.be.lengthOf(1);
                    expect(testDirs[0]).to.equal(dir);
                });
                test('Test getting the test folder in pytest (with multiple dirs)', function () {
                    if (product !== Product.pytest) {
                        return this.skip();
                    }
                    const dir = path.join('a', 'b', 'c');
                    const dir2 = path.join('a', 'b', '2');
                    const args = ['anzy', '--one', '--rootdir', dir, '--rootdir', dir2];
                    const testDirs = argumentsService.getTestFolders(args);
                    expect(testDirs).to.be.lengthOf(2);
                    expect(testDirs[0]).to.equal(dir);
                    expect(testDirs[1]).to.equal(dir2);
                });
                test('Test getting the test folder in pytest (with multiple dirs in the middle)', function () {
                    if (product !== Product.pytest) {
                        return this.skip();
                    }
                    const dir = path.join('a', 'b', 'c');
                    const dir2 = path.join('a', 'b', '2');
                    const args = ['anzy', '--one', '--rootdir', dir, '--rootdir', dir2, '-xyz'];
                    const testDirs = argumentsService.getTestFolders(args);
                    expect(testDirs).to.be.lengthOf(2);
                    expect(testDirs[0]).to.equal(dir);
                    expect(testDirs[1]).to.equal(dir2);
                });
                test('Test getting the test folder in pytest (with single positional dir)', function () {
                    if (product !== Product.pytest) {
                        return this.skip();
                    }
                    const dir = path.join('a', 'b', 'c');
                    const args = ['anzy', '--one', dir];
                    const testDirs = argumentsService.getTestFolders(args);
                    expect(testDirs).to.be.lengthOf(1);
                    expect(testDirs[0]).to.equal(dir);
                });
                test('Test getting the test folder in pytest (with multiple positional dirs)', function () {
                    if (product !== Product.pytest) {
                        return this.skip();
                    }
                    const dir = path.join('a', 'b', 'c');
                    const dir2 = path.join('a', 'b', '2');
                    const args = ['anzy', '--one', dir, dir2];
                    const testDirs = argumentsService.getTestFolders(args);
                    expect(testDirs).to.be.lengthOf(2);
                    expect(testDirs[0]).to.equal(dir);
                    expect(testDirs[1]).to.equal(dir2);
                });
                test('Test getting the test folder in pytest (with multiple dirs excluding python files)', function () {
                    if (product !== Product.pytest) {
                        return this.skip();
                    }
                    const dir = path.join('a', 'b', 'c');
                    const dir2 = path.join('a', 'b', '2');
                    const args = ['anzy', '--one', dir, dir2, path.join(dir, 'one.py')];
                    const testDirs = argumentsService.getTestFolders(args);
                    expect(testDirs).to.be.lengthOf(2);
                    expect(testDirs[0]).to.equal(dir);
                    expect(testDirs[1]).to.equal(dir2);
                });
                test('Test filtering of arguments', () => {
                    const args: string[] = [];
                    const knownOptions = argumentsService.getKnownOptions();
                    const argumentsToRemove: string[] = [];
                    const expectedFilteredArgs: string[] = [];
                    // Generate some random arguments.
                    for (let i = 0; i < 5; i += 1) {
                        args.push(knownOptions.withArgs[i], `Random Value ${i}`);
                        args.push(knownOptions.withoutArgs[i]);

                        if (i % 2 === 0) {
                            argumentsToRemove.push(knownOptions.withArgs[i], knownOptions.withoutArgs[i]);
                        } else {
                            expectedFilteredArgs.push(knownOptions.withArgs[i], `Random Value ${i}`);
                            expectedFilteredArgs.push(knownOptions.withoutArgs[i]);
                        }
                    }

                    const filteredArgs = argumentsService.filterArguments(args, argumentsToRemove);
                    expect(filteredArgs).to.be.deep.equal(expectedFilteredArgs);
                });
            });
        });
});

function getOptions(product: Product, moduleName: string, withValues: boolean) {
    // const result = spawnSync('/Users/donjayamanne/Desktop/Development/PythonStuff/vscodePythonTesting/testingFolder/venv/bin/python', ['-m', moduleName, '-h']);
    const result = spawnSync(PYTHON_PATH, ['-m', moduleName, '-h']);
    const output = result.stdout.toString();

    // Our regex isn't the best, so lets exclude stuff that shouldn't be captured.
    const knownOptionsWithoutArgs: string[] = [];
    const knownOptionsWithArgs: string[] = [];
    if (product === Product.pytest) {
        knownOptionsWithArgs.push(...['-c', '-p', '-r']);
    }

    if (withValues) {
        return getOptionsWithArguments(output)
            .concat(...knownOptionsWithArgs)
            .filter(item => knownOptionsWithoutArgs.indexOf(item) === -1)
            .sort();
    } else {
        return getOptionsWithoutArguments(output)
            .concat(...knownOptionsWithoutArgs)
            .filter(item => knownOptionsWithArgs.indexOf(item) === -1)
            // In pytest, any option begining with --log- is known to have args.
            .filter(item => product === Product.pytest ? !item.startsWith('--log-') : true)
            .sort();
    }
}

function getOptionsWithoutArguments(output: string) {
    return getMatches('\\s{1,}(-{1,2}[A-Za-z0-9-]+)(?:,|\\s{2,})', output);
}
function getOptionsWithArguments(output: string) {
    return getMatches('\\s{1,}(-{1,2}[A-Za-z0-9-]+)(?:=|\\s{0,1}[A-Z])', output);
}

function getMatches(pattern, str) {
    const matches: string[] = [];
    const regex = new RegExp(pattern, 'gm');
    let result;
    while ((result = regex.exec(str)) !== null) {
        if (result.index === regex.lastIndex) {
            regex.lastIndex++;
        }
        matches.push(result[1].trim());
    }
    return matches
        .sort()
        .reduce<string[]>((items, item) => items.indexOf(item) === -1 ? items.concat([item]) : items, []);
}
