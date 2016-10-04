
export class JmpModuleLoadError extends Error {
    constructor() {
        const errorMessage = `Version incompatibility in Jupyter (Python extension). View 'Help' for further details.`;
        super(errorMessage);
        this.message = errorMessage;
    }
}