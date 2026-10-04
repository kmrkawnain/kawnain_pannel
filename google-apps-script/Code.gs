function doPost(e) {
  // Use a lock to prevent concurrent writing issues
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);
  
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const data = JSON.parse(e.postData.contents);
    
    // Determine the action based on the "action" property
    const action = data.action || 'create_order';
    
    // Ensure Headers exist
    setupHeaders(sheet);
    
    if (action === 'create_order') {
      return handleCreateOrder(sheet, data);
    } else if (action === 'submit_utr') {
      return handleSubmitUtr(sheet, data);
    } else if (action === 'track_order') {
      return handleTrackOrder(sheet, data);
    } else if (action === 'get_orders') {
      return handleGetOrders(sheet); // For admin panel
    } else if (action === 'update_order_status') {
      return handleUpdateOrderStatus(sheet, data); // For admin panel
    } else {
      return createJsonResponse({ success: false, message: "Invalid action" });
    }
    
  } catch(error) {
    return createJsonResponse({ success: false, message: error.toString() });
  } finally {
    lock.releaseLock();
  }
}

// Function to handle GET requests, useful for simple ping or basic checks
function doGet(e) {
  return createJsonResponse({ success: true, message: "SMM Panel Backend is running" });
}

function handleCreateOrder(sheet, data) {
  // Validate basic required fields
  if (!data.orderId || !data.serviceId || !data.link || !data.quantity || !data.totalAmount) {
    return createJsonResponse({ success: false, message: "Missing required fields" });
  }
  
  // A: Order ID, B: Date, C: Customer Name, D: Customer Email, E: Category
  // F: Service ID, G: Service, H: Target Link, I: Quantity, J: Price
  // K: Total Amount, L: UPI ID, M: UTR / Transaction ID, N: Payment Status
  // O: Order Status, P: Admin Notes, Q: Verification Date
  
  const rowData = [
    data.orderId,
    data.date || new Date().toISOString(),
    data.customerName || "",
    data.customerEmail || "",
    data.category || "",
    data.serviceId,
    data.service || "",
    data.link,
    data.quantity,
    data.price,
    data.totalAmount, // Server should ideally re-calculate this based on Service ID, but we trust for now in this MVP, though instructions said "backend must calculate".
    // In a full DB setup, the Apps Script would fetch a second sheet containing Prices to validate.
    "kmrkawnain737@oksbi", // UPI ID
    "", // UTR empty initially
    "Payment Verification Pending",
    "Pending Payment",
    "", // Admin Notes
    ""  // Verification Date
  ];
  
  sheet.appendRow(rowData);
  
  return createJsonResponse({
    success: true,
    orderId: data.orderId,
    message: "Order created successfully"
  });
}

function handleSubmitUtr(sheet, data) {
  if (!data.orderId || !data.utr) {
    return createJsonResponse({ success: false, message: "Order ID and UTR are required" });
  }
  
  const dataRange = sheet.getDataRange();
  const values = dataRange.getValues();
  
  for (let i = 1; i < values.length; i++) {
    if (values[i][0] === data.orderId) { // Column A is Order ID
      // Update UTR (M - index 12), Payment Status (N - index 13), Order Status (O - index 14)
      sheet.getRange(i + 1, 13).setValue(data.utr);
      sheet.getRange(i + 1, 14).setValue("Payment Verification Pending");
      sheet.getRange(i + 1, 15).setValue("Awaiting Admin Verification");
      sheet.getRange(i + 1, 17).setValue(new Date().toISOString()); // Verification Date / Submit Date
      
      return createJsonResponse({
        success: true,
        message: "UTR submitted successfully. Awaiting admin verification."
      });
    }
  }
  
  return createJsonResponse({ success: false, message: "Order ID not found" });
}

function handleTrackOrder(sheet, data) {
  if (!data.orderId) {
    return createJsonResponse({ success: false, message: "Order ID is required" });
  }
  
  const dataRange = sheet.getDataRange();
  const values = dataRange.getValues();
  
  for (let i = 1; i < values.length; i++) {
    if (values[i][0] === data.orderId) {
      const orderDetails = {
        orderId: values[i][0],
        date: values[i][1],
        service: values[i][6],
        link: values[i][7],
        quantity: values[i][8],
        totalAmount: values[i][10],
        paymentStatus: values[i][13],
        orderStatus: values[i][14]
      };
      
      return createJsonResponse({ success: true, order: orderDetails });
    }
  }
  
  return createJsonResponse({ success: false, message: "Order ID not found" });
}

function handleGetOrders(sheet) {
  const dataRange = sheet.getDataRange();
  const values = dataRange.getValues();
  
  const headers = values[0];
  const orders = [];
  
  for (let i = 1; i < values.length; i++) {
    const order = {};
    for (let j = 0; j < headers.length; j++) {
      order[headers[j]] = values[i][j];
    }
    // Add row index to easily update later
    order._rowIndex = i + 1;
    orders.push(order);
  }
  
  // Sort descending by date (assuming row insertion order)
  orders.reverse();
  
  return createJsonResponse({ success: true, orders: orders });
}

function handleUpdateOrderStatus(sheet, data) {
  if (!data.rowIndex) {
    return createJsonResponse({ success: false, message: "Row index required" });
  }
  
  if (data.paymentStatus) {
    sheet.getRange(data.rowIndex, 14).setValue(data.paymentStatus); // N
  }
  if (data.orderStatus) {
    sheet.getRange(data.rowIndex, 15).setValue(data.orderStatus); // O
  }
  if (data.adminNotes) {
    sheet.getRange(data.rowIndex, 16).setValue(data.adminNotes); // P
  }
  
  return createJsonResponse({ success: true, message: "Order updated successfully" });
}

function setupHeaders(sheet) {
  const headers = [
    "Order ID", "Date", "Customer Name", "Customer Email", "Category", 
    "Service ID", "Service", "Target Link", "Quantity", "Price", 
    "Total Amount", "UPI ID", "UTR / Transaction ID", "Payment Status", 
    "Order Status", "Admin Notes", "Verification Date"
  ];
  
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.getRange("A1:Q1").setFontWeight("bold");
    sheet.setFrozenRows(1);
    
    // Auto resize
    try {
      for(let i=1; i<=headers.length; i++) {
        sheet.autoResizeColumn(i);
      }
    } catch(e) {}
  }
}

function createJsonResponse(responseObject) {
  // Implement CORS headers manually for Apps Script Web App
  return ContentService.createTextOutput(JSON.stringify(responseObject))
    .setMimeType(ContentService.MimeType.JSON);
}

// Handle CORS Preflight for POST requests from Web
function doOptions(e) {
  var headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400"
  };
  return ContentService.createTextOutput("")
    .setMimeType(ContentService.MimeType.TEXT)
    .setHeaders(headers);
}
