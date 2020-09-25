extern crate toml;
extern crate serde;

use serde::Deserialize;
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Deserialize)]
pub struct Config {
    pub delay_seconds: u64,
    pub mail_host: String,
    pub port: String,
    pub domain: String,
    pub message: String,
    pub username: Option<String>,
    pub password: Option<String>,
    pub supports_ssl: bool
}

pub fn read_config_file(path: PathBuf) -> Option<Config> {
    fs::read_to_string(path).ok().map(|content| {
        let config: Config = toml::from_str(&content).unwrap();
        config
    })
}
