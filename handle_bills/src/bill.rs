pub struct Bill
{
    pub email_id: String,
    pub bill_type: String,
    pub due_date: DueDate,
    pub amount: f64,
}

pub struct DueDate
{
    pub day: i32,
    pub month: i32,
    pub year: i32
}

pub struct Metadata
{
    pub error: Option<String>,
    pub status: String,
    pub payment_requests: Vec<PaymentRequest>
}

pub struct PaymentRequest
{
    pub payment_id: Option<String>,
    pub name: String,
    pub charged: f64,
    pub completed: bool
}
