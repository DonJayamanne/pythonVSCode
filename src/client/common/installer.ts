
export enum product {
    pytest,
    nosetest,
    pylint,
    flake8,
    pep8,
    prospector,
    pydocstyle,
    yapf,
    autopep8
}

interface installIScript {
    windows: string;
    mac: string;
    linux: string;
}

const productInstallScripts = new Map<product, installIScript>();

export function promptToInstall(prod:product){

}