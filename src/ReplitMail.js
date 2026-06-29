const { promisify } = require('node:util');
const { execFile } = require('node:child_process');

class ReplitMail {
    constructor() {
        this.hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
    }

    async getAuthToken() {
        const hostname = this.hostname;
        if (!hostname) {
            throw new Error('REPLIT_CONNECTORS_HOSTNAME not set');
        }

        const execFileAsync = promisify(execFile);
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
    }

    async sendEmail({ subject, text, html }) {
        try {
            const { hostname, authToken } = await this.getAuthToken();

            const response = await fetch(`https://${hostname}/api/v2/mailer/send`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Replit-Authentication': authToken,
                },
                body: JSON.stringify({
                    subject,
                    text,
                    html,
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to send email');
            }

            const result = await response.json();
            console.log(`📧 Email sent: ${subject}`);
            return { success: true, ...result };
        } catch (error) {
            console.error('📧 Email error:', error.message);
            return { success: false, error: error.message };
        }
    }

    async sendClaimNotification(claimData) {
        const { email, walletAddress, amount, claimId } = claimData;
        
        const subject = `🚨 New KENO Claim Request: ${amount} KENO`;
        
        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a1a; color: #e0e0e0; padding: 20px; border-radius: 10px;">
                <h2 style="color: #00d4ff; margin-bottom: 20px;">New KENO Claim Request</h2>
                
                <div style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                    <p><strong>Claim ID:</strong> ${claimId}</p>
                    <p><strong>Email:</strong> ${email}</p>
                    <p><strong>Wallet:</strong> ${walletAddress}</p>
                    <p><strong>Amount:</strong> <span style="color: #00ff88; font-size: 1.2em;">${amount} KENO</span></p>
                </div>
                
                <p style="color: #ffaa00;">⚠️ Action Required: Please review and approve/reject this claim in the admin panel.</p>
                
                <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid rgba(255,255,255,0.1); font-size: 0.9em; color: #888;">
                    <p>Kenostod Blockchain Academy</p>
                    <p>KENO Token: 0x65791E0B5Cbac5F40c76cDe31bf4F074D982FD0E</p>
                </div>
            </div>
        `;

        const text = `New KENO Claim Request\n\nClaim ID: ${claimId}\nEmail: ${email}\nWallet: ${walletAddress}\nAmount: ${amount} KENO\n\nPlease review and approve/reject this claim in the admin panel.`;

        return this.sendEmail({ subject, text, html });
    }

    async sendCourseCompletionNotification(data) {
        const { studentEmail, walletAddress, courseName, kenoEarned } = data;
        
        const subject = `📚 New Course Completion: ${courseName}`;
        
        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a1a; color: #e0e0e0; padding: 20px; border-radius: 10px;">
                <h2 style="color: #00d4ff; margin-bottom: 20px;">New Course Completion</h2>
                
                <div style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                    <p><strong>Student Email:</strong> ${studentEmail || 'Not provided'}</p>
                    <p><strong>Wallet:</strong> ${walletAddress}</p>
                    <p><strong>Course:</strong> ${courseName}</p>
                    <p><strong>KENO Earned:</strong> <span style="color: #00ff88; font-size: 1.2em;">${kenoEarned} KENO</span></p>
                </div>
                
                <p style="color: #00ff88;">✅ Course completion has been recorded. Student can now claim their KENO tokens.</p>
                
                <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid rgba(255,255,255,0.1); font-size: 0.9em; color: #888;">
                    <p>Kenostod Blockchain Academy</p>
                </div>
            </div>
        `;

        const text = `New Course Completion\n\nStudent: ${studentEmail || walletAddress}\nCourse: ${courseName}\nKENO Earned: ${kenoEarned}\n\nCourse completion has been recorded.`;

        return this.sendEmail({ subject, text, html });
    }
}

module.exports = ReplitMail;
