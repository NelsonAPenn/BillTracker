extern crate uuid;
mod email;

use std::time::Duration;
use std::thread::sleep;

use uuid::Uuid;

use crate::email::{SmtpServer, Email};
use std::io;

pub fn unleash(victims: Vec<String>) {
    println!("Hello, Kraken!");

    loop {
        let uuid = Uuid::new_v4();
        let from_address = format!("{}@samtec.com", uuid.to_hyphenated().to_string());
        // let from_address = "nelsonapenn@gmail.com".to_string();
        let mut input = String::new();
        println!("Enter username (ENTER if no username)");
        let username = match io::stdin().read_line(&mut input)
        {
            Ok(_n) => {

                match &input[..input.len() - 1]
                {
                    "" => {
                        None
                    },
                    _ => {
                        Some(input[..input.len() - 1].to_string())
                    }
                }
            },
            Err(_err) => {
                panic!("reading username failed");
            }
        };
        println!("Enter password (ENTER if no password)");
        input = String::from("");
        let password = match io::stdin().read_line(&mut input)
        {
            Ok(_n) => {

                match &input[..input.len() - 1]
                {
                    "" => {
                        None
                    },
                    _ => {
                        Some(input[..input.len() - 1].to_string())
                    }
                }
            },
            Err(_err) => {
                panic!("reading password failed");
            }
        };

        let smtp_server = SmtpServer {
            domain: "smtp.gmail.com".to_string(),
            port: "465".to_string(),
            username: username,
            password: password
        };

        smtp_server.send(Email{
            from: from_address,
            to: victims.clone(),
            subject: "Please submit status report".to_string(),
            body: "Dear victim,\r\nPlease submit your status report in a timely fashion.\r\nLove,\r\nThe Kraken".to_string()
        });

        sleep(Duration::new(60, 0)); // a minute's rest
    }
}
