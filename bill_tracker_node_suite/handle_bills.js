const fs = require('fs');
const { MongoClient, ObjectId } = require('mongodb');
const readline = require('readline');
const venmo_credentials = require('../data/venmo_credentials');
const friend_data = require('../data/friends');
const request = require('./await_request');
const { argv, exit } = require('process');
const { assert } = require('console');


const CONNECTION_STRING = 'mongodb://localhost:27017';
const PREFIX = "../data/";
const CREDENTIALS_PATH = PREFIX + 'credentials.json';
const TOKEN_PATH = PREFIX + 'token.json';
const RAW_BILLS_PATH = PREFIX + 'rawBills.json';
const ERRORED_BILLS_PATH = PREFIX + 'erroredBills.json';
const client = new MongoClient(CONNECTION_STRING);
const billTypes = {
  electric: "electric",
  water: "water",
  sewer: "sewer",
  gas: "gas",
  internet: "internet"
}

/**
 * 
 * @param {string} payment_id 
 * @returns {JSON} - The raw JSON data associated with the payment from Venmo
 */
async function get_payment(payment_id) {
  let options = {
    'method': 'GET',
    'url': 'https://api.venmo.com/v1/payments/' + payment_id,
    'headers': {
      'Authorization': 'Bearer ' + venmo_credentials.access_token
    }
  };

  let result = await request(options);
  return result;
}

async function get_status(payment_id) {
  let json_response = await get_payment(payment_id);
  if (json_response == null)
    return null;
  return json_response.data.status;
}

/**
 * 
 * @param {string} name - name of friend
 * @param {number} amount 
 * @param {string} billType 
 * @param {object} date 
 * @returns {string} - payment id
 */
async function request_payment(name, amount, billType, date) {
  let friend_id = friend_data.friends[name].id;
  if (friend_id == null)
    throw Error("Invalid friend.");

  var options = {
    'method': 'POST',
    'url': 'https://api.venmo.com/v1/payments',
    'headers': {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + venmo_credentials.access_token
    },
    body: JSON.stringify({ "note": (await get_message(billType, date)), "metadata": { "quasi_cash_disclaimer_viewed": false }, "amount": -1.0 * amount, "user_id": friend_id, "audience": "private" })

  };

  let response = await request(options);
  return response.data.payment.id;

}


/**
 * 
 * @param {object} bill 
 * @returns {object} - object containing array names and float amount
 */
async function calculate_charge(bill)
{
  let response = {
    group: "oldham",
    names: [],
    amount: 0.0
  };
  let divisor = 5.0;
  if(bill.billType == billTypes.electric || bill.billType == billTypes.water)
  {
    // possibly for Transylvania
    if(bill.date.year <= 2020 && bill.date.month <= 8)
    {
      // Transylvania
      response.group = "transylvania";
      divisor = 2.0;
    }
  }
  if(response.group === "oldham" && (bill.billType == "water" || bill.billType == "sewer"))
  {
    // don't pay part of it until you move in
    divisor = 4.0;

  }

  response.names = friend_data.groups[response.group];
  response.amount = bill.amount / divisor;

  return response;
}

/**
 * 
 * @param {string} billType 
 * @param {object} date 
 * @returns {string} - message
 */
async function get_message(billType, date)
{
  return billType + ' bill due ' + date.month + '/' + date.day + '/' + date.year
}
// get_status("2999688746879680522").then(console.log);

async function handle_bills() {
  const connection = await client.connect();
  const db = connection.db("bill_tracker");
  const collection = db.collection("bills");

  let to_request = await collection.find( { "metadata.status": "scraped" }).toArray();
  let to_update = await collection.find( { "metadata.status": "requested" }).toArray();

  if(argv.length < 3)
    exit(1);

  let dry_run = true;
  if(argv[2] == "dry")
  {
    dry_run = true;
  }
  else if(argv[2] == "wet")
  {
    dry_run = false;
  }
  else{ exit(1); }

  for(bill of to_update)
  {
    // modify and replace `bill` in database, doesn't affect to_update
    let modified = false;
    // update the status of each payment request
    for(index in bill.metadata.paymentRequests)
    {
      let payment_request = bill.metadata.paymentRequests[index];
      let status = await get_status(payment_request.paymentId);
      let completed = (status === "settled");
      if(completed !== payment_request.completed)
      {
        modified = true;
        bill.metadata.paymentRequests[index].completed = completed;
      }
    }

    if(modified)
    {
      // update done status
      let done = true;
      for (payment_request of bill.metadata.paymentRequests)
      {
        if (payment_request.completed === false)
        {
          done = false;
          break;
        }
      }

      if (done)
      {
        bill.metadata.status = "done";
      }

      let write_result = await collection.replaceOne( { _id: bill._id }, bill );
      assert(write_result.modifiedCount === 1);
    }


  }
  for(bill of to_request)
  {
    // get charges
    let charges = await calculate_charge(bill);
    // charge and update or log
    if(dry_run)
    {
      console.log("PENDING CHARGE:" + charges.amount.toString());
      console.log("message: " + (await get_message(bill.billType, bill.date)));
      for(name of charges.names)
      {
        console.log("\t" + name);
      }
    }
    else
    {
      let requests = [];
      // charge
      for(name of charges.names)
      {
        let payment_id = await request_payment(name, charges.amount, bill.billType, bill.date);
        // collection.updateOne( {bill.emailId})
        requests.push( {
          paymentId: payment_id,
          name: name,
          charged: charges.amount,
          completed: false
        } );
      }
      // update

      let write_result = await collection.updateOne( { _id: bill._id}, { $set: { "metadata.paymentRequests": requests, "metadata.status": "requested" } } );
      assert(write_result.modifiedCount == 1);
    }
    

  }

  await connection.close();
}

handle_bills();