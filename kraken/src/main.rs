use std::env;

fn main() {
    let args:Vec<String> = env::args().collect();
    assert!(args.len() > 1);
    kraken::unleash(args[1..].to_vec());
}
