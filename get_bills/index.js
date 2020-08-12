const fs = require('fs');
const { MongoClient } = require('mongodb');
const readline = require('readline');
const {google} = require('googleapis');

// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const CONNECTION_STRING = 'mongodb://localhost:27017';
const PREFIX = "../data/";
const CREDENTIALS_PATH = PREFIX + 'credentials.json';
const TOKEN_PATH = PREFIX + 'token.json';
const RAW_BILLS_PATH = PREFIX + 'rawBills.json';
const ERRORED_BILLS_PATH = PREFIX + 'erroredBills.json';

const client = new MongoClient(CONNECTION_STRING);

// Load client secrets from a local file.
fs.readFile(CREDENTIALS_PATH, (err, content) => {
  if (err) return console.log('Error loading client secret file:', err);
  // Authorize a client with credentials, then call the Gmail API.
  authorize(JSON.parse(content), listLabels);
});

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials, callback) {
  const {client_secret, client_id, redirect_uris} = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(
      client_id, client_secret, redirect_uris[0]);

  // Check if we have previously stored a token.
  fs.readFile(TOKEN_PATH, (err, token) => {
    if (err) return getNewToken(oAuth2Client, callback);
    oAuth2Client.setCredentials(JSON.parse(token));
    callback(oAuth2Client);
  });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback for the authorized client.
 */
function getNewToken(oAuth2Client, callback) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });
  console.log('Authorize this app by visiting this url:', authUrl);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  rl.question('Enter the code from that page here: ', (code) => {
    rl.close();
    oAuth2Client.getToken(code, (err, token) => {
      if (err) return console.error('Error retrieving access token', err);
      oAuth2Client.setCredentials(token);
      // Store the token to disk for later program executions
      fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
        if (err) return console.error(err);
        console.log('Token stored to', TOKEN_PATH);
      });
      callback(oAuth2Client);
    });
  });
}

function base64urldecode(data)
{
  if(!data)
    return "";
  let buf = new Buffer(data.replace("-", "+").replace("_", "/"), 'base64');
  return buf.toString('ascii');
}

let billTypes = {
  electric: "electric",
  water: "water",
  sewer: "sewer",
  gas: "gas",
  internet: "internet"
}

function isValidBill(bill)
{
  var fieldsToCheck = ["emailId", "billType", "date", "amount"];
  for(var i = 0; i < fieldsToCheck.length; i++)
  {
    if(typeof(bill[fieldsToCheck[i]]) === 'undefined')
      return false;
  }
  return true;
}

function tryGetBillType(emailFrom)
{
  if(emailFrom.includes("ebill@lge-ku.com"))
    return billTypes.electric;
  if(emailFrom.includes("Customer_Service@amwater.com"))
    return billTypes.water;
  if(emailFrom.includes("paymentprocessing@metronetinc.com"))
    return billTypes.internet;
}

function tryGetAmount(emailBody, billType)
{
  if(!emailBody)
    return;
  var regex;
  switch(billType)
  {
    case billTypes.internet:
      regex = new RegExp(/'dueAmount'.*?=>.*?'(\d+)\.(\d+)'/);
      break;
    default:
      regex = new RegExp(/\$(\d+)\.(\d+)/, "i");
      break;
  }
  let match = regex.exec(emailBody);
  if(!match)
    return;
  var amount = Number(match[1]) + Number(match[2]) * Math.pow(10, -1 * match[2].length);
  return amount;
}

function tryGetDate(emailBody, billType)
{
  if(!emailBody)
    return;
  var regex;
  switch(billType)
  {
    case billTypes.gas:
      regex = new RegExp(/Due.*?on.*?(?<month>\d*)\/(?<day>\d*)/, "i");
      break;
    case billTypes.internet:
      regex = new RegExp(/'dueDate'.*?=>.*?'(?<month>\d*)\/(?<day>\d*)\/(?<year>\d*)'/);
      break;
    default:
      regex = new RegExp(/date:.*?(?<month>\d*)\/(?<day>\d*)\/(?<year>\d*)/, "i");
      break;
  }
  let match = regex.exec(emailBody);
  if(!match)
    return;
  var toReturn = { day: 0, month: 0, year: 0}
  toReturn.month = Number(match.groups.month);
  toReturn.day = Number(match.groups.day);
  toReturn.year = Number(match.groups.year ? match.groups.year : (new Date()).getFullYear());
  return toReturn;
}

function processPayload(payload, billType)
{
  var info = { date: undefined, amount: undefined };
  // base case
  if(payload.body.size)
  {
    var messageText = base64urldecode(payload.body.data);
    info.date = tryGetDate(messageText, billType);
    info.amount =  tryGetAmount(messageText, billType);
  }
  // recursive step
  else
  {
    for(var i = 0; i < payload.parts.length; i++)
    {
      var result = processPayload(payload.parts[i], billType);
      if(typeof(result.date) !== 'undefined')
      {
        info.date = result.date;
      }

      if(typeof(result.amount) !== 'undefined')
      {
        info.amount = result.amount;
      }

      if(info.date && info.amount)
        break;
    }
  }

  return info;
}

/**
 * Lists the labels in the user's account.
 *
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
async function listLabels(auth) {
  const connection = await client.connect();
  const db = connection.db("bill_tracker");
  const collection = db.collection("bills");
  const gmail = google.gmail({version: 'v1', auth});
  var res = await gmail.users.messages.list({
    userId: 'me',
    q: 'label:Bills'
  });

  const messageIds = res.data.messages;
  var messages = [];
  var known = JSON.parse(fs.readFileSync(RAW_BILLS_PATH).toString());
  var erroredBills = JSON.parse(fs.readFileSync(ERRORED_BILLS_PATH).toString());

  var modified = false;
  for(var i = 0; i < messageIds.length; i++)
  {
    var exists = known.some((x) => x.emailId === messageIds[i].id);
    if(!exists)
    {
      messages.push((await gmail.users.messages.get({ userId: 'me', id: messageIds[i].id})).data);
      modified = true;
    }
  }
  for(var i = 0; i < messages.length; i++)
  {
    var from = "";
    for(var j = 0; j < messages[i].payload.headers.length; j++)
    {
      if(messages[i].payload.headers[j].name == "From")
      {
        from = messages[i].payload.headers[j].value;
      }
    }
    var bill = {
      emailId: messageIds[i].id,
      billType: tryGetBillType(from),
      date: undefined,
      amount: undefined
    };

    var result = processPayload(messages[i].payload, bill.billType);
    bill.date = result.date;
    bill.amount = result.amount;

    var documentToInsert = Object.assign({}, bill);
    documentToInsert.status = "scraped";
    documentToInsert.error = null;
    documentToInsert.metadata = {
      paymentId: null,
      paymentRequests: []
    };
    if(isValidBill(bill))
    {
      known.push(bill);
    }
    else
    {
      erroredBills.push(bill);
      documentToInsert.error = "Error scraping bill.";
    }
    var query = { emailId: documentToInsert.emailId };
    var result = await collection.replaceOne(query, documentToInsert, { upsert: true } ).catch( e => console.log(e));
  }
  if(modified)
  {
    fs.writeFileSync(RAW_BILLS_PATH, JSON.stringify(known));
    fs.writeFileSync(ERRORED_BILLS_PATH, JSON.stringify(erroredBills));

  }

  await connection.close();

  if(erroredBills.length > 0)
    process.exit(1);
}
