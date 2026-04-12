const crypto = require('crypto');
const { crossedMilestone, milestoneBonus, signatureTag } = require('./Ramanujan');
const { isFibonacci, nextFibMilestone } = require('./GoldenRatio');

class WealthBuilderManager {
    constructor(db, bscTokenTransfer = null) {
        this.db = db;
        this.bscTokenTransfer = bscTokenTransfer;
    }

    setBscTokenTransfer(bscTokenTransfer) {
        this.bscTokenTransfer = bscTokenTransfer;
    }

    async awardCourseCompletion(walletAddress, email, courseName, courseId) {
        const rewardAmount = 250.0;
        
        try {
            // Validate wallet address
            if (!walletAddress || !walletAddress.startsWith('0x') || walletAddress.length !== 42) {
                return { 
                    success: false, 
                    error: 'Invalid wallet address. Must be a valid BSC/ETH address starting with 0x.' 
                };
            }
            
            // Normalize wallet address to lowercase for consistent comparisons
            const normalizedWallet = walletAddress.toLowerCase();
            
            // SECURITY: Reject KENO contract address as wallet (common user mistake)
            const KENO_CONTRACT = '0x65791e0b5cbac5f40c76cde31bf4f074d982fd0e';
            if (normalizedWallet === KENO_CONTRACT) {
                return { 
                    success: false, 
                    error: 'This is the KENO token contract address, not a personal wallet. Please use your MetaMask wallet address (shown at the top of MetaMask app) instead.' 
                };
            }
            
            const validCourseIds = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21];
            const parsedCourseId = parseInt(courseId);
            
            if (!validCourseIds.includes(parsedCourseId)) {
                return { 
                    success: false, 
                    error: `Invalid course ID: ${courseId}. Must be between 1-21.` 
                };
            }

            // Case-insensitive duplicate check to prevent multiple rewards for same course
            const existingCompletion = await this.db.query(`
                SELECT id FROM student_rewards 
                WHERE LOWER(user_wallet_address) = $1 
                AND reward_type = 'course_completion' 
                AND course_id = $2
            `, [normalizedWallet, parsedCourseId]);

            if (existingCompletion.rows.length > 0) {
                return { 
                    success: false, 
                    error: `Course ${courseId} already completed. Cannot claim reward twice.`,
                    courseId: parsedCourseId 
                };
            }

            // Attempt real on-chain BSC transfer if available
            let bscTransferResult = null;
            // Always set status='available' - the claim system will track actual distribution
            let transferStatus = 'available';
            
            if (this.bscTokenTransfer && this.bscTokenTransfer.initialized) {
                console.log(`🔄 Attempting BSC transfer of ${rewardAmount} KENO to ${walletAddress}...`);
                bscTransferResult = await this.bscTokenTransfer.transferTokens(walletAddress, rewardAmount, `course-${parsedCourseId}`);
                
                if (bscTransferResult.success) {
                    console.log(`✅ BSC transfer successful! TX: ${bscTransferResult.txHash}`);
                } else {
                    console.log(`⚠️ BSC transfer failed: ${bscTransferResult.error}. Reward available for claim.`);
                }
            } else {
                console.log(`⚠️ BSC Token Transfer not available. Reward available for user to claim.`);
            }

            const result = await this.db.query(`
                INSERT INTO student_rewards (
                    user_wallet_address, 
                    user_email, 
                    reward_type, 
                    reward_amount, 
                    course_name, 
                    course_id,
                    description, 
                    status
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING *
            `, [
                normalizedWallet,  // Store normalized (lowercase) wallet for consistency
                email || '',
                'course_completion',
                rewardAmount,
                courseName,
                parsedCourseId,
                `Completed course: ${courseName}`,
                transferStatus
            ]);

            await this.checkRVTEligibility(normalizedWallet, email);
            
            const response = {
                success: true,
                reward: result.rows[0],
                message: `🎉 Congratulations! You earned ${rewardAmount} KENO for completing ${courseName}!`
            };
            
            if (bscTransferResult && bscTransferResult.success) {
                response.onChainTransfer = {
                    success: true,
                    txHash: bscTransferResult.txHash,
                    message: 'KENO tokens sent to your wallet on BSC!'
                };
            } else if (bscTransferResult) {
                response.onChainTransfer = {
                    success: false,
                    error: bscTransferResult.error,
                    message: 'Reward recorded. Tokens will be sent when distribution wallet has sufficient balance.'
                };
            }
            
            return response;
        } catch (error) {
            console.error('❌ Error awarding course completion:', error.message);
            return { success: false, error: error.message };
        }
    }

    async checkRVTEligibility(walletAddress, email) {
        try {
            // Use lowercase comparison for consistency with normalized wallet storage
            const normalizedWallet = walletAddress.toLowerCase();
            const result = await this.db.query(`
                SELECT COUNT(*) as courses_completed
                FROM student_rewards
                WHERE LOWER(user_wallet_address) = $1 AND reward_type = 'course_completion'
            `, [normalizedWallet]);

            const coursesCompleted = parseInt(result.rows[0].courses_completed);

            if (coursesCompleted === 5) {
                await this.distributeRVTNFT(normalizedWallet, email, 'Bronze RVT', 0.25, 'Completed 5 courses');
            } else if (coursesCompleted === 10) {
                await this.distributeRVTNFT(normalizedWallet, email, 'Silver RVT', 0.50, 'Completed 10 courses');
            } else if (coursesCompleted === 16) {
                await this.distributeRVTNFT(normalizedWallet, email, 'Gold RVT', 1.00, 'Completed all 16 blockchain courses');
            } else if (coursesCompleted === 21) {
                await this.distributeRVTNFT(normalizedWallet, email, 'Platinum RVT', 2.00, 'Completed all 21 courses (blockchain + financial literacy)');
            }

            return coursesCompleted;
        } catch (error) {
            console.error('❌ Error checking RVT eligibility:', error.message);
            return 0;
        }
    }

    async distributeRVTNFT(walletAddress, email, nftType, royaltyPercentage, reason) {
        try {
            const nftId = `RVT-${crypto.randomBytes(16).toString('hex')}`;
            
            const metadata = {
                type: nftType,
                royalty_rate: royaltyPercentage,
                issued_date: new Date().toISOString(),
                reason: reason
            };

            const result = await this.db.query(`
                INSERT INTO rvt_nft_distributions (
                    nft_id,
                    recipient_wallet,
                    recipient_email,
                    nft_type,
                    royalty_percentage,
                    reason,
                    metadata
                ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING *
            `, [
                nftId,
                walletAddress,
                email,
                nftType,
                royaltyPercentage,
                reason,
                JSON.stringify(metadata)
            ]);

            return {
                success: true,
                nft: result.rows[0],
                message: `🏆 Congratulations! You earned a ${nftType} NFT with ${royaltyPercentage}% perpetual royalties!`
            };
        } catch (error) {
            console.error('❌ Error distributing RVT NFT:', error.message);
            return { success: false, error: error.message };
        }
    }

    async applyForScholarship(applicationData) {
        try {
            const result = await this.db.query(`
                INSERT INTO scholarship_applications (
                    applicant_name,
                    applicant_email,
                    country,
                    age,
                    current_income_usd,
                    education_level,
                    motivation_statement,
                    financial_need_statement,
                    career_goals
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                RETURNING *
            `, [
                applicationData.name,
                applicationData.email,
                applicationData.country,
                applicationData.age,
                applicationData.currentIncome,
                applicationData.educationLevel,
                applicationData.motivation,
                applicationData.financialNeed,
                applicationData.careerGoals
            ]);

            return {
                success: true,
                application: result.rows[0],
                message: '✅ Scholarship application submitted successfully! We will review within 7 days.'
            };
        } catch (error) {
            console.error('❌ Error submitting scholarship application:', error.message);
            return { success: false, error: error.message };
        }
    }

    async reviewScholarshipApplication(applicationId, status, reviewerName, notes) {
        try {
            const updateField = status === 'approved' ? 'approved_at' : 'rejected_at';
            
            const result = await this.db.query(`
                UPDATE scholarship_applications
                SET application_status = $1,
                    reviewed_by = $2,
                    review_notes = $3,
                    ${updateField} = CURRENT_TIMESTAMP
                WHERE id = $4
                RETURNING *
            `, [status, reviewerName, notes, applicationId]);

            // If approved, grant scholarship access
            if (status === 'approved' && result.rows[0]) {
                const application = result.rows[0];
                // Note: wallet address stored separately, grant access by email for now
                await this.grantScholarshipAccess(
                    application.applicant_email,
                    null, // wallet address will be retrieved separately when needed
                    applicationId
                );
                console.log(`✅ Scholarship access granted to ${application.applicant_email}`);
            }

            return {
                success: true,
                application: result.rows[0],
                message: `Application ${status}${status === 'approved' ? ' - Full course access granted!' : ''}`
            };
        } catch (error) {
            console.error('❌ Error reviewing scholarship:', error.message);
            return { success: false, error: error.message };
        }
    }

    async grantScholarshipAccess(email, walletAddress, applicationId) {
        try {
            // Create scholarship_grants table entry
            await this.db.query(`
                CREATE TABLE IF NOT EXISTS scholarship_grants (
                    id SERIAL PRIMARY KEY,
                    applicant_email VARCHAR(255) NOT NULL,
                    applicant_wallet_address VARCHAR(255),
                    application_id INTEGER REFERENCES scholarship_applications(id),
                    access_level VARCHAR(50) DEFAULT 'full',
                    courses_unlocked INTEGER DEFAULT 21,
                    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '2 years'),
                    is_active BOOLEAN DEFAULT true
                )
            `);

            // Insert scholarship grant
            await this.db.query(`
                INSERT INTO scholarship_grants (applicant_email, applicant_wallet_address, application_id)
                VALUES ($1, $2, $3)
                ON CONFLICT DO NOTHING
            `, [email, walletAddress, applicationId]);

            return { success: true };
        } catch (error) {
            console.error('Error granting scholarship access:', error.message);
            return { success: false, error: error.message };
        }
    }

    async checkScholarshipAccess(emailOrWallet) {
        try {
            const result = await this.db.query(`
                SELECT * FROM scholarship_grants 
                WHERE (applicant_email = $1 OR applicant_wallet_address = $1)
                AND is_active = true
                AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
            `, [emailOrWallet]);

            return {
                hasAccess: result.rows.length > 0,
                grant: result.rows[0] || null
            };
        } catch (error) {
            // Table might not exist yet
            return { hasAccess: false, grant: null };
        }
    }

    async createJobListing(jobData) {
        try {
            const jobId = `JOB-${crypto.randomBytes(8).toString('hex')}`;
            
            const result = await this.db.query(`
                INSERT INTO job_listings (
                    job_id,
                    company_name,
                    job_title,
                    job_type,
                    location,
                    remote_allowed,
                    salary_min,
                    salary_max,
                    salary_currency,
                    description,
                    requirements,
                    apply_url,
                    apply_email,
                    posted_by,
                    expires_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
                RETURNING *
            `, [
                jobId,
                jobData.companyName,
                jobData.jobTitle,
                jobData.jobType,
                jobData.location,
                jobData.remoteAllowed,
                jobData.salaryMin,
                jobData.salaryMax,
                jobData.salaryCurrency || 'USD',
                jobData.description,
                jobData.requirements,
                jobData.applyUrl,
                jobData.applyEmail,
                jobData.postedBy,
                jobData.expiresAt
            ]);

            return {
                success: true,
                job: result.rows[0],
                message: 'Job posted successfully!'
            };
        } catch (error) {
            console.error('❌ Error creating job listing:', error.message);
            return { success: false, error: error.message };
        }
    }

    async getActiveJobs() {
        try {
            const result = await this.db.query(`
                SELECT * FROM job_listings
                WHERE status = 'active' AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
                ORDER BY created_at DESC
            `);

            return {
                success: true,
                jobs: result.rows
            };
        } catch (error) {
            console.error('❌ Error fetching jobs:', error.message);
            return { success: false, error: error.message };
        }
    }

    async applyForJob(applicationData) {
        try {
            const result = await this.db.query(`
                INSERT INTO job_applications (
                    job_id,
                    applicant_wallet,
                    applicant_email,
                    applicant_name,
                    resume_url,
                    cover_letter,
                    portfolio_url
                ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING *
            `, [
                applicationData.jobId,
                applicationData.walletAddress,
                applicationData.email,
                applicationData.name,
                applicationData.resumeUrl,
                applicationData.coverLetter,
                applicationData.portfolioUrl
            ]);

            return {
                success: true,
                application: result.rows[0],
                message: '✅ Job application submitted successfully!'
            };
        } catch (error) {
            console.error('❌ Error submitting job application:', error.message);
            return { success: false, error: error.message };
        }
    }

    async generateReferralCode(walletAddress, email) {
        try {
            const referralCode = crypto.randomBytes(4).toString('hex').toUpperCase();
            
            const result = await this.db.query(`
                INSERT INTO referrals (
                    referrer_wallet,
                    referrer_email,
                    referred_email,
                    referral_code,
                    reward_amount
                ) VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (referral_code) DO NOTHING
                RETURNING *
            `, [
                walletAddress,
                email,
                '',
                referralCode,
                100.0
            ]);

            if (result.rows.length === 0) {
                return this.generateReferralCode(walletAddress, email);
            }

            return {
                success: true,
                referralCode: referralCode,
                message: 'Referral code generated!'
            };
        } catch (error) {
            console.error('❌ Error generating referral code:', error.message);
            return { success: false, error: error.message };
        }
    }

    async processReferral(referralCode, newUserEmail) {
        try {
            const result = await this.db.query(`
                UPDATE referrals
                SET referred_email = $1,
                    referred_joined = true
                WHERE referral_code = $2 AND referred_email = ''
                RETURNING *
            `, [newUserEmail, referralCode]);

            if (result.rows.length > 0) {
                return {
                    success: true,
                    referral: result.rows[0],
                    message: 'Referral processed! Referrer will earn 100 KENO once you complete your first course.'
                };
            } else {
                return {
                    success: false,
                    error: 'Invalid or already used referral code'
                };
            }
        } catch (error) {
            console.error('❌ Error processing referral:', error.message);
            return { success: false, error: error.message };
        }
    }

    async completeReferralReward(referralCode) {
        try {
            const result = await this.db.query(`
                UPDATE referrals
                SET referred_completed_course = true,
                    reward_claimed = true,
                    claimed_at = CURRENT_TIMESTAMP
                WHERE referral_code = $1
                RETURNING *
            `, [referralCode]);

            if (result.rows.length > 0) {
                const referral = result.rows[0];
                
                await this.db.query(`
                    INSERT INTO student_rewards (
                        user_wallet_address,
                        user_email,
                        reward_type,
                        reward_amount,
                        description,
                        status
                    ) VALUES ($1, $2, $3, $4, $5, $6)
                `, [
                    referral.referrer_wallet,
                    referral.referrer_email,
                    'referral',
                    referral.reward_amount,
                    `Referral reward for bringing ${referral.referred_email}`,
                    'available'
                ]);

                return {
                    success: true,
                    message: 'Referral reward processed!'
                };
            }

            return { success: false, error: 'Referral not found' };
        } catch (error) {
            console.error('❌ Error completing referral reward:', error.message);
            return { success: false, error: error.message };
        }
    }

    async calculateWealthSnapshot(walletAddress, email, icoPurchases = [], falProfits = 0) {
        try {
            const normalizedWallet = walletAddress.toLowerCase();
            
            const rewardsResult = await this.db.query(`
                SELECT COALESCE(SUM(reward_amount), 0) as total_rewards
                FROM student_rewards
                WHERE LOWER(user_wallet_address) = $1 AND (status = 'available' OR status = 'claimed')
            `, [normalizedWallet]);

            const rvtResult = await this.db.query(`
                SELECT COALESCE(SUM(total_royalties_earned), 0) as total_rvt_royalties,
                       COUNT(*) as rvt_count
                FROM rvt_nft_distributions
                WHERE LOWER(recipient_wallet) = $1
            `, [normalizedWallet]);

            const referralResult = await this.db.query(`
                SELECT COALESCE(SUM(reward_amount), 0) as total_referrals
                FROM referrals
                WHERE LOWER(referrer_wallet) = $1 AND reward_claimed = true
            `, [normalizedWallet]);

            const coursesResult = await this.db.query(`
                SELECT COUNT(DISTINCT course_name) as courses_completed
                FROM student_rewards
                WHERE LOWER(user_wallet_address) = $1 AND reward_type = 'course_completion'
            `, [normalizedWallet]);

            const totalRewards = parseFloat(rewardsResult.rows[0].total_rewards);
            const totalRvtRoyalties = parseFloat(rvtResult.rows[0].total_rvt_royalties);
            const totalReferrals = parseFloat(referralResult.rows[0].total_referrals);
            const coursesCompleted = parseInt(coursesResult.rows[0].courses_completed);
            
            const icoPurchaseTokens = icoPurchases
                .filter(p => p.walletAddress && p.walletAddress.toLowerCase() === walletAddress.toLowerCase())
                .reduce((sum, p) => sum + (p.tokens || 0), 0);

            const rawTotalKeno = totalRewards + totalRvtRoyalties + totalReferrals + icoPurchaseTokens + falProfits;

            // Ramanujan: silent 1729 milestone bonus — the self-taught genius gift
            // When a participant crosses 1729 KENO total, the system quietly adds
            // a bonus. They see a number higher than expected. They won't know why.
            const rBonus = milestoneBonus(rawTotalKeno);
            const totalKeno = parseFloat((rawTotalKeno + rBonus).toFixed(6));
            const _rTag = signatureTag(rawTotalKeno);   // _R1729 appears in data at milestone

            // Golden Ratio: next Fibonacci milestone above current total
            const _nextFib = nextFibMilestone(totalKeno);

            const estimatedUSD = totalKeno * 1.00;

            await this.db.query(`
                INSERT INTO wealth_snapshots (
                    user_wallet,
                    user_email,
                    total_keno_balance,
                    total_rewards_earned,
                    total_rvt_royalties,
                    total_referral_earnings,
                    courses_completed,
                    estimated_net_worth_usd
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `, [
                walletAddress,
                email,
                totalKeno,
                totalRewards,
                totalRvtRoyalties,
                totalReferrals,
                coursesCompleted,
                estimatedUSD
            ]);

            return {
                success: true,
                wealth: {
                    totalKeno,
                    totalRewards,
                    totalRvtRoyalties,
                    totalReferrals,
                    icoPurchases: icoPurchaseTokens,
                    falProfits,
                    coursesCompleted,
                    estimatedUSD,
                    rvtNFTs: parseInt(rvtResult.rows[0].rvt_count),
                    _nextMilestone: _nextFib,
                    _sig: _rTag || undefined   // _R1729 tag visible at milestone, silent otherwise
                }
            };
        } catch (error) {
            console.error('❌ Error calculating wealth snapshot:', error.message);
            return { success: false, error: error.message };
        }
    }

    async getScholarshipApplications(status = null) {
        try {
            let query = 'SELECT * FROM scholarship_applications';
            let params = [];
            
            if (status) {
                query += ' WHERE application_status = $1';
                params.push(status);
            }
            
            query += ' ORDER BY created_at DESC';
            
            const result = await this.db.query(query, params);

            return {
                success: true,
                applications: result.rows
            };
        } catch (error) {
            console.error('❌ Error fetching scholarships:', error.message);
            return { success: false, error: error.message };
        }
    }

    async getUserRewards(walletAddress) {
        try {
            const result = await this.db.query(`
                SELECT * FROM student_rewards
                WHERE user_wallet_address = $1
                ORDER BY created_at DESC
            `, [walletAddress]);

            return {
                success: true,
                rewards: result.rows
            };
        } catch (error) {
            console.error('❌ Error fetching user rewards:', error.message);
            return { success: false, error: error.message };
        }
    }

    async getUserRVTNFTs(walletAddress) {
        try {
            const result = await this.db.query(`
                SELECT * FROM rvt_nft_distributions
                WHERE recipient_wallet = $1
                ORDER BY distributed_at DESC
            `, [walletAddress]);

            return {
                success: true,
                nfts: result.rows
            };
        } catch (error) {
            console.error('❌ Error fetching RVT NFTs:', error.message);
            return { success: false, error: error.message };
        }
    }

    async awardScholarshipCourseCompletion(walletAddress, email, courseName, courseId) {
        const rewardAmount = 250.0;

        try {
            if (!walletAddress || !walletAddress.startsWith('0x') || walletAddress.length !== 42) {
                return { success: false, error: 'Invalid wallet address.' };
            }

            const normalizedWallet = walletAddress.toLowerCase();
            const parsedCourseId = parseInt(courseId);

            if (parsedCourseId < 1 || parsedCourseId > 21) {
                return { success: false, error: `Invalid course ID: ${courseId}. Must be between 1-21.` };
            }

            const existingCompletion = await this.db.query(`
                SELECT id FROM student_rewards
                WHERE LOWER(user_wallet_address) = $1
                AND reward_type = 'course_completion'
                AND course_id = $2
            `, [normalizedWallet, parsedCourseId]);

            if (existingCompletion.rows.length > 0) {
                return {
                    success: false,
                    error: `Course ${courseId} already completed.`,
                    courseId: parsedCourseId
                };
            }

            const result = await this.db.query(`
                INSERT INTO student_rewards (
                    user_wallet_address,
                    user_email,
                    reward_type,
                    reward_amount,
                    course_name,
                    course_id,
                    description,
                    status
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING *
            `, [
                normalizedWallet,
                email || '',
                'course_completion',
                rewardAmount,
                courseName,
                parsedCourseId,
                `Scholarship: Completed course: ${courseName} (locked until graduation)`,
                'locked_scholarship'
            ]);

            const coursesResult = await this.db.query(`
                SELECT COUNT(*) as count FROM student_rewards
                WHERE LOWER(user_wallet_address) = $1
                AND reward_type = 'course_completion'
                AND status = 'locked_scholarship'
            `, [normalizedWallet]);

            const totalLocked = parseInt(coursesResult.rows[0].count) * rewardAmount;

            return {
                success: true,
                reward: result.rows[0],
                locked: true,
                totalLockedKeno: totalLocked,
                message: `✅ ${courseName} complete! ${rewardAmount} KENO earned and locked. Unlocks at graduation.`
            };
        } catch (error) {
            console.error('❌ Error awarding scholarship course completion:', error.message);
            return { success: false, error: error.message };
        }
    }

    async triggerScholarshipGraduation(walletAddress, email, adminKey) {
        try {
            if (adminKey !== process.env.ADMIN_PASSWORD) {
                return { success: false, error: 'Unauthorized. Admin key required.' };
            }

            const normalizedWallet = walletAddress.toLowerCase();

            const lockedResult = await this.db.query(`
                SELECT COUNT(*) as courses_completed, COALESCE(SUM(reward_amount), 0) as total_keno
                FROM student_rewards
                WHERE LOWER(user_wallet_address) = $1
                AND reward_type = 'course_completion'
                AND status = 'locked_scholarship'
            `, [normalizedWallet]);

            const coursesCompleted = parseInt(lockedResult.rows[0].courses_completed);
            const totalKeno = parseFloat(lockedResult.rows[0].total_keno);

            if (coursesCompleted < 21) {
                return {
                    success: false,
                    error: `Student has only completed ${coursesCompleted}/21 courses. Cannot graduate yet.`,
                    coursesCompleted,
                    coursesRemaining: 21 - coursesCompleted
                };
            }

            await this.db.query(`
                UPDATE student_rewards
                SET status = 'available',
                    description = REPLACE(description, '(locked until graduation)', '(unlocked - GRADUATED)')
                WHERE LOWER(user_wallet_address) = $1
                AND reward_type = 'course_completion'
                AND status = 'locked_scholarship'
            `, [normalizedWallet]);

            const crypto = require('crypto');
            const completionDate = new Date();
            const dateStr = completionDate.toISOString().slice(0, 10).replace(/-/g, '');
            const addressHash = walletAddress.slice(-4).toUpperCase();
            const graduateId = `KG-${dateStr}-${addressHash}`;
            const certHash = crypto
                .createHash('sha256')
                .update(`${normalizedWallet}${dateStr}${coursesCompleted}`)
                .digest('hex');

            const existingGrad = await this.db.query(`
                SELECT graduate_id FROM kenostod_graduates WHERE LOWER(wallet_address) = $1
            `, [normalizedWallet]);

            let finalGraduateId = graduateId;

            if (existingGrad.rows.length === 0) {
                await this.db.query(`
                    INSERT INTO kenostod_graduates
                    (graduate_id, wallet_address, user_email, completion_date, total_courses, keno_earned, rvt_nft_tier, certificate_hash)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                `, [
                    graduateId,
                    normalizedWallet,
                    email || '',
                    completionDate,
                    21,
                    Math.round(totalKeno),
                    'Platinum',
                    certHash
                ]);
            } else {
                finalGraduateId = existingGrad.rows[0].graduate_id;
            }

            await this.distributeRVTNFT(normalizedWallet, email, 'Platinum RVT', 2.00, 'Scholarship Graduate — completed all 21 courses');

            console.log(`🎓 Scholarship Graduate! ${finalGraduateId} — ${totalKeno} KENO unlocked for ${walletAddress.slice(0, 8)}...`);

            return {
                success: true,
                graduateId: finalGraduateId,
                walletAddress,
                kenoUnlocked: totalKeno,
                coursesCompleted,
                cardActivationPending: true,
                message: `🎓 Graduation complete! ${totalKeno} KENO unlocked. KUTL Card activation pending via card partner.`
            };
        } catch (error) {
            console.error('❌ Error triggering scholarship graduation:', error.message);
            return { success: false, error: error.message };
        }
    }

    async getScholarshipProgress(walletAddress) {
        try {
            const normalizedWallet = walletAddress.toLowerCase();

            const result = await this.db.query(`
                SELECT
                    COUNT(*) as courses_completed,
                    COALESCE(SUM(reward_amount), 0) as keno_locked,
                    MAX(created_at) as last_activity
                FROM student_rewards
                WHERE LOWER(user_wallet_address) = $1
                AND reward_type = 'course_completion'
                AND status = 'locked_scholarship'
            `, [normalizedWallet]);

            const coursesCompleted = parseInt(result.rows[0].courses_completed);
            const kenoLocked = parseFloat(result.rows[0].keno_locked);

            const graduated = await this.db.query(`
                SELECT graduate_id FROM kenostod_graduates WHERE LOWER(wallet_address) = $1
            `, [normalizedWallet]);

            return {
                success: true,
                walletAddress,
                coursesCompleted,
                coursesRemaining: Math.max(0, 21 - coursesCompleted),
                kenoLocked,
                kenoAtGraduation: 21 * 250,
                isGraduated: graduated.rows.length > 0,
                graduateId: graduated.rows[0]?.graduate_id || null,
                readyToGraduate: coursesCompleted >= 21 && graduated.rows.length === 0,
                lastActivity: result.rows[0].last_activity
            };
        } catch (error) {
            console.error('❌ Error fetching scholarship progress:', error.message);
            return { success: false, error: error.message };
        }
    }
}

module.exports = WealthBuilderManager;
