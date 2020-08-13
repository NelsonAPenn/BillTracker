extern crate mongodb;
#[path = "bill.rs"]
mod bill;


use futures::stream::StreamExt;
use mongodb::{Client, bson::{Document, doc, Bson}, options::{ClientOptions, FindOptions}};
use bill::{Bill, Metadata, PaymentRequest, DueDate};

pub async fn handle_bills() -> Result<(), ()>
{
    let all_bills = get_bills().await;

    Ok(())
}

pub async fn get_bills() -> Vec<Bill>
{
    // Parse a connection string into an options struct.
    let mut client_options = ClientOptions::parse("mongodb://localhost:27017").await.unwrap();

    // Get a handle to the deployment.
    let client = Client::with_options(client_options).unwrap();

    let collection = client.database("bill_tracker").collection("bills");

    let mut cursor = collection.find(doc!{}, None).await.unwrap();

    let results: Vec::<Result<Document, mongodb::error::Error>> = cursor.collect().await;

    for res in &results
    {
        if let Ok(doc) = res{
            println!("{}", doc);
        }
    }

    Vec::<Bill>::new()
}
