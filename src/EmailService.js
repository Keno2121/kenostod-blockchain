const { promisify } = require('util');
const { execFile } = require('child_process');

const execFileAsync = promisify(execFile);

async function getAuthToken() {
    const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
    
    if (!hostname) {
        throw new Error('REPLIT_CONNECTORS_HOSTNAME environment variable not set');
    }

    try {
        const { stdout } = await execFileAsync(
            'replit',
            ['identity', 'create', '--audience', `https://${hostname}`],
            { encoding: 'utf8' }
        );

        const replitToken = stdout.trim();
        if (!replitToken) {
            throw new Error('Replit Identity Token not found');
        }

        return { authToken: `Bearer ${replitToken}`, hostname };
    } catch (error) {
        throw new Error(`Failed to get auth token: ${error.message}`);
    }
}

async function sendEmail({ to, cc, subject, text, html, attachments }) {
    if (!to) {
        throw new Error('Recipient email address (to) is required');
    }
    
    if (!subject) {
        throw new Error('Email subject is required');
    }
    
    if (!text && !html) {
        throw new Error('Email must have either text or html content');
    }

    try {
        const { hostname, authToken } = await getAuthToken();

        const response = await fetch(
            `https://${hostname}/api/v2/mailer/send`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Replit-Authentication': authToken,
                },
                body: JSON.stringify({
                    to,
                    cc,
                    subject,
                    text,
                    html,
                    attachments,
                }),
            }
        );

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to send email');
        }

        const result = await response.json();
        console.log(`📧 Email sent successfully to ${to}`);
        return result;
    } catch (error) {
        console.error('❌ Email sending failed:', error.message);
        throw error;
    }
}

function createShippedEmailTemplate(order) {
    const itemsList = order.items_requested.map(item => `- ${item.name} (Quantity: ${item.quantity})`).join('\n');
    
    const text = `
🎓 Congratulations ${order.graduate_name}!

Your Graduate Merchandise Has Shipped! 📦

Order Details:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Order ID: ${order.order_id}
Graduate ID: ${order.graduate_id || 'N/A'}
Tracking Number: ${order.tracking_number || 'Will be updated soon'}

Items Ordered:
${itemsList}

Shipping Address:
${order.graduate_name}
${order.shipping_address_line1}
${order.shipping_address_line2 ? order.shipping_address_line2 + '\n' : ''}${order.shipping_city}, ${order.shipping_state || ''} ${order.shipping_postal_code}
${order.shipping_country}

Your package is on its way! You'll receive another email when it's delivered.

Thank you for being part of the Kenostod Graduate Community!

Best regards,
Kenostod Academy Team
    `.trim();

    const html = `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .order-box { background: white; padding: 20px; margin: 20px 0; border-radius: 5px; border-left: 4px solid #667eea; }
        .items-list { background: white; padding: 15px; margin: 15px 0; border-radius: 5px; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 0.9em; }
        h1 { margin: 0; font-size: 28px; }
        h2 { color: #667eea; margin-top: 0; }
        .label { font-weight: bold; color: #555; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📦 Your Order Has Shipped!</h1>
        </div>
        <div class="content">
            <p>🎓 Congratulations <strong>${order.graduate_name}</strong>!</p>
            <p>Your graduate merchandise is on its way to you!</p>
            
            <div class="order-box">
                <h2>Order Details</h2>
                <p><span class="label">Order ID:</span> ${order.order_id}</p>
                <p><span class="label">Graduate ID:</span> ${order.graduate_id || 'N/A'}</p>
                <p><span class="label">Tracking Number:</span> ${order.tracking_number || 'Will be updated soon'}</p>
            </div>
            
            <div class="items-list">
                <h2>Items Ordered</h2>
                <ul>
                    ${order.items_requested.map(item => `<li>${item.name} (Quantity: ${item.quantity})</li>`).join('')}
                </ul>
            </div>
            
            <div class="order-box">
                <h2>Shipping Address</h2>
                <p>
                    ${order.graduate_name}<br>
                    ${order.shipping_address_line1}<br>
                    ${order.shipping_address_line2 ? order.shipping_address_line2 + '<br>' : ''}
                    ${order.shipping_city}, ${order.shipping_state || ''} ${order.shipping_postal_code}<br>
                    ${order.shipping_country}
                </p>
            </div>
            
            <p>You'll receive another email when your package is delivered!</p>
            
            <div class="footer">
                <p>Thank you for being part of the Kenostod Graduate Community!</p>
                <p><strong>Kenostod Academy Team</strong></p>
            </div>
        </div>
    </div>
</body>
</html>
    `.trim();

    return { text, html };
}

function createDeliveredEmailTemplate(order) {
    const itemsList = order.items_requested.map(item => `- ${item.name} (Quantity: ${item.quantity})`).join('\n');
    
    const text = `
🎉 Congratulations ${order.graduate_name}!

Your Graduate Merchandise Has Arrived! 🎉

Order Details:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Order ID: ${order.order_id}
Graduate ID: ${order.graduate_id || 'N/A'}
Tracking Number: ${order.tracking_number || 'N/A'}

Items Delivered:
${itemsList}

Congratulations on completing all 21 courses at Kenostod Academy! 
Your graduate merchandise symbolizes your achievement and dedication 
to breaking poverty cycles through blockchain education.

Wear your graduate items with pride - you've earned them!

We're honored to have you as part of our Graduate Community.

Best regards,
Kenostod Academy Team

P.S. Don't forget to share your achievement on LinkedIn and social media!
    `.trim();

    const html = `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .celebration-box { background: white; padding: 25px; margin: 20px 0; border-radius: 5px; border: 2px solid #f5576c; text-align: center; }
        .order-box { background: white; padding: 20px; margin: 20px 0; border-radius: 5px; border-left: 4px solid #f5576c; }
        .items-list { background: white; padding: 15px; margin: 15px 0; border-radius: 5px; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 0.9em; }
        h1 { margin: 0; font-size: 32px; }
        h2 { color: #f5576c; margin-top: 0; }
        .label { font-weight: bold; color: #555; }
        .celebrate { font-size: 48px; margin: 10px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎉 Package Delivered!</h1>
        </div>
        <div class="content">
            <div class="celebration-box">
                <div class="celebrate">🎓✨🎉</div>
                <h2>Congratulations ${order.graduate_name}!</h2>
                <p>Your graduate merchandise has been delivered!</p>
            </div>
            
            <div class="order-box">
                <h2>Order Details</h2>
                <p><span class="label">Order ID:</span> ${order.order_id}</p>
                <p><span class="label">Graduate ID:</span> ${order.graduate_id || 'N/A'}</p>
                <p><span class="label">Tracking Number:</span> ${order.tracking_number || 'N/A'}</p>
            </div>
            
            <div class="items-list">
                <h2>Items Delivered</h2>
                <ul>
                    ${order.items_requested.map(item => `<li>${item.name} (Quantity: ${item.quantity})</li>`).join('')}
                </ul>
            </div>
            
            <div class="celebration-box">
                <p><strong>Congratulations on completing all 21 courses!</strong></p>
                <p>Your graduate merchandise symbolizes your achievement and dedication to breaking poverty cycles through blockchain education.</p>
                <p><em>Wear your graduate items with pride - you've earned them!</em></p>
            </div>
            
            <div class="footer">
                <p>We're honored to have you as part of our Graduate Community!</p>
                <p><strong>Kenostod Academy Team</strong></p>
                <p style="margin-top: 15px; font-size: 0.85em;">P.S. Don't forget to share your achievement on LinkedIn and social media!</p>
            </div>
        </div>
    </div>
</body>
</html>
    `.trim();

    return { text, html };
}

async function sendOrderShippedEmail(order) {
    if (!order.user_email) {
        console.warn(`⚠️  No email address for order ${order.order_id}, skipping shipped notification`);
        return null;
    }

    try {
        const { text, html } = createShippedEmailTemplate(order);
        
        const result = await sendEmail({
            to: order.user_email,
            subject: 'Your Graduate Merchandise Has Shipped! 📦',
            text,
            html
        });

        console.log(`✅ Shipped notification sent to ${order.user_email} for order ${order.order_id}`);
        return result;
    } catch (error) {
        console.error(`❌ Failed to send shipped email for order ${order.order_id}:`, error.message);
        throw error;
    }
}

async function sendOrderDeliveredEmail(order) {
    if (!order.user_email) {
        console.warn(`⚠️  No email address for order ${order.order_id}, skipping delivered notification`);
        return null;
    }

    try {
        const { text, html } = createDeliveredEmailTemplate(order);
        
        const result = await sendEmail({
            to: order.user_email,
            subject: 'Your Graduate Merchandise Has Arrived! 🎉',
            text,
            html
        });

        console.log(`✅ Delivered notification sent to ${order.user_email} for order ${order.order_id}`);
        return result;
    } catch (error) {
        console.error(`❌ Failed to send delivered email for order ${order.order_id}:`, error.message);
        throw error;
    }
}

function createClaimNotificationTemplate(claimData) {
    const { email, walletAddress, amount, claimId } = claimData;
    
    const text = `
🚨 New KENO Claim Request

Claim ID: ${claimId}
Email: ${email}
Wallet: ${walletAddress}
Amount: ${amount} KENO

⚠️ Action Required: Please review and approve/reject this claim in the admin backoffice.

Kenostod Blockchain Academy
KENO Token: 0x65791E0B5Cbac5F40c76cDe31bf4F074D982FD0E
`;

    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a1a; color: #e0e0e0; padding: 20px; border-radius: 10px;">
            <h2 style="color: #00d4ff; margin-bottom: 20px;">🚨 New KENO Claim Request</h2>
            
            <div style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                <p style="margin: 8px 0;"><strong>Claim ID:</strong> ${claimId}</p>
                <p style="margin: 8px 0;"><strong>Email:</strong> ${email}</p>
                <p style="margin: 8px 0;"><strong>Wallet:</strong> <code style="background: rgba(0,0,0,0.3); padding: 2px 6px; border-radius: 4px;">${walletAddress}</code></p>
                <p style="margin: 8px 0;"><strong>Amount:</strong> <span style="color: #00ff88; font-size: 1.3em; font-weight: bold;">${amount} KENO</span></p>
            </div>
            
            <p style="color: #ffaa00; font-weight: bold;">⚠️ Action Required: Please review and approve/reject this claim in the admin backoffice.</p>
            
            <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid rgba(255,255,255,0.1); font-size: 0.9em; color: #888;">
                <p>Kenostod Blockchain Academy</p>
                <p>KENO Token: 0x65791E0B5Cbac5F40c76cDe31bf4F074D982FD0E</p>
            </div>
        </div>
    `;

    return { text, html };
}

async function sendClaimNotification(claimData, adminEmail) {
    try {
        const { text, html } = createClaimNotificationTemplate(claimData);
        
        const result = await sendEmail({
            to: adminEmail,
            subject: `🚨 New KENO Claim Request: ${claimData.amount} KENO`,
            text,
            html
        });

        console.log(`✅ Claim notification sent to ${adminEmail} for claim ${claimData.claimId}`);
        return result;
    } catch (error) {
        console.error(`❌ Failed to send claim notification:`, error.message);
        return null;
    }
}

function createCourseCompletionNotificationTemplate(data) {
    const { studentEmail, walletAddress, courseName, kenoEarned } = data;
    
    const text = `
📚 New Course Completion Request

Student Email: ${studentEmail || 'Not provided'}
Wallet: ${walletAddress}
Course: ${courseName}
KENO Earned: ${kenoEarned} KENO

✅ Course completion has been recorded. Student can now claim their KENO tokens.

Kenostod Blockchain Academy
`;

    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a1a; color: #e0e0e0; padding: 20px; border-radius: 10px;">
            <h2 style="color: #00d4ff; margin-bottom: 20px;">📚 New Course Completion</h2>
            
            <div style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                <p style="margin: 8px 0;"><strong>Student Email:</strong> ${studentEmail || 'Not provided'}</p>
                <p style="margin: 8px 0;"><strong>Wallet:</strong> <code style="background: rgba(0,0,0,0.3); padding: 2px 6px; border-radius: 4px;">${walletAddress}</code></p>
                <p style="margin: 8px 0;"><strong>Course:</strong> ${courseName}</p>
                <p style="margin: 8px 0;"><strong>KENO Earned:</strong> <span style="color: #00ff88; font-size: 1.3em; font-weight: bold;">${kenoEarned} KENO</span></p>
            </div>
            
            <p style="color: #00ff88;">✅ Course completion has been recorded. Student can now claim their KENO tokens.</p>
            
            <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid rgba(255,255,255,0.1); font-size: 0.9em; color: #888;">
                <p>Kenostod Blockchain Academy</p>
            </div>
        </div>
    `;

    return { text, html };
}

async function sendCourseCompletionNotification(data, adminEmail) {
    try {
        const { text, html } = createCourseCompletionNotificationTemplate(data);
        
        const result = await sendEmail({
            to: adminEmail,
            subject: `📚 New Course Completion: ${data.courseName}`,
            text,
            html
        });

        console.log(`✅ Course completion notification sent to ${adminEmail}`);
        return result;
    } catch (error) {
        console.error(`❌ Failed to send course completion notification:`, error.message);
        return null;
    }
}

module.exports = {
    sendEmail,
    sendOrderShippedEmail,
    sendOrderDeliveredEmail,
    createShippedEmailTemplate,
    createDeliveredEmailTemplate,
    sendClaimNotification,
    sendCourseCompletionNotification
};
