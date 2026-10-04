document.addEventListener('DOMContentLoaded', () => {
    const categorySelect = document.getElementById('category');
    const serviceSelect = document.getElementById('service');
    const quantityInput = document.getElementById('quantity');
    const targetLinkInput = document.getElementById('targetLink');
    const serviceDetailsBox = document.getElementById('service-details');
    const amountDisplay = document.getElementById('amount-display');
    const orderForm = document.getElementById('order-form');
    const submitBtn = document.getElementById('submit-btn');

    let currentService = null;

    function populateServicesForCategory(category, selectedServiceId = null) {
        const filteredServices = smmServices.filter(s => s.category === category);
        
        serviceSelect.innerHTML = '<option value="" disabled selected>Select Service</option>';
        filteredServices.forEach(s => {
            const option = document.createElement('option');
            option.value = s.id;
            // Only showing final price to customer
            option.textContent = `ID: ${s.id} - ${s.name} - ${formatCurrency(s.price)}`;
            if (selectedServiceId && String(s.id) === String(selectedServiceId)) {
                option.selected = true;
            }
            serviceSelect.appendChild(option);
        });
        serviceSelect.disabled = false;
        
        if (selectedServiceId) {
            currentService = getServiceById(selectedServiceId);
        } else {
            currentService = null;
        }
        updateDetailsAndPrice();
    }

    // Populate categories
    if (categorySelect) {
        const categories = getAllCategories();
        categorySelect.innerHTML = '<option value="" disabled selected>Select Category</option>';
        categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat;
            option.textContent = cat;
            categorySelect.appendChild(option);
        });

        categorySelect.addEventListener('change', (e) => {
            populateServicesForCategory(e.target.value);
        });

        // Check if service ID was provided in URL query string
        const urlParams = new URLSearchParams(window.location.search);
        const serviceParam = urlParams.get('service');
        if (serviceParam) {
            const preselected = getServiceById(serviceParam);
            if (preselected) {
                categorySelect.value = preselected.category;
                populateServicesForCategory(preselected.category, preselected.id);
            }
        }
    }

    if (serviceSelect) {
        serviceSelect.addEventListener('change', (e) => {
            currentService = getServiceById(e.target.value);
            updateDetailsAndPrice();
        });
    }

    if (quantityInput) {
        quantityInput.addEventListener('input', updateDetailsAndPrice);
    }

    function updateDetailsAndPrice() {
        if (!currentService) {
            serviceDetailsBox.innerHTML = '<p class="text-muted text-center mb-0">Select a service to see details</p>';
            amountDisplay.textContent = formatCurrency(0);
            return;
        }

        // Show details
        serviceDetailsBox.innerHTML = `
            <div class="row text-sm">
                <div class="col-6 mb-2"><strong>Min/Max:</strong> ${currentService.min} / ${currentService.max}</div>
                <div class="col-6 mb-2"><strong>Speed:</strong> ${currentService.speed}</div>
                <div class="col-6 mb-2"><strong>Start Time:</strong> ${currentService.startTime}</div>
                <div class="col-6 mb-2"><strong>Refill:</strong> ${currentService.refill}</div>
                <div class="col-12 mt-2 pt-2 border-top border-secondary">
                    <strong>Price per 1000 units:</strong> <span class="text-primary">${formatCurrency(currentService.price)}</span>
                </div>
            </div>
        `;

        // Calculate total amount (Assuming SMM standard: price is per 1000 units)
        const qty = parseInt(quantityInput.value) || 0;
        let total = 0;
        if (qty > 0) {
            total = (currentService.price / 1000) * qty;
        }
        amountDisplay.textContent = formatCurrency(total);
    }

    if (orderForm) {
        orderForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            if (!currentService) {
                alert("Please select a service.");
                return;
            }

            const qty = parseInt(quantityInput.value);
            if (qty < currentService.min || qty > currentService.max) {
                alert(`Quantity must be between ${currentService.min} and ${currentService.max}.`);
                return;
            }

            const targetLink = targetLinkInput.value.trim();
            if (!targetLink) {
                alert("Please enter a valid target link.");
                return;
            }

            const totalAmount = parseFloat(((currentService.price / 1000) * qty).toFixed(2));
            
            // Generate unique Order ID (KW-YYYYMMDD-RANDOM)
            const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
            const randomId = Math.floor(10000 + Math.random() * 90000);
            const orderId = `KW-${dateStr}-${randomId}`;

            const orderData = {
                action: 'create_order',
                orderId: orderId,
                customerName: document.getElementById('customerName')?.value || "",
                customerEmail: document.getElementById('customerEmail')?.value || "",
                category: currentService.category,
                serviceId: currentService.id,
                service: currentService.name,
                link: targetLink,
                quantity: qty,
                price: currentService.price, // Storing final unit price
                totalAmount: totalAmount
            };

            // Disable button and show spinner
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="loader" style="width: 1rem; height: 1rem; border-width: 2px;"></span> Processing...';

            try {
                const response = await fetch(CONFIG.GOOGLE_SCRIPT_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                    redirect: 'follow',
                    body: JSON.stringify(orderData)
                });
                const textResponse = await response.text();
                let result;
                try {
                    result = JSON.parse(textResponse);
                } catch (e) {
                    // Fallback if the Google Script returns "Success" or follows redirect to doGet HTML
                    if (textResponse.trim() === "Success" || textResponse.includes("doGet") || textResponse.includes("ppConfig") || textResponse.includes("<!DOCTYPE html>")) {
                        result = { success: true, orderId: orderId, message: "Order created successfully" };
                    } else {
                        throw new Error("Invalid response from server: " + textResponse);
                    }
                }
                
                if (result.success) {
                    // Save to local storage for payment page
                    localStorage.setItem('pendingOrder', JSON.stringify(orderData));
                    // Redirect to payment page
                    window.location.href = 'payment.html';
                } else {
                    alert("Error: " + (result.message || "Failed to create order"));
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Place Order';
                }
            } catch (error) {
                alert("Unable to connect to order server. Please check your config URL and try again. Error: " + error);
                submitBtn.disabled = false;
                submitBtn.textContent = 'Place Order';
            }
        });
    }
});
