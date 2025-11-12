const rateLimit = require('express-rate-limit');
const { ethers } = require('ethers');

class SecurityMiddleware {
    constructor(db) {
        this.db = db;
        
        this.courseCompletionLimiter = rateLimit({
            windowMs: 60 * 60 * 1000,
            max: 10,
            message: 'Too many course completions. Maximum 10 per hour. Please try again later.',
            standardHeaders: true,
            legacyHeaders: false
        });

        this.scholarshipApplicationLimiter = rateLimit({
            windowMs: 24 * 60 * 60 * 1000,
            max: 3,
            message: 'Maximum 3 scholarship applications per day. Please try again tomorrow.',
            standardHeaders: true,
            legacyHeaders: false
        });

        this.jobApplicationLimiter = rateLimit({
            windowMs: 24 * 60 * 60 * 1000,
            max: 20,
            message: 'Maximum 20 job applications per day. Please try again tomorrow.',
            standardHeaders: true,
            legacyHeaders: false
        });

        this.referralLimiter = rateLimit({
            windowMs: 24 * 60 * 60 * 1000,
            max: 50,
            message: 'Maximum 50 referrals per day. Please try again tomorrow.',
            standardHeaders: true,
            legacyHeaders: false
        });

        this.generalApiLimiter = rateLimit({
            windowMs: 15 * 60 * 1000,
            max: 100,
            message: 'Too many requests. Please try again later.',
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
