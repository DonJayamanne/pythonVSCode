// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

use regex::Regex;

use crate::known::Environment;
use crate::locator::{Locator, LocatorResult};
use crate::messaging::PythonEnvironment;
use crate::utils::{
    self, find_python_binary_path, get_version_from_header_files, is_symlinked_python_executable,
    PythonEnv,
};
use std::env;
use std::path::{Path, PathBuf};

fn get_env_path(python_executable_path: &PathBuf) -> Option<PathBuf> {
    let parent = python_executable_path.parent()?;
    if parent.file_name()? == "Scripts" {
        return Some(parent.parent()?.to_path_buf());
    } else {
        return Some(parent.to_path_buf());
    }
}

pub struct PythonOnPath<'a> {
    pub environment: &'a dyn Environment,
}

impl PythonOnPath<'_> {
    pub fn with<'a>(environment: &'a impl Environment) -> PythonOnPath {
        PythonOnPath { environment }
    }
}

impl Locator for PythonOnPath<'_> {
    fn resolve(&self, env: &PythonEnv) -> Option<PythonEnvironment> {
        let exe = &env.executable;
        let mut env = PythonEnvironment {
            display_name: None,
            python_executable_path: Some(exe.clone()),
            version: env.version.clone(),
            category: crate::messaging::PythonEnvironmentCategory::System,
            env_path: env.path.clone(),
            python_run_command: Some(vec![exe.clone().to_str().unwrap().to_string()]),
            ..Default::default()
        };

        if let Some(symlink) = is_symlinked_python_executable(&exe) {
            env.symlinks = Some(vec![symlink.clone(), exe.clone()]);
            // Getting version this way is more accurate than the above regex.
            // Sample paths
            // /Library/Frameworks/Python.framework/Versions/3.10/bin/python3.10
            if symlink.starts_with("/Library/Frameworks/Python.framework/Versions") {
                let python_regex = Regex::new(r"/Versions/((\d+\.?)*)/bin").unwrap();
                if let Some(captures) = python_regex.captures(symlink.to_str().unwrap()) {
                    let version = captures.get(1).map_or("", |m| m.as_str());
                    if version.len() > 0 {
                        env.version = Some(version.to_string());
                    }
                }
                // Sample paths
                // /Library/Frameworks/Python.framework/Versions/3.10/bin/python3.10
                if let Some(parent) = symlink.ancestors().nth(2) {
                    if let Some(version) = get_version_from_header_files(parent) {
                        env.version = Some(version);
                    }
                }
            }
        }
        Some(env)
    }

    fn find(&mut self) -> Option<LocatorResult> {
        let paths = self.environment.get_env_var("PATH".to_string())?;

        // Exclude files from this folder, as they would have been discovered elsewhere (widows_store)
        // Also the exe is merely a pointer to another file.
        let home = self.environment.get_user_home()?;
        let apps_path = Path::new(&home)
            .join("AppData")
            .join("Local")
            .join("Microsoft")
            .join("WindowsApps");
        let mut environments: Vec<PythonEnvironment> = vec![];
        env::split_paths(&paths)
            .filter(|p| !p.starts_with(apps_path.clone()))
            // Paths like /Library/Frameworks/Python.framework/Versions/3.10/bin can end up in the current PATH variable.
            // Hence do not just look for files in a bin directory of the path.
            .map(|p| find_python_binary_path(&p))
            .filter(Option::is_some)
            .map(Option::unwrap)
            .for_each(|full_path| {
                let version = utils::get_version(&full_path);
                let env_path = get_env_path(&full_path);
                if let Some(env) = self.resolve(&PythonEnv::new(full_path, env_path, version)) {
                    environments.push(env);
                }
            });

        if environments.is_empty() {
            None
        } else {
            Some(LocatorResult {
                environments,
                managers: vec![],
            })
        }
    }
}
