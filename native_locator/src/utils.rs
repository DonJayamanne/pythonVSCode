// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

use crate::messaging::{EnvManager, PythonEnvironment};
use regex::Regex;
use std::{
    fs,
    path::{Path, PathBuf},
};

#[derive(Debug)]
pub struct PythonEnv {
    pub executable: PathBuf,
    pub path: Option<PathBuf>,
    pub version: Option<String>,
}

impl PythonEnv {
    pub fn new(executable: PathBuf, path: Option<PathBuf>, version: Option<String>) -> Self {
        Self {
            executable,
            path,
            version,
        }
    }
}

#[derive(Debug)]
pub struct PyEnvCfg {
    pub version: String,
}

const PYVENV_CONFIG_FILE: &str = "pyvenv.cfg";

pub fn find_pyvenv_config_path(python_executable: &PathBuf) -> Option<PathBuf> {
    // Check if the pyvenv.cfg file is in the parent directory relative to the interpreter.
    // env
    // |__ pyvenv.cfg  <--- check if this file exists
    // |__ bin or Scripts
    //     |__ python  <--- interpreterPath
    let cfg = python_executable.parent()?.join(PYVENV_CONFIG_FILE);
    if fs::metadata(&cfg).is_ok() {
        return Some(cfg);
    }

    // Check if the pyvenv.cfg file is in the directory as the interpreter.
    // env
    // |__ pyvenv.cfg  <--- check if this file exists
    // |__ python  <--- interpreterPath
    let cfg = python_executable
        .parent()?
        .parent()?
        .join(PYVENV_CONFIG_FILE);
    if fs::metadata(&cfg).is_ok() {
        return Some(cfg);
    }

    None
}

pub fn find_and_parse_pyvenv_cfg(python_executable: &PathBuf) -> Option<PyEnvCfg> {
    let cfg = find_pyvenv_config_path(&PathBuf::from(python_executable))?;
    if !fs::metadata(&cfg).is_ok() {
        return None;
    }

    let contents = fs::read_to_string(&cfg).ok()?;
    let version_regex = Regex::new(r"^version\s*=\s*(\d+\.\d+\.\d+)$").unwrap();
    let version_info_regex = Regex::new(r"^version_info\s*=\s*(\d+\.\d+\.\d+.*)$").unwrap();
    for line in contents.lines() {
        if !line.contains("version") {
            continue;
        }
        if let Some(captures) = version_regex.captures(line) {
            if let Some(value) = captures.get(1) {
                return Some(PyEnvCfg {
                    version: value.as_str().to_string(),
                });
            }
        }
        if let Some(captures) = version_info_regex.captures(line) {
            if let Some(value) = captures.get(1) {
                return Some(PyEnvCfg {
                    version: value.as_str().to_string(),
                });
            }
        }
    }
    None
}

pub fn get_version_using_pyvenv_cfg(python_executable: &PathBuf) -> Option<String> {
    if let Some(parent_folder) = python_executable.parent() {
        if let Some(pyenv_cfg) = find_and_parse_pyvenv_cfg(&parent_folder.to_path_buf()) {
            return Some(pyenv_cfg.version);
        }
    }
    None
}

#[cfg(windows)]
pub fn find_python_binary_path(env_path: &Path) -> Option<PathBuf> {
    for path in vec![
        env_path.join("Scripts").join("python.exe"),
        env_path.join("Scripts").join("python3.exe"),
        env_path.join("python.exe"),
        env_path.join("python3.exe"),
    ] {
        if path.exists() {
            return Some(path);
        }
    }
    None
}

#[cfg(unix)]
pub fn find_python_binary_path(env_path: &Path) -> Option<PathBuf> {
    for path in vec![
        env_path.join("bin").join("python"),
        env_path.join("bin").join("python3"),
        env_path.join("python"),
        env_path.join("python3"),
    ] {
        if path.exists() {
            return Some(path);
        }
    }
    None
}

fn is_python_exe_name(exe: &PathBuf) -> bool {
    let name = exe
        .file_name()
        .unwrap_or_default()
        .to_str()
        .unwrap_or_default()
        .to_lowercase();
    if !name.starts_with("python") {
        return false;
    }
    // Regex to match pythonX.X.exe
    #[cfg(windows)]
    let version_regex = Regex::new(r"python(\d+\.?)*.exe").unwrap();
    #[cfg(unix)]
    let version_regex = Regex::new(r"python(\d+\.?)*$").unwrap();
    version_regex.is_match(&name)
}

pub fn find_all_python_binaries_in_path(env_path: &Path) -> Vec<PathBuf> {
    let mut python_executables = vec![];
    #[cfg(windows)]
    let bin = "Scripts";
    #[cfg(unix)]
    let bin = "bin";
    let mut env_path = env_path.to_path_buf();
    if env_path.join(bin).metadata().is_ok() {
        env_path = env_path.join(bin);
    }
    // Enumerate this directory and get all `python` & `pythonX.X` files.
    if let Ok(entries) = fs::read_dir(env_path) {
        for entry in entries.filter_map(Result::ok) {
            let file = entry.path();
            if is_python_exe_name(&file) && file.is_file() {
                python_executables.push(file);
            }
        }
    }
    python_executables
}

pub fn get_environment_key(env: &PythonEnvironment) -> Option<String> {
    if let Some(ref path) = env.python_executable_path {
        return Some(path.to_string_lossy().to_string());
    }
    if let Some(ref path) = env.env_path {
        return Some(path.to_string_lossy().to_string());
    }

    None
}

pub fn get_environment_manager_key(env: &EnvManager) -> String {
    return env.executable_path.to_string_lossy().to_string();
}

pub fn is_symlinked_python_executable(path: &PathBuf) -> Option<PathBuf> {
    let name = path.file_name()?.to_string_lossy();
    if !name.starts_with("python") || name.ends_with("-config") || name.ends_with("-build") {
        return None;
    }
    let metadata = std::fs::symlink_metadata(&path).ok()?;
    if metadata.is_file() || !metadata.file_type().is_symlink() {
        return None;
    }
    Some(std::fs::canonicalize(path).ok()?)
}

// Get the python version from the `Headers/patchlevel.h` file
// The lines we are looking for are:
// /* Version as a string */
// #define PY_VERSION              "3.10.2"
// /*--end constants--*/
pub fn get_version_from_header_files(path: &Path) -> Option<String> {
    let version_regex = Regex::new(r#"#define\s+PY_VERSION\s+"((\d+\.?)*)"#).unwrap();
    let patchlevel_h = path.join("Headers").join("patchlevel.h");
    let contents = fs::read_to_string(&patchlevel_h).ok()?;
    for line in contents.lines() {
        if let Some(captures) = version_regex.captures(line) {
            if let Some(value) = captures.get(1) {
                return Some(value.as_str().to_string());
            }
        }
    }
    None
}

pub fn get_shortest_python_executable(
    symlinks: &Option<Vec<PathBuf>>,
    exe: &Option<PathBuf>,
) -> Option<PathBuf> {
    // Ensure the executable always points to the shorted path.
    if let Some(mut symlinks) = symlinks.clone() {
        if let Some(exe) = exe {
            symlinks.push(exe.clone());
        }
        symlinks.sort_by(|a, b| {
            a.to_str()
                .unwrap_or_default()
                .len()
                .cmp(&b.to_str().unwrap_or_default().len())
        });
        Some(symlinks[0].clone())
    } else {
        exe.clone()
    }
}
