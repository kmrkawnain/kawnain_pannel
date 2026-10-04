// Admin panel logic (Note: This is a basic frontend implementation. 
// A real production app needs backend authentication to protect these endpoints)
document.addEventListener('DOMContentLoaded', () => {
    const loadBtn = document.getElementById('load-orders-btn');
    const tableBody = document.getElementById('admin-orders-body');
    const searchInput = document.getElementById('searchOrder');

    let allOrders = [];

    if (loadBtn) {
        loadBtn.addEventListener('click', loadOrders);
    }
    
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const val = e.target.value.toLowerCase();
            const filtered = allOrders.filter(o => 
                o['Order ID'].toLowerCase().includes(val) || 
                o['UTR / Transaction ID'].toLowerCase().includes(val) ||
                o['Target Link'].toLowerCase().includes(val)
            );
            renderOrders(filtered);
        });
    }

    async function loadOrders() {
        loadBtn.disabled = true;
        loadBtn.innerHTML = '<span class="loader" style="width: 1rem; height: 1rem; border-width: 2px;"></span> Loading...';
        
        try {
            const response = await fetch(CONFIG.GOOGLE_SCRIPT_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                redirect: 'follow',
                body: JSON.stringify({ action: 'get_orders' })
            });
            
            const result = await response.json();
            
            if (result.success) {
                allOrders = result.orders;
                renderOrders(allOrders);
            } else {
                alert("Failed to load orders: " + result.message);
            }
        } catch (error) {
            alert("Error loading orders.");
        } finally {
            loadBtn.disabled = false;
            loadBtn.textContent = 'Refresh Orders';
        }
    }

    function renderOrders(orders) {
        tableBody.innerHTML = '';
        if (orders.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="9" class="text-center text-muted">No orders found.</td></tr>';
            return;
        }

        orders.forEach(o => {
            const tr = document.createElement('tr');
            
            // Format options
            const paymentSelect = `
                <select class="form-select form-select-sm payment-select" data-row="${o._rowIndex}" style="width:140px; background:rgba(0,0,0,0.5)">
                    <option value="Payment Verification Pending" ${o['Payment Status']==='Payment Verification Pending'?'selected':''}>Verification Pending</option>
                    <option value="Verified" ${o['Payment Status']==='Verified'?'selected':''}>Verified</option>
                    <option value="Rejected" ${o['Payment Status']==='Rejected'?'selected':''}>Rejected</option>
                </select>
            `;
            
            const orderSelect = `
                <select class="form-select form-select-sm order-select" data-row="${o._rowIndex}" style="width:140px; background:rgba(0,0,0,0.5)">
                    <option value="Pending Payment" ${o['Order Status']==='Pending Payment'?'selected':''}>Pending Payment</option>
                    <option value="Awaiting Admin Verification" ${o['Order Status']==='Awaiting Admin Verification'?'selected':''}>Awaiting Verification</option>
                    <option value="Processing" ${o['Order Status']==='Processing'?'selected':''}>Processing</option>
                    <option value="Completed" ${o['Order Status']==='Completed'?'selected':''}>Completed</option>
                    <option value="Cancelled" ${o['Order Status']==='Cancelled'?'selected':''}>Cancelled</option>
                </select>
            `;

            tr.innerHTML = `
                <td><small>${o['Order ID']}</small><br><small class="text-muted">${new Date(o['Date']).toLocaleString()}</small></td>
                <td><small class="text-truncate d-inline-block" style="max-width: 150px;" title="${o['Service']}">${o['Service']}</small></td>
                <td><a href="${o['Target Link']}" target="_blank" class="text-info text-truncate d-inline-block" style="max-width: 100px;">Link</a></td>
                <td>${o['Quantity']}</td>
                <td class="text-primary fw-bold">${formatCurrency(o['Total Amount'])}</td>
                <td><small class="user-select-all">${o['UTR / Transaction ID'] || 'N/A'}</small></td>
                <td>${paymentSelect}</td>
                <td>${orderSelect}</td>
                <td>
                    <button class="btn btn-sm btn-outline-success update-btn" data-row="${o._rowIndex}">Update</button>
                </td>
            `;
            
            tableBody.appendChild(tr);
        });

        // Add event listeners to update buttons
        document.querySelectorAll('.update-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const row = e.target.getAttribute('data-row');
                
                // Find associated selects
                const pSelect = document.querySelector(`.payment-select[data-row="${row}"]`);
                const oSelect = document.querySelector(`.order-select[data-row="${row}"]`);
                
                const btnOriginal = e.target.innerHTML;
                e.target.innerHTML = '...';
                e.target.disabled = true;

                try {
                    const response = await fetch(CONFIG.GOOGLE_SCRIPT_URL, {
                        method: 'POST',
                        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                        redirect: 'follow',
                        body: JSON.stringify({ 
                            action: 'update_order_status',
                            rowIndex: parseInt(row),
                            paymentStatus: pSelect.value,
                            orderStatus: oSelect.value
                        })
                    });
                    const res = await response.json();
                    if(res.success) {
                        e.target.innerHTML = 'Saved';
                        e.target.classList.replace('btn-outline-success', 'btn-success');
                        setTimeout(() => {
                            e.target.innerHTML = 'Update';
                            e.target.classList.replace('btn-success', 'btn-outline-success');
                            e.target.disabled = false;
                        }, 2000);
                    } else {
                        alert("Failed: " + res.message);
                        e.target.innerHTML = 'Update';
                        e.target.disabled = false;
                    }
                } catch (err) {
                    alert("Error updating order");
                    e.target.innerHTML = 'Update';
                    e.target.disabled = false;
                }
            });
        });
    }
});
