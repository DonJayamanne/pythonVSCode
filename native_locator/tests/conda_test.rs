// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

mod common;

#[test]
#[cfg(unix)]
fn does_not_find_any_conda_envs() {
    use crate::common::create_test_environment;
    use python_finder::{conda, locator::Locator};
    use std::{collections::HashMap, path::PathBuf};

    let known = create_test_environment(
        HashMap::from([("PATH".to_string(), "".to_string())]),
        Some(PathBuf::from("SOME_BOGUS_HOME_DIR")),
        Vec::new(),
        None,
    );

    let mut locator = conda::Conda::with(&known);
    let result = locator.find();

    assert_eq!(result.is_none(), true);
}

#[test]
#[cfg(unix)]
fn no_paths_from_conda_rc_if_conda_rc_does_not_exist() {
    use crate::common::{create_test_environment, test_file_path};
    use python_finder::conda::get_conda_environment_paths_from_conda_rc;
    use std::collections::HashMap;

    let user_home = test_file_path(&["tests/unix/no_conda_rc/user_home"]);
    let root = test_file_path(&["tests/unix/no_conda_rc/root"]);

    let known = create_test_environment(
        HashMap::from([("PATH".to_string(), "".to_string())]),
        Some(user_home),
        Vec::new(),
        Some(root),
    );

    let result = get_conda_environment_paths_from_conda_rc(&known);

    assert_eq!(result.len(), 0);
}

#[test]
#[cfg(unix)]
fn paths_from_conda_rc() {
    use crate::common::{create_test_environment, test_file_path};
    use python_finder::conda::get_conda_environment_paths_from_conda_rc;
    use std::{collections::HashMap, fs, path::PathBuf};

    fn create_conda_rc(file: &PathBuf, paths: &Vec<PathBuf>) {
        use std::fs::File;
        use std::io::Write;
        let mut file = File::create(file).unwrap();

        writeln!(file, "envs_dirs:").unwrap();
        for path in paths {
            writeln!(file, " - {}", path.to_string_lossy()).unwrap();
        }
    }

    fn test_with(conda_rc_file: &PathBuf) {
        let home = test_file_path(&["tests/unix/conda_rc/user_home"]);
        let root = test_file_path(&["tests/unix/conda_rc/root"]);
        let conda_dir = home.join(".conda");
        let conda_envs = conda_dir.join("envs");

        let known = create_test_environment(
            HashMap::from([("PATH".to_string(), "".to_string())]),
            Some(home.clone()),
            Vec::new(),
            Some(root.clone()),
        );
        fs::remove_dir_all(home.clone()).unwrap_or_default();
        fs::remove_dir_all(root.clone()).unwrap_or_default();

        fs::create_dir_all(home.clone()).unwrap_or_default();
        fs::create_dir_all(root.clone()).unwrap_or_default();
        fs::create_dir_all(conda_envs.clone()).unwrap_or_default();
        fs::create_dir_all(conda_rc_file.parent().unwrap()).unwrap_or_default();

        create_conda_rc(conda_rc_file, &vec![conda_dir.clone()]);

        let result = get_conda_environment_paths_from_conda_rc(&known);
        assert_eq!(result.len(), 1);
        assert_eq!(result[0], conda_envs);

        fs::remove_dir_all(home.clone()).unwrap_or_default();
        fs::remove_dir_all(root.clone()).unwrap_or_default();
    }

    let home = test_file_path(&["tests/unix/conda_rc/user_home"]);
    let root = test_file_path(&["tests/unix/conda_rc/root"]);

    test_with(&root.join("etc/conda/.condarc"));
    test_with(&home.join(".condarc"));
}

#[test]
#[cfg(unix)]
fn find_conda_exe_and_empty_envs() {
    use crate::common::{create_test_environment, join_test_paths, test_file_path};
    use python_finder::messaging::{EnvManager, EnvManagerType};
    use python_finder::{conda, locator::Locator};
    use serde_json::json;
    use std::collections::HashMap;
    let user_home = test_file_path(&["tests/unix/conda_without_envs/user_home"]);
    let conda_dir = test_file_path(&["tests/unix/conda_without_envs/user_home"]);

    let known = create_test_environment(
        HashMap::from([(
            "PATH".to_string(),
            conda_dir.clone().to_str().unwrap().to_string(),
        )]),
        Some(user_home),
        Vec::new(),
        None,
    );

    let mut locator = conda::Conda::with(&known);
    let result = locator.find().unwrap();
    let managers = result.managers;
    assert_eq!(managers.len(), 1);

    let conda_exe = join_test_paths(&[
        conda_dir.clone().to_str().unwrap(),
        "anaconda3",
        "bin",
        "conda",
    ]);
    let expected_conda_manager = EnvManager {
        executable_path: conda_exe.clone(),
        version: Some("4.0.2".to_string()),
        tool: EnvManagerType::Conda,
        company: None,
        company_display_name: None,
    };
    assert_eq!(managers.len(), 1);
    assert_eq!(json!(expected_conda_manager), json!(managers[0]));
}

#[test]
#[cfg(unix)]
fn find_conda_from_custom_install_location() {
    use crate::common::{create_test_environment, test_file_path};
    use python_finder::messaging::{EnvManager, EnvManagerType, PythonEnvironment};
    use python_finder::{conda, locator::Locator};
    use serde_json::json;
    use std::collections::HashMap;
    use std::fs;

    let home = test_file_path(&["tests/unix/conda_custom_install_path/user_home"]);
    let conda_dir =
        test_file_path(&["tests/unix/conda_custom_install_path/user_home/some_location/anaconda3"]);
    let environments_txt =
        test_file_path(&["tests/unix/conda_custom_install_path/user_home/.conda/environments.txt"]);

    fs::create_dir_all(environments_txt.parent().unwrap()).unwrap_or_default();
    fs::write(
        environments_txt.clone(),
        format!("{}", conda_dir.clone().to_str().unwrap().to_string()),
    )
    .unwrap();

    let known = create_test_environment(HashMap::new(), Some(home), Vec::new(), None);

    let mut locator = conda::Conda::with(&known);
    let result = locator.find().unwrap();

    assert_eq!(result.managers.len(), 1);
    assert_eq!(result.environments.len(), 1);

    let conda_exe = conda_dir.clone().join("bin").join("conda");
    let expected_conda_manager = EnvManager {
        executable_path: conda_exe.clone(),
        version: Some("4.0.2".to_string()),
        tool: EnvManagerType::Conda,
        company: None,
        company_display_name: None,
    };
    assert_eq!(json!(expected_conda_manager), json!(result.managers[0]));

    let expected_conda_env = PythonEnvironment {
        display_name: None,
        name: None,
        project_path: None,
        python_executable_path: Some(conda_dir.clone().join("bin").join("python")),
        category: python_finder::messaging::PythonEnvironmentCategory::Conda,
        version: Some("10.0.1".to_string()),
        env_path: Some(conda_dir.clone()),
        env_manager: Some(expected_conda_manager.clone()),
        python_run_command: Some(vec![
            conda_exe.clone().to_str().unwrap().to_string(),
            "run".to_string(),
            "-n".to_string(),
            "base".to_string(),
            "python".to_string(),
        ]),
        arch: None,
        ..Default::default()
    };
    assert_eq!(json!(expected_conda_env), json!(result.environments[0]));

    // Reset environments.txt
    fs::write(environments_txt.clone(), "").unwrap();
}

#[test]
#[cfg(unix)]
fn finds_two_conda_envs_from_known_location() {
    use crate::common::{
        assert_messages, create_test_environment, join_test_paths, test_file_path,
    };
    use python_finder::messaging::{Architecture, EnvManager, EnvManagerType, PythonEnvironment};
    use python_finder::{conda, locator::Locator};
    use serde_json::json;
    use std::collections::HashMap;

    let home = test_file_path(&["tests/unix/conda/user_home"]);
    let conda_dir = test_file_path(&["tests/unix/conda/user_home/anaconda3"]);
    let conda_1 = join_test_paths(&[conda_dir.clone().to_str().unwrap(), "envs/one"]);
    let conda_2 = join_test_paths(&[conda_dir.clone().to_str().unwrap(), "envs/two"]);

    let known = create_test_environment(
        HashMap::from([(
            "PATH".to_string(),
            conda_dir.clone().to_str().unwrap().to_string(),
        )]),
        Some(home),
        Vec::new(),
        None,
    );

    let mut locator = conda::Conda::with(&known);
    let result = locator.find().unwrap();

    let managers = result.managers;
    let environments = result.environments;
    assert_eq!(managers.len(), 1);

    let conda_exe = join_test_paths(&[conda_dir.clone().to_str().unwrap(), "bin", "conda"]);
    let conda_root_exe = join_test_paths(&[conda_dir.clone().to_str().unwrap(), "bin", "python"]);
    let conda_1_exe = join_test_paths(&[conda_1.clone().to_str().unwrap(), "python"]);
    let conda_2_exe = join_test_paths(&[conda_2.clone().to_str().unwrap(), "python"]);

    let expected_conda_manager = EnvManager {
        executable_path: conda_exe.clone(),
        version: Some("23.11.0".to_string()),
        tool: EnvManagerType::Conda,
        company: None,
        company_display_name: None,
    };

    assert_eq!(managers.len(), 1);
    assert_eq!(json!(expected_conda_manager), json!(managers[0]));

    let expected_conda_root = PythonEnvironment {
        display_name: None,
        name: None,
        project_path: None,
        python_executable_path: Some(conda_root_exe.clone()),
        category: python_finder::messaging::PythonEnvironmentCategory::Conda,
        version: Some("3.11.5".to_string()),
        env_path: Some(conda_dir.clone()),
        env_manager: Some(expected_conda_manager.clone()),
        python_run_command: Some(vec![
            conda_exe.clone().to_str().unwrap().to_string(),
            "run".to_string(),
            "-n".to_string(),
            "base".to_string(),
            "python".to_string(),
        ]),
        arch: Some(Architecture::X64),
        ..Default::default()
    };
    let expected_conda_1 = PythonEnvironment {
        display_name: None,
        name: Some("one".to_string()),
        project_path: None,
        python_executable_path: Some(conda_1_exe.clone()),
        category: python_finder::messaging::PythonEnvironmentCategory::Conda,
        version: Some("10.0.1".to_string()),
        env_path: Some(conda_1.clone()),
        env_manager: Some(expected_conda_manager.clone()),
        python_run_command: Some(vec![
            conda_exe.clone().to_str().unwrap().to_string(),
            "run".to_string(),
            "-n".to_string(),
            "one".to_string(),
            "python".to_string(),
        ]),
        arch: None,
        ..Default::default()
    };
    let expected_conda_2 = PythonEnvironment {
        display_name: None,
        name: Some("two".to_string()),
        project_path: None,
        python_executable_path: Some(conda_2_exe.clone()),
        category: python_finder::messaging::PythonEnvironmentCategory::Conda,
        version: None,
        env_path: Some(conda_2.clone()),
        env_manager: Some(expected_conda_manager.clone()),
        python_run_command: Some(vec![
            conda_exe.clone().to_str().unwrap().to_string(),
            "run".to_string(),
            "-n".to_string(),
            "two".to_string(),
            "python".to_string(),
        ]),
        arch: None,
        ..Default::default()
    };
    assert_messages(
        &[
            json!(expected_conda_root),
            json!(expected_conda_1),
            json!(expected_conda_2),
        ],
        &environments.iter().map(|e| json!(e)).collect::<Vec<_>>(),
    );
}

#[test]
#[cfg(unix)]
fn detect_conda_envs_from_envs_directory() {
    use crate::common::{create_test_environment, join_test_paths, test_file_path};
    use python_finder::messaging::{EnvManager, EnvManagerType, PythonEnvironment};
    use python_finder::utils::PythonEnv;
    use python_finder::{conda, locator::Locator};
    use serde_json::json;
    use std::collections::HashMap;

    let home = test_file_path(&["tests/unix/conda/user_home"]);
    let conda_dir = test_file_path(&["tests/unix/conda/user_home/anaconda3"]);
    let conda_1 = join_test_paths(&[conda_dir.clone().to_str().unwrap(), "envs/one"]);

    let known = create_test_environment(
        HashMap::from([(
            "PATH".to_string(),
            conda_dir.clone().to_str().unwrap().to_string(),
        )]),
        Some(home),
        Vec::new(),
        None,
    );

    let locator = conda::Conda::with(&known);
    let python_env = PythonEnv {
        executable: conda_1.join("bin").join("python"),
        version: None,
        path: Some(conda_1.clone()),
    };
    let result = locator.resolve(&python_env);
    assert_eq!(result.is_some(), true);
    let result = result.unwrap();

    let conda_exe = join_test_paths(&[conda_dir.clone().to_str().unwrap(), "bin", "conda"]);
    let conda_1_exe = join_test_paths(&[conda_1.clone().to_str().unwrap(), "python"]);

    let expected_conda_manager = EnvManager {
        executable_path: conda_exe.clone(),
        version: Some("23.11.0".to_string()),
        tool: EnvManagerType::Conda,
        company: None,
        company_display_name: None,
    };

    assert_eq!(json!(expected_conda_manager), json!(&result.env_manager));

    let expected_conda_1 = PythonEnvironment {
        display_name: None,
        name: Some("one".to_string()),
        project_path: None,
        python_executable_path: Some(conda_1_exe.clone()),
        category: python_finder::messaging::PythonEnvironmentCategory::Conda,
        version: Some("10.0.1".to_string()),
        env_path: Some(conda_1.clone()),
        env_manager: Some(expected_conda_manager.clone()),
        python_run_command: Some(vec![
            conda_exe.clone().to_str().unwrap().to_string(),
            "run".to_string(),
            "-n".to_string(),
            "one".to_string(),
            "python".to_string(),
        ]),
        arch: None,
        ..Default::default()
    };
    assert_eq!(json!(expected_conda_1), json!(result));
}

#[test]
#[cfg(unix)]
fn detect_root_conda_envs_from_install_directory() {
    use crate::common::{create_test_environment, join_test_paths, test_file_path};
    use python_finder::messaging::{Architecture, EnvManager, EnvManagerType, PythonEnvironment};
    use python_finder::utils::PythonEnv;
    use python_finder::{conda, locator::Locator};
    use serde_json::json;
    use std::collections::HashMap;

    let home = test_file_path(&["tests/unix/conda/user_home"]);
    let conda_dir = test_file_path(&["tests/unix/conda/user_home/anaconda3"]);

    let known = create_test_environment(
        HashMap::from([(
            "PATH".to_string(),
            conda_dir.clone().to_str().unwrap().to_string(),
        )]),
        Some(home),
        Vec::new(),
        None,
    );

    let locator = conda::Conda::with(&known);
    let python_env = PythonEnv {
        executable: conda_dir.join("bin").join("python"),
        version: None,
        path: Some(conda_dir.clone()),
    };
    let result = locator.resolve(&python_env);
    assert_eq!(result.is_some(), true);
    let result = result.unwrap();

    let conda_exe = join_test_paths(&[conda_dir.clone().to_str().unwrap(), "bin", "conda"]);

    let expected_conda_manager = EnvManager {
        executable_path: conda_exe.clone(),
        version: Some("23.11.0".to_string()),
        tool: EnvManagerType::Conda,
        company: None,
        company_display_name: None,
    };

    assert_eq!(json!(expected_conda_manager), json!(&result.env_manager));

    let expected_conda_1 = PythonEnvironment {
        display_name: None,
        name: None,
        project_path: None,
        python_executable_path: Some(conda_dir.join("bin").join("python")),
        category: python_finder::messaging::PythonEnvironmentCategory::Conda,
        version: Some("3.11.5".to_string()),
        env_path: Some(conda_dir.clone()),
        env_manager: Some(expected_conda_manager.clone()),
        python_run_command: Some(vec![
            conda_exe.clone().to_str().unwrap().to_string(),
            "run".to_string(),
            "-n".to_string(),
            "base".to_string(),
            "python".to_string(),
        ]),
        arch: Some(Architecture::X64),
        ..Default::default()
    };
    assert_eq!(json!(expected_conda_1), json!(result));
}

#[test]
#[cfg(unix)]
fn detect_conda_envs_from_project_dir_created_using_p_flag() {
    use crate::common::{create_test_environment, join_test_paths, test_file_path};
    use python_finder::messaging::{EnvManager, EnvManagerType, PythonEnvironment};
    use python_finder::utils::PythonEnv;
    use python_finder::{conda, locator::Locator};
    use serde_json::json;
    use std::collections::HashMap;
    use std::fs;

    let home = test_file_path(&["tests/unix/conda_env_created_using_p_flag/user_home"]);
    let conda_dir =
        test_file_path(&["tests/unix/conda_env_created_using_p_flag/user_home/anaconda3"]);
    let conda_env =
        test_file_path(&["tests/unix/conda_env_created_using_p_flag/user_home/dev_folder/two"]);
    let history = test_file_path(&[
        "tests/unix/conda_env_created_using_p_flag/user_home/dev_folder/two/conda-meta/history",
    ]);
    let history_template = test_file_path(&[
        "tests/unix/conda_env_created_using_p_flag/user_home/dev_folder/two/conda-meta/history.template",
    ]);
    let history_contents = fs::read_to_string(history_template.clone()).unwrap();
    let _ = fs::write(
        &history,
        history_contents.replace("<user_home>", home.to_str().unwrap_or_default()),
    );

    let known = create_test_environment(
        HashMap::from([(
            "PATH".to_string(),
            conda_dir.clone().to_str().unwrap().to_string(),
        )]),
        Some(home),
        Vec::new(),
        None,
    );

    let locator = conda::Conda::with(&known);
    let python_env = PythonEnv {
        executable: conda_env.join("bin").join("python"),
        version: None,
        path: Some(conda_env.clone()),
    };
    let result = locator.resolve(&python_env);
    assert_eq!(result.is_some(), true);
    let result = result.unwrap();

    let conda_exe = join_test_paths(&[conda_dir.clone().to_str().unwrap(), "bin", "conda"]);
    let conda_env_exe = join_test_paths(&[conda_env.clone().to_str().unwrap(), "python"]);

    let expected_conda_manager = EnvManager {
        executable_path: conda_exe.clone(),
        version: Some("4.0.2".to_string()),
        tool: EnvManagerType::Conda,
        company: None,
        company_display_name: None,
    };

    assert_eq!(json!(expected_conda_manager), json!(&result.env_manager));

    let expected_conda_env = PythonEnvironment {
        display_name: None,
        name: Some("two".to_string()),
        project_path: None,
        python_executable_path: Some(conda_env_exe.clone()),
        category: python_finder::messaging::PythonEnvironmentCategory::Conda,
        version: Some("3.12.2".to_string()),
        env_path: Some(conda_env.clone()),
        env_manager: Some(expected_conda_manager.clone()),
        python_run_command: Some(vec![
            conda_exe.clone().to_str().unwrap().to_string(),
            "run".to_string(),
            "-n".to_string(),
            "two".to_string(),
            "python".to_string(),
        ]),
        arch: None,
        ..Default::default()
    };
    assert_eq!(json!(expected_conda_env), json!(result));

    // Reset history file
    let history_contents = fs::read_to_string(history_template.clone()).unwrap();
    let _ = fs::write(history, history_contents);
}

#[test]
#[cfg(unix)]
fn get_conda_package_info() {
    use crate::common::{join_test_paths, test_file_path};
    use python_finder::conda::{get_conda_package_json_path, CondaPackage};

    use python_finder::messaging::Architecture;

    let conda_dir = test_file_path(&["tests/unix/conda/user_home/anaconda3"]);

    let conda_package = get_conda_package_json_path(&conda_dir, "conda").unwrap();
    assert_eq!(
        conda_package,
        CondaPackage {
            path: join_test_paths(&[
                conda_dir.to_str().unwrap(),
                "conda-meta",
                "conda-23.11.0-py311hca03da5_0.json"
            ]),
            version: "23.11.0".to_string(),
            arch: Some(Architecture::X64),
        }
    );
    let python_package = get_conda_package_json_path(&conda_dir, "python").unwrap();
    assert_eq!(
        python_package,
        CondaPackage {
            path: join_test_paths(&[
                conda_dir.to_str().unwrap(),
                "conda-meta",
                "python-3.11.5-hb885b13_0.json"
            ]),
            version: "3.11.5".to_string(),
            arch: Some(Architecture::X64),
        }
    );
}
