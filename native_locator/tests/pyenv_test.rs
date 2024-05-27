// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

mod common;

#[test]
#[cfg(unix)]
fn does_not_find_any_pyenv_envs() {
    use crate::common::create_test_environment;
    use python_finder::{conda::Conda, locator::Locator, pyenv};
    use std::{collections::HashMap, path::PathBuf};

    let known = create_test_environment(
        HashMap::new(),
        Some(PathBuf::from("SOME_BOGUS_HOME_DIR")),
        Vec::new(),
        None,
    );

    let mut conda = Conda::with(&known);
    let mut locator = pyenv::PyEnv::with(&known, &mut conda);
    let result = locator.find();

    assert_eq!(result.is_none(), true);
}

#[test]
#[cfg(unix)]
fn does_not_find_any_pyenv_envs_even_with_pyenv_installed() {
    use crate::common::{create_test_environment, join_test_paths, test_file_path};
    use python_finder::messaging::{EnvManager, EnvManagerType};
    use python_finder::pyenv;
    use python_finder::{conda::Conda, locator::Locator};
    use serde_json::json;
    use std::{collections::HashMap, path::PathBuf};

    let home = test_file_path(&["tests", "unix", "pyenv_without_envs", "user_home"]);
    let homebrew_bin = test_file_path(&[
        "tests",
        "unix",
        "pyenv_without_envs",
        "home",
        "opt",
        "homebrew",
        "bin",
    ]);
    let pyenv_exe = join_test_paths(&[homebrew_bin.to_str().unwrap(), "pyenv"]);
    let known = create_test_environment(
        HashMap::new(),
        Some(home.clone()),
        vec![PathBuf::from(homebrew_bin)],
        None,
    );

    let mut conda = Conda::with(&known);
    let mut locator = pyenv::PyEnv::with(&known, &mut conda);
    let result = locator.find().unwrap();

    let managers = result.clone().managers;
    assert_eq!(managers.len(), 1);

    let expected_manager = EnvManager {
        executable_path: pyenv_exe.clone(),
        version: None,
        tool: EnvManagerType::Pyenv,
        company: None,
        company_display_name: None,
    };
    assert_eq!(json!(expected_manager), json!(result.managers[0]));
}

#[test]
#[cfg(unix)]
fn find_pyenv_envs() {
    use crate::common::{
        assert_messages, create_test_environment, join_test_paths, test_file_path,
    };
    use python_finder::conda::{Conda, CondaLocator};
    use python_finder::locator::Locator;
    use python_finder::messaging::Architecture;
    use python_finder::{
        messaging::{EnvManager, EnvManagerType, PythonEnvironment},
        pyenv,
    };
    use serde_json::json;
    use std::{collections::HashMap, path::PathBuf};

    let home = test_file_path(&["tests", "unix", "pyenv", "user_home"]);
    let homebrew_bin =
        test_file_path(&["tests", "unix", "pyenv", "home", "opt", "homebrew", "bin"]);
    let pyenv_exe = join_test_paths(&[homebrew_bin.to_str().unwrap(), "pyenv"]);
    let known = create_test_environment(
        HashMap::new(),
        Some(home.clone()),
        vec![PathBuf::from(homebrew_bin)],
        None,
    );
    let conda_dir = test_file_path(&[
        "tests",
        "unix",
        "pyenv",
        "user_home",
        ".pyenv",
        "versions",
        "anaconda-4.0.0",
    ]);
    let conda_exe = conda_dir.join("bin").join("conda");

    let mut conda = Conda::with(&known);
    let mut locator = pyenv::PyEnv::with(&known, &mut conda);
    let result = locator.find().unwrap();

    assert_eq!(result.managers.len(), 2);

    let expected_pyenv_manager = EnvManager {
        executable_path: pyenv_exe.clone(),
        version: None,
        tool: EnvManagerType::Pyenv,
        company: None,
        company_display_name: None,
    };
    let expected_conda_manager = EnvManager {
        executable_path: conda_exe.clone(),
        version: Some("23.11.0".to_string()),
        tool: EnvManagerType::Conda,
        company: None,
        company_display_name: None,
    };
    assert_eq!(json!(expected_pyenv_manager), json!(result.managers[0]));

    let expected_3_9_9 = json!(PythonEnvironment {
        display_name: None,
        project_path: None,
        name: None,
        python_executable_path: Some(join_test_paths(&[
            home.to_str().unwrap(),
            ".pyenv/versions/3.9.9/bin/python"
        ])),
        python_run_command: Some(vec![join_test_paths(&[
            home.to_str().unwrap(),
            ".pyenv/versions/3.9.9/bin/python"
        ])
        .to_str()
        .unwrap()
        .to_string()]),
        category: python_finder::messaging::PythonEnvironmentCategory::Pyenv,
        version: Some("3.9.9".to_string()),
        env_path: Some(join_test_paths(&[
            home.to_str().unwrap(),
            ".pyenv/versions/3.9.9"
        ])),
        env_manager: Some(expected_pyenv_manager.clone()),
        arch: None,
        ..Default::default()
    });
    let expected_virtual_env = PythonEnvironment {
        display_name: None,
        project_path: None,
        name: Some("my-virtual-env".to_string()),
        python_executable_path: Some(join_test_paths(&[
            home.to_str().unwrap(),
            ".pyenv/versions/my-virtual-env/bin/python",
        ])),
        python_run_command: Some(vec![join_test_paths(&[
            home.to_str().unwrap(),
            ".pyenv/versions/my-virtual-env/bin/python",
        ])
        .to_str()
        .unwrap()
        .to_string()]),
        category: python_finder::messaging::PythonEnvironmentCategory::PyenvVirtualEnv,
        version: Some("3.10.13".to_string()),
        env_path: Some(join_test_paths(&[
            home.to_str().unwrap(),
            ".pyenv/versions/my-virtual-env",
        ])),
        env_manager: Some(expected_pyenv_manager.clone()),
        arch: None,
        ..Default::default()
    };
    let expected_3_12_1 = PythonEnvironment {
        display_name: None,
        project_path: None,
        name: None,
        python_executable_path: Some(join_test_paths(&[
            home.to_str().unwrap(),
            ".pyenv/versions/3.12.1/bin/python",
        ])),
        python_run_command: Some(vec![join_test_paths(&[
            home.to_str().unwrap(),
            ".pyenv/versions/3.12.1/bin/python",
        ])
        .to_str()
        .unwrap()
        .to_string()]),
        category: python_finder::messaging::PythonEnvironmentCategory::Pyenv,
        version: Some("3.12.1".to_string()),
        env_path: Some(join_test_paths(&[
            home.to_str().unwrap(),
            ".pyenv/versions/3.12.1",
        ])),
        env_manager: Some(expected_pyenv_manager.clone()),
        arch: None,
        ..Default::default()
    };
    let expected_3_13_dev = PythonEnvironment {
        display_name: None,
        project_path: None,
        name: None,
        python_executable_path: Some(join_test_paths(&[
            home.to_str().unwrap(),
            ".pyenv/versions/3.13-dev/bin/python",
        ])),
        python_run_command: Some(vec![join_test_paths(&[
            home.to_str().unwrap(),
            ".pyenv/versions/3.13-dev/bin/python",
        ])
        .to_str()
        .unwrap()
        .to_string()]),
        category: python_finder::messaging::PythonEnvironmentCategory::Pyenv,
        version: Some("3.13-dev".to_string()),
        env_path: Some(join_test_paths(&[
            home.to_str().unwrap(),
            ".pyenv/versions/3.13-dev",
        ])),
        env_manager: Some(expected_pyenv_manager.clone()),
        arch: None,
        ..Default::default()
    };
    let expected_3_12_1a3 = PythonEnvironment {
        display_name: None,
        project_path: None,
        name: None,
        python_executable_path: Some(join_test_paths(&[
            home.to_str().unwrap(),
            ".pyenv/versions/3.12.1a3/bin/python",
        ])),
        python_run_command: Some(vec![join_test_paths(&[
            home.to_str().unwrap(),
            ".pyenv/versions/3.12.1a3/bin/python",
        ])
        .to_str()
        .unwrap()
        .to_string()]),
        category: python_finder::messaging::PythonEnvironmentCategory::Pyenv,
        version: Some("3.12.1a3".to_string()),
        env_path: Some(join_test_paths(&[
            home.to_str().unwrap(),
            ".pyenv/versions/3.12.1a3",
        ])),
        env_manager: Some(expected_pyenv_manager.clone()),
        arch: None,
        ..Default::default()
    };

    let expected_conda_root = PythonEnvironment {
        display_name: None,
        project_path: None,
        name: None,
        python_executable_path: Some(conda_dir.join("bin").join("python")),
        python_run_command: Some(vec![
            conda_exe.clone().to_str().unwrap().to_string(),
            "run".to_string(),
            "-n".to_string(),
            "base".to_string(),
            "python".to_string(),
        ]),
        category: python_finder::messaging::PythonEnvironmentCategory::Conda,
        version: Some("3.11.5".to_string()),
        env_path: Some(conda_dir.clone()),
        env_manager: Some(expected_conda_manager.clone()),
        arch: Some(Architecture::X64),
        ..Default::default()
    };
    let expected_conda_one = PythonEnvironment {
        display_name: None,
        project_path: None,
        name: Some("one".to_string()),
        python_executable_path: Some(conda_dir.join("envs").join("one").join("python")),
        python_run_command: Some(vec![
            conda_exe.clone().to_str().unwrap().to_string(),
            "run".to_string(),
            "-n".to_string(),
            "one".to_string(),
            "python".to_string(),
        ]),
        category: python_finder::messaging::PythonEnvironmentCategory::Conda,
        version: Some("3.11.1".to_string()),
        env_path: Some(conda_dir.join("envs").join("one")),
        env_manager: Some(expected_conda_manager.clone()),
        arch: None,
        ..Default::default()
    };
    let expected_conda_two = PythonEnvironment {
        display_name: None,
        project_path: None,
        name: Some("two".to_string()),
        python_executable_path: Some(conda_dir.join("envs").join("two").join("python")),
        python_run_command: Some(vec![
            conda_exe.clone().to_str().unwrap().to_string(),
            "run".to_string(),
            "-n".to_string(),
            "two".to_string(),
            "python".to_string(),
        ]),
        category: python_finder::messaging::PythonEnvironmentCategory::Conda,
        version: None,
        env_path: Some(conda_dir.join("envs").join("two")),
        env_manager: Some(expected_conda_manager.clone()),
        arch: None,
        ..Default::default()
    };

    assert_messages(
        &[
            json!(expected_3_9_9),
            json!(expected_virtual_env),
            json!(expected_3_12_1),
            json!(expected_3_13_dev),
            json!(expected_3_12_1a3),
            json!(expected_conda_root),
            json!(expected_conda_one),
            json!(expected_conda_two),
        ],
        &result
            .environments
            .iter()
            .map(|e| json!(e))
            .collect::<Vec<_>>(),
    )
}

#[test]
#[cfg(unix)]
fn resolve_pyenv_environment() {
    use crate::common::{create_test_environment, join_test_paths, test_file_path};
    use python_finder::conda::Conda;
    use python_finder::locator::Locator;
    use python_finder::utils::PythonEnv;
    use python_finder::{
        messaging::{EnvManager, EnvManagerType, PythonEnvironment},
        pyenv,
    };
    use serde_json::json;
    use std::{collections::HashMap, path::PathBuf};

    let home = test_file_path(&["tests", "unix", "pyenv", "user_home"]);
    let homebrew_bin =
        test_file_path(&["tests", "unix", "pyenv", "home", "opt", "homebrew", "bin"]);
    let pyenv_exe = join_test_paths(&[homebrew_bin.to_str().unwrap(), "pyenv"]);
    let known = create_test_environment(
        HashMap::new(),
        Some(home.clone()),
        vec![PathBuf::from(homebrew_bin)],
        None,
    );

    let mut conda = Conda::with(&known);
    let mut locator = pyenv::PyEnv::with(&known, &mut conda);

    let expected_manager = EnvManager {
        executable_path: pyenv_exe.clone(),
        version: None,
        tool: EnvManagerType::Pyenv,
        company: None,
        company_display_name: None,
    };

    let expected_3_9_9 = json!(PythonEnvironment {
        display_name: None,
        project_path: None,
        name: None,
        python_executable_path: Some(join_test_paths(&[
            home.to_str().unwrap(),
            ".pyenv/versions/3.9.9/bin/python"
        ])),
        python_run_command: Some(vec![join_test_paths(&[
            home.to_str().unwrap(),
            ".pyenv/versions/3.9.9/bin/python"
        ])
        .to_str()
        .unwrap()
        .to_string()]),
        category: python_finder::messaging::PythonEnvironmentCategory::Pyenv,
        version: Some("3.9.9".to_string()),
        env_path: Some(join_test_paths(&[
            home.to_str().unwrap(),
            ".pyenv/versions/3.9.9"
        ])),
        env_manager: Some(expected_manager.clone()),
        arch: None,
        ..Default::default()
    });
    let expected_virtual_env = PythonEnvironment {
        display_name: None,
        project_path: None,
        name: Some("my-virtual-env".to_string()),
        python_executable_path: Some(join_test_paths(&[
            home.to_str().unwrap(),
            ".pyenv/versions/my-virtual-env/bin/python",
        ])),
        python_run_command: Some(vec![join_test_paths(&[
            home.to_str().unwrap(),
            ".pyenv/versions/my-virtual-env/bin/python",
        ])
        .to_str()
        .unwrap()
        .to_string()]),
        category: python_finder::messaging::PythonEnvironmentCategory::PyenvVirtualEnv,
        version: Some("3.10.13".to_string()),
        env_path: Some(join_test_paths(&[
            home.to_str().unwrap(),
            ".pyenv/versions/my-virtual-env",
        ])),
        env_manager: Some(expected_manager.clone()),
        arch: None,
        ..Default::default()
    };

    // Resolve regular Python installs in Pyenv
    let result = locator.resolve(&PythonEnv {
        executable: join_test_paths(&[home.to_str().unwrap(), ".pyenv/versions/3.9.9/bin/python"]),
        path: Some(join_test_paths(&[
            home.to_str().unwrap(),
            ".pyenv/versions/3.9.9",
        ])),
        version: None,
    });

    assert_eq!(json!(result.unwrap()), json!(expected_3_9_9));

    // Resolve regular virtual-envs in Pyenv
    let result = locator.resolve(&PythonEnv {
        executable: join_test_paths(&[
            home.to_str().unwrap(),
            ".pyenv/versions/my-virtual-env/bin/python",
        ]),
        path: Some(join_test_paths(&[
            home.to_str().unwrap(),
            ".pyenv/versions/my-virtual-env",
        ])),
        version: None,
    });

    assert_eq!(json!(result.unwrap()), json!(expected_virtual_env));

    // Should not resolve conda envs in pyenv
    let result = locator.resolve(&PythonEnv {
        executable: join_test_paths(&[
            home.to_str().unwrap(),
            ".pyenv/versions/anaconda-4.0.0/bin/python",
        ]),
        path: Some(join_test_paths(&[
            home.to_str().unwrap(),
            ".pyenv/versions/anaconda-4.0.0",
        ])),
        version: None,
    });

    assert_eq!(result.is_none(), true);
}
