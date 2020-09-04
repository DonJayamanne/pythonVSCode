// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Product } from '../types';

// tslint:disable-next-line:variable-name
export const ProductNames = new Map<Product, string>();
ProductNames.set(Product.jupyter, 'jupyter');
ProductNames.set(Product.notebook, 'notebook');
ProductNames.set(Product.ipykernel, 'ipykernel');
ProductNames.set(Product.nbconvert, 'nbconvert');
ProductNames.set(Product.kernelspec, 'kernelspec');
ProductNames.set(Product.pandas, 'pandas');
