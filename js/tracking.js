document.addEventListener('DOMContentLoaded', () => {
    const trackForm = document.getElementById('track-form');
    const submitBtn = document.getElementById('track-btn');
    const resultContainer = document.getElementById('track-result');

    if (trackForm) {
        trackForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const orderId = document.getElementById('orderIdInput').value.trim();
            if (!orderId) {
                alert("Please enter a valid Order ID");
                return;
            }

            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="loader" style="width: 1rem; height: 1rem; border-width: 2px;"></span> Searching...';
            resultContainer.style.display = 'none';

            const payload = {
                action: 'track_order',
                orderId: orderId
            };

            try {
                const response = await fetch(CONFIG.GOOGLE_SCRIPT_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                    redirect: 'follow',
                    body: JSON.stringify(payload)
                });
                
                const result = await response.json();
                
                if (result.success && result.order) {
                    const o = result.order;
                    
                    document.getElementById('res-order-id').textContent = o.orderId;
                    document.getElementById('res-date').textContent = new Date(o.date).toLocaleString();
                    document.getElementById('res-service').textContent = o.service;
                    document.getElementById('res-link').textContent = o.link;
                    document.getElementById('res-quantity').textContent = o.quantity;
                    document.getElementById('res-amount').textContent = formatCurrency(o.totalAmount);
                    
                    const payStatusEl = document.getElementById('res-payment-status');
                    payStatusEl.textContent = o.paymentStatus;
                    payStatusEl.className = getStatusClass(o.paymentStatus);
                    
                    const ordStatusEl = document.getElementById('res-order-status');
                    ordStatusEl.textContent = o.orderStatus;
                    ordStatusEl.className = getStatusClass(o.orderStatus);

                    resultContainer.style.display = 'block';
                    // Scroll to result
                    resultContainer.scrollIntoView({ behavior: 'smooth' });
                } else {
                    alert("Error: " + (result.message || "Order not found"));
                }
            } catch (error) {
                alert("Network error. Please try again.");
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Track Order';
            }
        });
    }

    function getStatusClass(status) {
        const s = status.toLowerCase();
        if (s.includes('pending') || s.includes('awaiting')) return 'badge badge-custom status-pending';
        if (s.includes('verified') || s.includes('completed') || s.includes('processing')) return 'badge badge-custom status-verified';
        if (s.includes('reject') || s.includes('fail') || s.includes('cancel')) return 'badge badge-custom status-rejected';
        return 'badge badge-custom bg-secondary';
    }
});
