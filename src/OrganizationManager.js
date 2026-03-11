const crypto = require('crypto');

class OrganizationManager {
    constructor(dbConnection) {
        this.db = dbConnection;
    }

    async createOrganization(data) {
        const { name, ownerEmail, ownerWalletAddress, companyType = 'corporate', totalSeats = 10, monthlyPrice = 200 } = data;

        try {
            const result = await this.db.query(
                `INSERT INTO organizations (name, owner_email, owner_wallet_address, company_type, total_seats, monthly_price)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 RETURNING *`,
                [name, ownerEmail, ownerWalletAddress, companyType, totalSeats, monthlyPrice]
            );

            const organization = result.rows[0];

            await this.db.query(
                `INSERT INTO organization_members (organization_id, user_email, user_wallet_address, role, invite_status, joined_at)
                 VALUES ($1, $2, $3, 'owner', 'accepted', CURRENT_TIMESTAMP)`,
                [organization.id, ownerEmail, ownerWalletAddress]
            );

            await this.updateSeatUsage(organization.id);

            console.log(`✅ Organization created: ${name} (ID: ${organization.id})`);
            return organization;
        } catch (error) {
            console.error('❌ Error creating organization:', error.message);
            throw error;
        }
    }

    async getOrganization(organizationId) {
        try {
            const result = await this.db.query(
                'SELECT * FROM organizations WHERE id = $1',
                [organizationId]
            );
            return result.rows[0] || null;
        } catch (error) {
            console.error('❌ Error fetching organization:', error.message);
            throw error;
        }
    }

    async getOrganizationByOwnerEmail(email) {
        try {
            const result = await this.db.query(
                'SELECT * FROM organizations WHERE owner_email = $1',
                [email]
            );
            return result.rows;
        } catch (error) {
            console.error('❌ Error fetching organization by owner email:', error.message);
            throw error;
        }
    }

    async inviteMember(organizationId, userEmail, role = 'member') {
        try {
            const org = await this.getOrganization(organizationId);
            if (!org) {
                throw new Error('Organization not found');
            }

            if (org.used_seats >= org.total_seats) {
                throw new Error('No available seats. Please upgrade your plan.');
            }

            const result = await this.db.query(
                `INSERT INTO organization_members (organization_id, user_email, role, invite_status)
                 VALUES ($1, $2, $3, 'pending')
                 RETURNING *`,
                [organizationId, userEmail, role]
            );

            console.log(`✅ Member invited: ${userEmail} to organization ${organizationId}`);
            return result.rows[0];
        } catch (error) {
            if (error.code === '23505') {
                throw new Error('User already invited to this organization');
            }
            console.error('❌ Error inviting member:', error.message);
            throw error;
        }
    }

    async acceptInvite(memberId, walletAddress) {
        try {
            const result = await this.db.query(
                `UPDATE organization_members 
                 SET invite_status = 'accepted', 
                     user_wallet_address = $1, 
                     joined_at = CURRENT_TIMESTAMP
                 WHERE id = $2
                 RETURNING *`,
                [walletAddress, memberId]
            );

            if (result.rows.length > 0) {
                await this.updateSeatUsage(result.rows[0].organization_id);
                console.log(`✅ Invite accepted by member ${memberId}`);
            }

            return result.rows[0] || null;
        } catch (error) {
            console.error('❌ Error accepting invite:', error.message);
            throw error;
        }
    }

    async getOrganizationMembers(organizationId) {
        try {
            const result = await this.db.query(
                `SELECT * FROM organization_members 
                 WHERE organization_id = $1 
                 ORDER BY 
                    CASE role 
                        WHEN 'owner' THEN 1 
                        WHEN 'admin' THEN 2 
                        ELSE 3 
                    END, 
                    joined_at ASC`,
                [organizationId]
            );
            return result.rows;
        } catch (error) {
            console.error('❌ Error fetching organization members:', error.message);
            throw error;
        }
    }

    async removeMember(organizationId, memberId) {
        try {
            const member = await this.db.query(
                'SELECT role FROM organization_members WHERE id = $1 AND organization_id = $2',
                [memberId, organizationId]
            );

            if (member.rows.length === 0) {
                throw new Error('Member not found');
            }

            if (member.rows[0].role === 'owner') {
                throw new Error('Cannot remove organization owner');
            }

            await this.db.query(
                'DELETE FROM organization_members WHERE id = $1 AND organization_id = $2',
                [memberId, organizationId]
            );

            await this.updateSeatUsage(organizationId);

            console.log(`✅ Member ${memberId} removed from organization ${organizationId}`);
            return true;
        } catch (error) {
            console.error('❌ Error removing member:', error.message);
            throw error;
        }
    }

    async updateSeatUsage(organizationId) {
        try {
            const result = await this.db.query(
                `SELECT COUNT(*) as active_members 
                 FROM organization_members 
                 WHERE organization_id = $1 AND invite_status = 'accepted'`,
                [organizationId]
            );

            const activeMembersCount = parseInt(result.rows[0].active_members);

            await this.db.query(
                'UPDATE organizations SET used_seats = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
                [activeMembersCount, organizationId]
            );

            await this.db.query(
                'INSERT INTO seat_usage_history (organization_id, seats_used) VALUES ($1, $2)',
                [organizationId, activeMembersCount]
            );

            return activeMembersCount;
        } catch (error) {
            console.error('❌ Error updating seat usage:', error.message);
            throw error;
        }
    }

    async updateLearningProgress(data) {
        const { organizationId, memberId, walletAddress, courseName, completionPercentage, timeSpentMinutes, quizScore } = data;

        try {
            const result = await this.db.query(
                `INSERT INTO learning_progress 
                    (organization_id, member_id, user_wallet_address, course_name, completion_percentage, time_spent_minutes, quiz_score, last_accessed)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
                 ON CONFLICT (member_id, course_name) 
                 DO UPDATE SET 
                    completion_percentage = $5,
                    time_spent_minutes = learning_progress.time_spent_minutes + $6,
                    quiz_score = COALESCE($7, learning_progress.quiz_score),
                    last_accessed = CURRENT_TIMESTAMP,
                    completed_at = CASE WHEN $5 >= 100 THEN CURRENT_TIMESTAMP ELSE learning_progress.completed_at END
                 RETURNING *`,
                [organizationId, memberId, walletAddress, courseName, completionPercentage, timeSpentMinutes, quizScore]
            );

            return result.rows[0];
        } catch (error) {
            console.error('❌ Error updating learning progress:', error.message);
            throw error;
        }
    }

    async getTeamProgress(organizationId) {
        try {
            const result = await this.db.query(
                `SELECT 
                    om.id as member_id,
                    om.user_email,
                    om.role,
                    om.joined_at,
                    om.last_active,
                    COUNT(DISTINCT lp.course_name) as courses_started,
                    COUNT(DISTINCT CASE WHEN lp.completion_percentage >= 100 THEN lp.course_name END) as courses_completed,
                    COALESCE(AVG(lp.completion_percentage), 0) as avg_completion,
                    COALESCE(SUM(lp.time_spent_minutes), 0) as total_time_spent
                 FROM organization_members om
                 LEFT JOIN learning_progress lp ON om.id = lp.member_id
                 WHERE om.organization_id = $1 AND om.invite_status = 'accepted'
                 GROUP BY om.id
                 ORDER BY total_time_spent DESC`,
                [organizationId]
            );

            return result.rows;
        } catch (error) {
            console.error('❌ Error fetching team progress:', error.message);
            throw error;
        }
    }

    async getMemberProgress(memberId) {
        try {
            const result = await this.db.query(
                `SELECT * FROM learning_progress 
                 WHERE member_id = $1 
                 ORDER BY last_accessed DESC`,
                [memberId]
            );
            return result.rows;
        } catch (error) {
            console.error('❌ Error fetching member progress:', error.message);
            throw error;
        }
    }

    async updateStripeInfo(organizationId, stripeCustomerId, stripeSubscriptionId) {
        try {
            await this.db.query(
                `UPDATE organizations 
                 SET stripe_customer_id = $1, stripe_subscription_id = $2, updated_at = CURRENT_TIMESTAMP
                 WHERE id = $3`,
                [stripeCustomerId, stripeSubscriptionId, organizationId]
            );

            console.log(`✅ Stripe info updated for organization ${organizationId}`);
            return true;
        } catch (error) {
            console.error('❌ Error updating Stripe info:', error.message);
            throw error;
        }
    }

    async updateSubscriptionStatus(organizationId, status) {
        try {
            await this.db.query(
                'UPDATE organizations SET subscription_status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
                [status, organizationId]
            );

            console.log(`✅ Subscription status updated to '${status}' for organization ${organizationId}`);
            return true;
        } catch (error) {
            console.error('❌ Error updating subscription status:', error.message);
            throw error;
        }
    }

    async calculateBulkDiscount(totalSeats) {
        let basePrice = 200;
        let pricePerSeat = basePrice / 10;

        if (totalSeats >= 100) {
            pricePerSeat = pricePerSeat * 0.70;
        } else if (totalSeats >= 50) {
            pricePerSeat = pricePerSeat * 0.80;
        } else if (totalSeats >= 20) {
            pricePerSeat = pricePerSeat * 0.90;
        }

        return {
            totalSeats,
            pricePerSeat: Math.round(pricePerSeat * 100) / 100,
            monthlyTotal: Math.round(totalSeats * pricePerSeat * 100) / 100,
            discount: totalSeats >= 20 ? `${Math.round((1 - (pricePerSeat / 20)) * 100)}%` : 'None'
        };
    }

    async getAllOrganizations() {
        try {
            const result = await this.db.query(
                'SELECT * FROM organizations ORDER BY created_at DESC'
            );
            return result.rows;
        } catch (error) {
            console.error('❌ Error fetching all organizations:', error.message);
            throw error;
        }
    }
}

module.exports = OrganizationManager;
