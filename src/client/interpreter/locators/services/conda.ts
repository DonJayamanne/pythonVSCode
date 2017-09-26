import { IS_WINDOWS } from "../../../common/utils";

// where to find the Python binary within a conda env.
export const CONDA_RELATIVE_PY_PATH = IS_WINDOWS ? ['python.exe'] : ['bin', 'python'];
export const AnacondaCompanyNames = ['Anaconda, Inc.', 'Continuum Analytics, Inc.'];
export const AnacondaCompanyName = 'Anaconda, Inc.';
export const AnacondaDisplayName = 'Anaconda';
