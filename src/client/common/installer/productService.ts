// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { injectable } from 'inversify';
import { Product, ProductType } from '../types';
import { IProductService } from './types';

@injectable()
export class ProductService implements IProductService {
    private ProductTypes = new Map<Product, ProductType>();

    constructor() {
        this.ProductTypes.set(Product.jupyter, ProductType.DataScience);
        this.ProductTypes.set(Product.notebook, ProductType.DataScience);
        this.ProductTypes.set(Product.ipykernel, ProductType.DataScience);
        this.ProductTypes.set(Product.nbconvert, ProductType.DataScience);
        this.ProductTypes.set(Product.kernelspec, ProductType.DataScience);
        this.ProductTypes.set(Product.pandas, ProductType.DataScience);
        this.ProductTypes.set(Product.tensorboard, ProductType.DataScience);
        this.ProductTypes.set(Product.torchProfilerInstallName, ProductType.DataScience);
        this.ProductTypes.set(Product.torchProfilerImportName, ProductType.DataScience);
        this.ProductTypes.set(Product.pip, ProductType.DataScience);
        this.ProductTypes.set(Product.ensurepip, ProductType.DataScience);
    }
    public getProductType(product: Product): ProductType {
        return this.ProductTypes.get(product)!;
    }
}
