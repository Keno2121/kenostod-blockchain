const rateLimit = require('express-rate-limit');
const { ethers } = require('ethers');

class SecurityMiddleware {
    constructor(db) {
        this.db = db;
        
        this.courseCompletionLimiter = rateLimit({
            windowMs: 60 * 60 * 1000,
            max: 10,
            message: { error: 'Too many course completions. Maximum 10 per hour. Please try again later.' },
            standardHeaders: true,
            legacyHeaders: false
        });

        this.scholarshipApplicationLimiter = rateLimit({
            windowMs: 60 * 60 * 1000,
            max: 10,
            message: { error: 'Maximum 10 scholarship applications per hour. Please wait a bit and try again.' },
            standardHeaders: true,
            legacyHeaders: false
        });

        this.jobApplicationLimiter = rateLimit({
            windowMs: 24 * 60 * 60 * 1000,
            max: 20,
            message: { error: 'Maximum 20 job applications per day. Please try again tomorrow.' },
            standardHeaders: true,
            legacyHeaders: false
        });

        this.referralLimiter = rateLimit({
            windowMs: 24 * 60 * 60 * 1000,
            max: 50,
            message: { error: 'Maximum 50 referrals per day. Please try again tomorrow.' },
            standardHeaders: true,
            legacyHeaders: false
        });

        this.generalApiLimiter = rateLimit({
            windowMs: 15 * 60 * 1000,
            max: 100,
            message: { error: 'Too many requests. Please try again later.' },
            standardHeaders: true,
            legacyHeaders: false
        });
    }

    verifyWalletSignature(req, res, next) {
        try {
            const { walletAddress, action, signature, timestamp } = req.body;

            if (!walletAddress || !action || !signature || !timestamp) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required authentication fields: walletAddress, action, signature, timestamp'
                });
            }

            const timestampNum = parseInt(timestamp);
            const currentTime = Date.now();
            const fiveMinutes = 5 * 60 * 1000;

            if (currentTime - timestampNum > fiveMinutes) {
                return res.status(401).json({
                    success: false,
                    error: 'Signature expired. Please sign again.'
                });
            }

            if (currentTime - timestampNum < -60000) {
                return res.status(401).json({
                    success: false,
                    error: 'Invalid timestamp. Please check your system clock.'
                });
            }

            try {
                const expectedMessage = this.generateAuthMessage(walletAddress, action, timestamp);
                
                const recoveredAddress = ethers.verifyMessage(expectedMessage, signature);
                
                if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
                    return res.status(401).json({
                        success: false,
                        error: 'Invalid signature. You do not own this wallet address.'
                    });
                }

                req.verifiedWallet = walletAddress;
                req.verifiedAction = action;
                next();
            } catch (signatureError) {
                console.error('Signature verification error:', signatureError.message);
                return res.status(401).json({
                    success: false,
                    error: 'Invalid signature format or wallet address.'
                });
            }
        } catch (error) {
            console.error('Authentication error:', error.message);
            return res.status(500).json({
                success: false,
                error: 'Authentication failed. Please try again.'
            });
        }
    }

    async checkDuplicateJobApplication(req, res, next) {
        try {
            const { applicant_wallet, job_id } = req.body;

            if (!applicant_wallet || !job_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields: applicant_wallet and job_id'
                });
            }

            const existingApplication = await this.db.query(`
                SELECT id FROM job_applications
                WHERE applicant_wallet = $1 AND job_id = $2
            `, [applicant_wallet, job_id]);

            if (existingApplication.rows.length > 0) {
                return res.status(400).json({
                    success: false,
                    error: 'You have already applied to this job. Duplicate applications are not allowed.'
                });
            }

            next();
        } catch (error) {
            console.error('Duplicate job application check error:', error.message);
            return res.status(500).json({
                success: false,
                error: 'Failed to check for duplicate applications.'
            });
        }
    }

    async trackCourseProgress(req, res, next) {
        try {
            const { walletAddress, courseId, quizScore, timeSpent, modulesCompleted } = req.body;

            if (!walletAddress || !courseId) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields: walletAddress and courseId'
                });
            }

            const validCourseIds = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21];
            const parsedCourseId = parseInt(courseId);

            if (!validCourseIds.includes(parsedCourseId)) {
                return res.status(400).json({
                    success: false,
                    error: `Invalid course ID: ${courseId}. Must be between 1-21.`
                });
            }

            const minTimeSpent = 300;
            const minQuizScore = 70;

            if (timeSpent && parseInt(timeSpent) < minTimeSpent) {
                return res.status(400).json({
                    success: false,
                    error: `Insufficient time spent on course. Minimum ${minTimeSpent} seconds required.`,
                    timeSpent: parseInt(timeSpent),
                    required: minTimeSpent
                });
            }

            if (quizScore !== undefined && parseInt(quizScore) < minQuizScore) {
                return res.status(400).json({
                    success: false,
                    error: `Quiz score too low. Minimum ${minQuizScore}% required to claim reward.`,
                    score: parseInt(quizScore),
                    required: minQuizScore
                });
            }

            await this.db.query(`
                INSERT INTO course_progress (
                    user_wallet_address,
                    course_id,
                    quiz_score,
                    time_spent_seconds,
                    modules_completed,
                    completion_verified,
                    verified_at
                ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
                ON CONFLICT (user_wallet_address, course_id) 
                DO UPDATE SET 
                    quiz_score = EXCLUDED.quiz_score,
                    time_spent_seconds = EXCLUDED.time_spent_seconds,
                    modules_completed = EXCLUDED.modules_completed,
                    completion_verified = EXCLUDED.completion_verified,
                    verified_at = NOW()
            `, [
                walletAddress,
                parsedCourseId,
                quizScore || null,
                timeSpent || null,
                modulesCompleted || null,
                true
            ]);

            req.courseProgressVerified = true;
            next();
        } catch (error) {
            console.error('Course progress tracking error:', error.message);
            return res.status(500).json({
                success: false,
                error: 'Failed to verify course completion. Please try again.'
            });
        }
    }

    generateAuthMessage(walletAddress, action, timestamp) {
        return `Kenostod Blockchain Academy\nAction: ${action}\nWallet: ${walletAddress}\nTimestamp: ${timestamp}`;
    }

    requireAdmin(req, res, next) {
        try {
            const adminKey = req.headers['x-admin-key'] || req.query.adminKey || req.body.adminKey;
            const adminWallets = process.env.ADMIN_WALLETS ? process.env.ADMIN_WALLETS.split(',').map(w => w.toLowerCase().trim()) : [];
            
            if (!adminKey && adminWallets.length === 0) {
                console.warn('⚠️  No admin authentication configured. Set ADMIN_KEY or ADMIN_WALLETS environment variable.');
                return res.status(503).json({
                    success: false,
                    error: 'Admin authentication not configured. Please contact system administrator.'
                });
            }

            if (process.env.ADMIN_KEY && adminKey === process.env.ADMIN_KEY) {
                req.isAdmin = true;
                return next();
            }

            const providedWallet = req.headers['x-admin-wallet'] || req.query.adminWallet || req.body.adminWallet;
            if (providedWallet && adminWallets.includes(providedWallet.toLowerCase())) {
                req.isAdmin = true;
                req.adminWallet = providedWallet;
                return next();
            }

            console.warn(`⚠️  Unauthorized admin access attempt from IP: ${req.ip}`);
            return res.status(403).json({
                success: false,
                error: 'Access denied. Admin privileges required.'
            });
        } catch (error) {
            console.error('Admin authentication error:', error.message);
            return res.status(500).json({
                success: false,
                error: 'Authentication failed.'
            });
        }
    }

    sanitizeText(text, maxLength = 500) {
        if (!text) return '';
        
        let sanitized = String(text).trim();
        
        sanitized = sanitized
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .replace(/\//g, '&#x2F;');
        
        if (sanitized.length > maxLength) {
            sanitized = sanitized.substring(0, maxLength);
        }
        
        return sanitized;
    }

    validateEmail(email) {
        if (!email) return true;
        const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        return emailRegex.test(email) && email.length <= 254;
    }

    validatePhoneNumber(phone) {
        if (!phone) return true;
        const phoneRegex = /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/;
        return phoneRegex.test(phone) && phone.length <= 20;
    }

    validateWalletAddress(address) {
        if (!address) return false;
        return /^0x[a-fA-F0-9]{40}$/.test(address);
    }

    validateStatus(status) {
        const validStatuses = ['pending', 'processing', 'shipped', 'delivered'];
        return validStatuses.includes(status);
    }

    getCourseCompletionGuards() {
        return [
            (req, res, next) => this.verifyWalletSignature(req, res, next),
            (req, res, next) => this.courseCompletionLimiter(req, res, next),
            (req, res, next) => this.trackCourseProgress(req, res, next)
        ];
    }

    getScholarshipGuards() {
        return [
            (req, res, next) => this.verifyWalletSignature(req, res, next),
            (req, res, next) => this.scholarshipApplicationLimiter(req, res, next)
        ];
    }

    getJobApplicationGuards() {
        return [
            (req, res, next) => this.verifyWalletSignature(req, res, next),
            (req, res, next) => this.jobApplicationLimiter(req, res, next),
            (req, res, next) => this.checkDuplicateJobApplication(req, res, next)
        ];
    }

    getReferralGuards() {
        return [
            (req, res, next) => this.verifyWalletSignature(req, res, next),
            (req, res, next) => this.referralLimiter(req, res, next)
        ];
    }

    getReadOnlyGuards() {
        return [
            (req, res, next) => this.generalApiLimiter(req, res, next)
        ];
    }
}

module.exports = SecurityMiddleware;
