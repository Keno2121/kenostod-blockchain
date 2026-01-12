const PRINTFUL_ITEM_MAPPING = {
    't-shirt': { variant_id: 4011, name: 'Kenostod Graduate T-Shirt' },
    'hoodie': { variant_id: 4012, name: 'Kenostod Graduate Hoodie' },
    'hat': { variant_id: 4013, name: 'Kenostod Graduate Hat' },
    'mug': { variant_id: 4014, name: 'Kenostod Graduate Mug' },
    'sticker': { variant_id: 4015, name: 'Kenostod Graduate Sticker Pack' },
    'pin': { variant_id: 4016, name: 'Kenostod Graduate Pin' },
    'id-card': { variant_id: 4017, name: 'Kenostod Graduate ID Card' }
};

class PrintfulIntegration {
    constructor() {
        this.apiKey = process.env.PRINTFUL_API_KEY;
        this.baseUrl = 'https://api.printful.com';
    }

    isConfigured() {
        return !!this.apiKey;
    }

    async createPrintfulOrder(merchandiseOrder) {
        if (!this.isConfigured()) {
            throw new Error('PRINTFUL_API_KEY is not configured. Please set the environment variable.');
        }

        try {
            const printfulOrder = this.mapMerchandiseOrderToPrintful(merchandiseOrder);
            
            const response = await fetch(`${this.baseUrl}/orders`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(printfulOrder)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`Printful API error: ${errorData.error?.message || response.statusText}`);
            }

            const result = await response.json();
            
            console.log(`✅ Printful order created successfully: ${result.result.id}`);
            
            return {
                printfulOrderId: result.result.id,
                estimatedShippingDate: result.result.estimated_fulfillment || null,
                status: result.result.status,
                costs: result.result.costs
            };
        } catch (error) {
            console.error('❌ Printful order creation failed:', error.message);
            throw error;
        }
    }

    mapMerchandiseOrderToPrintful(order) {
        let itemsData = order.items_requested;
        if (typeof itemsData === 'string') {
            try {
                itemsData = JSON.parse(itemsData);
            } catch (e) {
                console.error('Failed to parse items_requested:', e);
                itemsData = [];
            }
        }
        
        const items = itemsData.map(item => {
            const itemKey = (item.itemType || item.name || 'unknown').toLowerCase().replace(/\s+/g, '-').replace(/_/g, '-');
            const printfulItem = PRINTFUL_ITEM_MAPPING[itemKey];
            
            if (!printfulItem) {
                console.warn(`⚠️  Unknown item type: ${itemKey}, using default variant`);
                return {
                    variant_id: 4011,
                    quantity: item.quantity || 1,
                    name: item.itemType || item.name || 'Unknown Item'
                };
            }

            return {
                variant_id: printfulItem.variant_id,
                quantity: item.quantity || 1,
                name: printfulItem.name
            };
        });

        const printfulOrder = {
            recipient: {
                name: order.graduate_name,
                address1: order.shipping_address_line1,
                address2: order.shipping_address_line2 || '',
                city: order.shipping_city,
                state_code: order.shipping_state || '',
                country_code: this.getCountryCode(order.shipping_country),
                zip: order.shipping_postal_code,
                phone: order.phone_number || '',
                email: order.user_email || ''
            },
            items: items,
            retail_costs: {
                currency: 'USD',
                subtotal: order.estimated_total_cost || 0,
                total: order.estimated_total_cost || 0
            },
            external_id: order.order_id,
            confirm: false
        };

        return printfulOrder;
    }

    getCountryCode(countryName) {
        const countryMap = {
            'United States': 'US',
            'USA': 'US',
            'Canada': 'CA',
            'United Kingdom': 'GB',
            'UK': 'GB',
            'Australia': 'AU',
            'Germany': 'DE',
            'France': 'FR',
            'Spain': 'ES',
            'Italy': 'IT',
            'Netherlands': 'NL',
            'Belgium': 'BE',
            'Sweden': 'SE',
            'Norway': 'NO',
            'Denmark': 'DK',
            'Finland': 'FI',
            'Poland': 'PL',
            'Czech Republic': 'CZ',
            'Austria': 'AT',
            'Switzerland': 'CH',
            'Ireland': 'IE',
            'Portugal': 'PT',
            'Greece': 'GR',
            'Japan': 'JP',
            'South Korea': 'KR',
            'Singapore': 'SG',
            'New Zealand': 'NZ',
            'Mexico': 'MX',
            'Brazil': 'BR',
            'Argentina': 'AR',
            'Chile': 'CL',
            'Colombia': 'CO',
            'South Africa': 'ZA',
            'India': 'IN',
            'China': 'CN'
        };

        return countryMap[countryName] || 'US';
    }

    async getOrderStatus(printfulOrderId) {
        if (!this.isConfigured()) {
            throw new Error('PRINTFUL_API_KEY is not configured');
        }

        try {
            const response = await fetch(`${this.baseUrl}/orders/${printfulOrderId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`Printful API error: ${errorData.error?.message || response.statusText}`);
            }

            const result = await response.json();
            
            return {
                orderId: result.result.id,
                status: result.result.status,
                trackingNumber: result.result.shipments?.[0]?.tracking_number || null,
                trackingUrl: result.result.shipments?.[0]?.tracking_url || null,
                shippedAt: result.result.shipments?.[0]?.shipped_at || null,
                estimatedDelivery: result.result.shipments?.[0]?.estimated_delivery || null
            };
        } catch (error) {
            console.error('❌ Failed to fetch Printful order status:', error.message);
            throw error;
        }
    }

    async confirmOrder(printfulOrderId) {
        if (!this.isConfigured()) {
            throw new Error('PRINTFUL_API_KEY is not configured');
        }

        try {
            const response = await fetch(`${this.baseUrl}/orders/${printfulOrderId}/confirm`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`Printful API error: ${errorData.error?.message || response.statusText}`);
            }

            const result = await response.json();
            console.log(`✅ Printful order ${printfulOrderId} confirmed`);
            
            return result.result;
        } catch (error) {
            console.error('❌ Failed to confirm Printful order:', error.message);
            throw error;
        }
    }
}

module.exports = PrintfulIntegration;
