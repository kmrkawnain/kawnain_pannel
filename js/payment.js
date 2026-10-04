document.addEventListener('DOMContentLoaded', () => {
    const orderDataStr = localStorage.getItem('pendingOrder');
    
    if (!orderDataStr) {
        // Redirect if no order is pending
        window.location.href = 'order.html';
        return;
    }
    
    const orderData = JSON.parse(orderDataStr);
    
    // Display order info
    document.getElementById('display-order-id').textContent = orderData.orderId;
    document.getElementById('display-amount').textContent = formatCurrency(orderData.totalAmount);
    document.getElementById('display-upi-id').textContent = CONFIG.UPI_ID;
    
    // Generate UPI QR Code dynamically using upi:// URI
    // Format: upi://pay?pa=UPI_ID&pn=NAME&am=AMOUNT&cu=INR
    const upiUri = `upi://pay?pa=${CONFIG.UPI_ID}&pn=${encodeURIComponent(CONFIG.UPI_NAME)}&am=${orderData.totalAmount}&cu=INR`;
    
    // Use an external API to generate QR Code image based on the URI
    // https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=
    const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(upiUri)}`;
    
    const qrImg = document.createElement('img');
    qrImg.src = qrImageUrl;
    qrImg.alt = "UPI QR Code";
    qrImg.className = "img-fluid";
    document.getElementById('qr-container').appendChild(qrImg);
    
    // Copy UPI ID functionality
    document.getElementById('copy-upi-btn').addEventListener('click', function() {
        navigator.clipboard.writeText(CONFIG.UPI_ID).then(() => {
            const originalText = this.innerHTML;
            this.innerHTML = '<i class="bi bi-check-circle"></i> Copied!';
            setTimeout(() => {
                this.innerHTML = originalText;
            }, 2000);
        });
    });
    
    // Payment Form Submission
    const paymentForm = document.getElementById('payment-form');
    const submitBtn = document.getElementById('submit-payment-btn');
    const alertContainer = document.getElementById('payment-alert');
    
    paymentForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const utr = document.getElementById('utrInput').value.trim();
        if (!utr) {
            showAlert('Please enter your UTR / Transaction ID', 'danger');
            return;
        }
        
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="loader" style="width: 1rem; height: 1rem; border-width: 2px;"></span> Verifying...';
        
        const payload = {
            action: 'submit_utr',
            orderId: orderData.orderId,
            utr: utr
        };
        
        try {
            const response = await fetch(CONFIG.GOOGLE_SCRIPT_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                redirect: 'follow',
                body: JSON.stringify(payload)
            });
            
            const textResponse = await response.text();
            let result;
            try {
                result = JSON.parse(textResponse);
            } catch (err) {
                if (textResponse.trim() === "Success" || textResponse.includes("doGet") || textResponse.includes("ppConfig") || textResponse.includes("<!DOCTYPE html>")) {
                    result = { success: true };
                } else {
                    throw err;
                }
            }
            
            if (result.success) {
                document.getElementById('payment-step-1').style.display = 'none';
                document.getElementById('payment-step-2').style.display = 'block';
                localStorage.removeItem('pendingOrder'); // Clear order
            } else {
                showAlert(result.message || 'Failed to submit UTR', 'danger');
                submitBtn.disabled = false;
                submitBtn.textContent = 'Submit Payment Details';
            }
        } catch (error) {
            showAlert('Network error. Please try again.', 'danger');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit Payment Details';
        }
    });
    
    function showAlert(message, type) {
        alertContainer.innerHTML = `<div class="alert alert-${type} mt-3">${message}</div>`;
    }
});
