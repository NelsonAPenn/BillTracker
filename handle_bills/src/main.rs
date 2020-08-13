mod lib;

use lib::handle_bills;
use futures::executor::block_on;

fn main() {
    let future = handle_bills();
    block_on(future).unwrap();
}
