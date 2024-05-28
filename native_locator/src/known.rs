// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
use std::{env, path::PathBuf};

pub trait Environment {
    fn get_user_home(&self) -> Option<PathBuf>;
    /**
     * Only used in tests, this is the root `/`.
     */
    #[allow(dead_code)]
    fn get_root(&self) -> Option<PathBuf>;
    fn get_env_var(&self, key: String) -> Option<String>;
    fn get_know_global_search_locations(&self) -> Vec<PathBuf>;
}

pub struct EnvironmentApi {}
impl EnvironmentApi {
    pub fn new() -> Self {
        EnvironmentApi {}
    }
}

#[cfg(windows)]
impl Environment for EnvironmentApi {
    fn get_user_home(&self) -> Option<PathBuf> {
        get_user_home()
    }
    fn get_root(&self) -> Option<PathBuf> {
        None
    }
    fn get_env_var(&self, key: String) -> Option<String> {
        get_env_var(key)
    }
    fn get_know_global_search_locations(&self) -> Vec<PathBuf> {
        vec![]
    }
}

#[cfg(unix)]
impl Environment for EnvironmentApi {
    fn get_user_home(&self) -> Option<PathBuf> {
        get_user_home()
    }
    fn get_root(&self) -> Option<PathBuf> {
        None
    }
    fn get_env_var(&self, key: String) -> Option<String> {
        get_env_var(key)
    }
    fn get_know_global_search_locations(&self) -> Vec<PathBuf> {
        let mut paths = env::split_paths(&self.get_env_var("PATH".to_string()).unwrap_or_default())
            .collect::<Vec<PathBuf>>();

        vec![
            PathBuf::from("/bin"),
            PathBuf::from("/etc"),
            PathBuf::from("/lib"),
            PathBuf::from("/lib/x86_64-linux-gnu"),
            PathBuf::from("/lib64"),
            PathBuf::from("/sbin"),
            PathBuf::from("/snap/bin"),
            PathBuf::from("/usr/bin"),
            PathBuf::from("/usr/games"),
            PathBuf::from("/usr/include"),
            PathBuf::from("/usr/lib"),
            PathBuf::from("/usr/lib/x86_64-linux-gnu"),
            PathBuf::from("/usr/lib64"),
            PathBuf::from("/usr/libexec"),
            PathBuf::from("/usr/local"),
            PathBuf::from("/usr/local/bin"),
            PathBuf::from("/usr/local/etc"),
            PathBuf::from("/usr/local/games"),
            PathBuf::from("/usr/local/lib"),
            PathBuf::from("/usr/local/sbin"),
            PathBuf::from("/usr/sbin"),
            PathBuf::from("/usr/share"),
            PathBuf::from("~/.local/bin"),
            PathBuf::from("/home/bin"),
            PathBuf::from("/home/sbin"),
            PathBuf::from("/opt"),
            PathBuf::from("/opt/bin"),
            PathBuf::from("/opt/sbin"),
        ]
        .iter()
        .for_each(|p| {
            if !paths.contains(p) {
                paths.push(p.clone());
            }
        });

        paths
    }
}

fn get_user_home() -> Option<PathBuf> {
    let home = env::var("HOME").or_else(|_| env::var("USERPROFILE"));
    match home {
        Ok(home) => Some(PathBuf::from(home)),
        Err(_) => None,
    }
}

fn get_env_var(key: String) -> Option<String> {
    match env::var(key) {
        Ok(path) => Some(path),
        Err(_) => None,
    }
}
