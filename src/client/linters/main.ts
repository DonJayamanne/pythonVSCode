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
    public static createLinter(product: Product, outputChannel: OutputChannel): BaseLinter {
        switch (product) {
            case Product.flake8: {
                return new flake8.Linter(outputChannel);
            }
            case Product.mypy: {
                return new mypy.Linter(outputChannel);
            }
            case Product.pep8: {
                return new pep8.Linter(outputChannel);
            }
            case Product.prospector: {
                return new prospector.Linter(outputChannel);
            }
            case Product.pydocstyle: {
                return new pydocstyle.Linter(outputChannel);
            }
            case Product.pylama: {
                return new pylama.Linter(outputChannel);
            }
            case Product.pylint: {
                return new pylint.Linter(outputChannel);
            }
            default: {
                throw new Error(`Invalid Linter '${Product[product]}''`);
            }
        }
    }
}
