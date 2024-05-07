// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
use std::{env, path::PathBuf};

pub trait Environment {
    fn get_user_home(&self) -> Option<String>;
    fn get_env_var(&self, key: String) -> Option<String>;
    fn get_know_global_search_locations(&self) -> Vec<PathBuf>;
}

pub struct EnvironmentApi {}

#[cfg(windows)]
impl Environment for EnvironmentApi {
    fn get_user_home(&self) -> Option<String> {
        get_user_home()
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
    fn get_user_home(&self) -> Option<String> {
        get_user_home()
    }
    fn get_env_var(&self, key: String) -> Option<String> {
        get_env_var(key)
    }
    fn get_know_global_search_locations(&self) -> Vec<PathBuf> {
        vec![
            PathBuf::from("/usr/bin"),
            PathBuf::from("/usr/local/bin"),
            PathBuf::from("/bin"),
            PathBuf::from("/home/bin"),
            PathBuf::from("/sbin"),
            PathBuf::from("/usr/sbin"),
            PathBuf::from("/usr/local/sbin"),
            PathBuf::from("/home/sbin"),
            PathBuf::from("/opt"),
            PathBuf::from("/opt/bin"),
            PathBuf::from("/opt/sbin"),
            PathBuf::from("/opt/homebrew/bin"),
        ]
    }
}

fn get_user_home() -> Option<String> {
    let home = env::var("HOME").or_else(|_| env::var("USERPROFILE"));
    match home {
        Ok(home) => Some(home),
        Err(_) => None,
    }
}

fn get_env_var(key: String) -> Option<String> {
    match env::var(key) {
        Ok(path) => Some(path),
        Err(_) => None,
    }
}
