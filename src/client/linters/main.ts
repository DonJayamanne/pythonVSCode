import { OutputChannel } from 'vscode';
import { workspace } from 'vscode';

import { Product } from '../common/installer';
import { BaseLinter } from './baseLinter';
import * as prospector from './../linters/prospector';
import * as pylint from './../linters/pylint';
import * as pep8 from './../linters/pep8Linter';
import * as pylama from './../linters/pylama';
import * as flake8 from './../linters/flake8';
import * as pydocstyle from './../linters/pydocstyle';
import * as mypy from './../linters/mypy';

export class LinterFactor {
    public static createLinter(product: Product, outputChannel: OutputChannel, workspaceRootPath: string = workspace.rootPath): BaseLinter {
        switch (product) {
            case Product.flake8: {
                return new flake8.Linter(outputChannel, workspaceRootPath);
            }
            case Product.mypy: {
                return new mypy.Linter(outputChannel, workspaceRootPath);
            }
            case Product.pep8: {
                return new pep8.Linter(outputChannel, workspaceRootPath);
            }
            case Product.prospector: {
                return new prospector.Linter(outputChannel, workspaceRootPath);
            }
            case Product.pydocstyle: {
                return new pydocstyle.Linter(outputChannel, workspaceRootPath);
            }
            case Product.pylama: {
                return new pylama.Linter(outputChannel, workspaceRootPath);
            }
            case Product.pylint: {
                return new pylint.Linter(outputChannel, workspaceRootPath);
            }
            default: {
                throw new Error(`Invalid Linter '${Product[product]}''`);
            }
        }
    }
}