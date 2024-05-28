// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

use log::warn;
use regex::Regex;

use crate::known::Environment;
use crate::locator::{Locator, LocatorResult};
use crate::messaging::PythonEnvironment;
use crate::utils::{
    self, find_all_python_binaries_in_path, get_shortest_python_executable,
    get_version_from_header_files, is_symlinked_python_executable, PythonEnv,
};
use std::cell::RefCell;
use std::collections::HashMap;
use std::path::{Path, PathBuf};

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

                if let Some(env_path) = symlink.ancestors().nth(2) {
                    env.env_path = Some(env_path.to_path_buf());
                }
            }
        }
        Some(env)
    }

    fn find(&mut self) -> Option<LocatorResult> {
        // Exclude files from this folder, as they would have been discovered elsewhere (widows_store)
        // Also the exe is merely a pointer to another file.
        let home = self.environment.get_user_home()?;
        let apps_path = Path::new(&home)
            .join("AppData")
            .join("Local")
            .join("Microsoft")
            .join("WindowsApps");
        let mut python_executables = self
            .environment
            .get_know_global_search_locations()
            .into_iter()
            .filter(|p| !p.starts_with(apps_path.clone()))
            // Paths like /Library/Frameworks/Python.framework/Versions/3.10/bin can end up in the current PATH variable.
            // Hence do not just look for files in a bin directory of the path.
            .map(|p| find_all_python_binaries_in_path(&p))
            .flatten()
            .collect::<Vec<PathBuf>>();

        // The python executables can contain files like
        // /usr/local/bin/python3.10
        // /usr/local/bin/python3
        // Possible both of the above are symlinks and point to the same file.
        // Hence sort on length of the path.
        // So that we process generic python3 before python3.10
        python_executables.sort_by(|a, b| {
            a.to_str()
                .unwrap_or_default()
                .len()
                .cmp(&b.to_str().unwrap_or_default().len())
        });
        let mut already_found: HashMap<PathBuf, RefCell<PythonEnvironment>> = HashMap::new();
        python_executables.into_iter().for_each(|full_path| {
            let version = utils::get_version_using_pyvenv_cfg(&full_path);
            let possible_symlink = match utils::get_version_using_pyvenv_cfg(&full_path) {
                Some(_) => {
                    // We got a version from pyvenv.cfg file, that means we're looking at a virtual env.
                    // This should not happen.
                    warn!(
                        "Found a virtual env but identified as global Python: {:?}",
                        full_path
                    );
                    // Its already fully resolved as we managed to get the env version from a pyvenv.cfg in current dir.
                    full_path.clone()
                }
                None => {
                    is_symlinked_python_executable(&full_path.clone()).unwrap_or(full_path.clone())
                }
            };
            let is_a_symlink = &possible_symlink != &full_path;
            if already_found.contains_key(&possible_symlink) {
                // If we have a symlinked file then, ensure the original path is added as symlink.
                // Possible we only added /usr/local/bin/python3.10 and not /usr/local/bin/python3
                // This entry is /usr/local/bin/python3
                if is_a_symlink {
                    if let Some(existing) = already_found.get_mut(&full_path) {
                        let mut existing = existing.borrow_mut();
                        if let Some(ref mut symlinks) = existing.symlinks {
                            symlinks.push(full_path.clone());
                        } else {
                            existing.symlinks =
                                Some(vec![possible_symlink.clone(), full_path.clone()]);
                        }

                        existing.python_executable_path = get_shortest_python_executable(
                            &existing.symlinks,
                            &existing.python_executable_path,
                        );
                    }
                }
                return;
            }

            if let Some(env) = self.resolve(&PythonEnv::new(full_path.clone(), None, version)) {
                let mut env = env.clone();
                let mut symlinks: Option<Vec<PathBuf>> = None;
                if is_a_symlink {
                    symlinks = Some(vec![possible_symlink.clone(), full_path.clone()]);
                }
                env.python_executable_path =
                    get_shortest_python_executable(&symlinks, &env.python_executable_path);
                env.symlinks = symlinks.clone();
                let env = RefCell::new(env);
                already_found.insert(full_path, env.clone());
                if let Some(symlinks) = symlinks.clone() {
                    for symlink in symlinks {
                        already_found.insert(symlink.clone(), env.clone());
                    }
                }
            }
        });

        if already_found.is_empty() {
            None
        } else {
            Some(LocatorResult {
                environments: already_found.values().map(|v| v.borrow().clone()).collect(),
                managers: vec![],
            })
        }
    }
}
