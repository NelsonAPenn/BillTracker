# Bill Tracker

A suite of programs which is designed to:

- scrape all bills from my email
- add them to my financial tracking spreadsheet (eventually)
- send payment requests to my roommates for their portions of each bill

## Structure


`get_bills` scrapes all bills from my email, and adds any new ones into the database.

`handle_bills` adds new bills to my financial spreadsheets and handles making payments or updating the status of existing payments.

`driver.sh` coordinates all above programs and sends me a desktop notification if there is any error. 

## Bill format

```json
{
  "emailId": "String id of associated email from gmail",
    "billType": "'electric', 'water', 'sewer', 'gas', or 'internet'",
    "date": {
      "day": "integer day",
      "month": "integer month",
      "year": "integer year"
    },
    "amount": "Total bill amount. float",
    "metadata": {
      "paymentRequests": [
      {
        "paymentId": "String id of associated Venmo payment request or null if does not exist",
        "name": "Name of person from whom money was requested",
        "charged": "Amount of money request. Float",
        "completed": "Boolean: whether or not the request has been completed."
      },
      {
        "paymentId": "String id of associated Venmo payment request or null if does not exist",
        "name": "Name of person from whom money was requested",
        "charged": "Amount of money request. Float",
        "completed": "Boolean: whether or not the request has been completed."
      },
      ],
      "error": "String error message or null if DNE",
      "status": "'scraped', 'recorded', 'requested', 'done'"
    }
}
```

## Statuses

- "scraped": scraped from email, nothing else done
- "recorded": recorded in spreadsheet
- "requested": payment requests have been sent for all roommates
- "done": recorded and all payment requests have been completed
