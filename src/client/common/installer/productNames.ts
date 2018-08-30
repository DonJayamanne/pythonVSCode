// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Product } from '../types';

// tslint:disable-next-line:variable-name
export const ProductNames = new Map<Product, string>();
ProductNames.set(Product.autopep8, 'autopep8');
ProductNames.set(Product.black, 'black');
ProductNames.set(Product.flake8, 'flake8');
ProductNames.set(Product.mypy, 'mypy');
ProductNames.set(Product.nosetest, 'nosetest');
ProductNames.set(Product.pep8, 'pep8');
ProductNames.set(Product.pylama, 'pylama');
ProductNames.set(Product.prospector, 'prospector');
ProductNames.set(Product.pydocstyle, 'pydocstyle');
ProductNames.set(Product.pylint, 'pylint');
ProductNames.set(Product.pytest, 'pytest');
ProductNames.set(Product.yapf, 'yapf');
ProductNames.set(Product.rope, 'rope');
