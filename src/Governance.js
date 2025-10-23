class Governance {
    constructor() {
        this.proposals = new Map();
        this.proposalCounter = 0;
        this.votingPeriod = 7 * 24 * 60 * 60 * 1000;
        this.minimumParticipation = 0.10;
        this.approvalThreshold = 0.60;
    }

    createProposal(proposerAddress, title, description, parameterName, newValue) {
        const validParameters = ['miningReward', 'difficulty', 'minimumFee'];
        
        if (!validParameters.includes(parameterName)) {
            throw new Error(`Invalid parameter. Must be one of: ${validParameters.join(', ')}`);
        }

        if (typeof newValue !== 'number' || newValue < 0) {
            throw new Error('New value must be a non-negative number');
        }

        if (parameterName === 'difficulty' && (newValue < 1 || newValue > 10)) {
            throw new Error('Difficulty must be between 1 and 10');
        }

        if (parameterName === 'miningReward' && newValue > 1000) {
            throw new Error('Mining reward cannot exceed 1000 KENO');
        }

        if (parameterName === 'minimumFee' && newValue > 10) {
            throw new Error('Minimum fee cannot exceed 10 KENO');
        }

        this.proposalCounter++;
        const proposalId = `PROP-${this.proposalCounter}`;

        const proposal = {
            id: proposalId,
            proposer: proposerAddress,
            title,
            description,
            parameterName,
            currentValue: null,
            newValue,
            createdAt: Date.now(),
            expiresAt: Date.now() + this.votingPeriod,
            status: 'active',
            votes: new Map(),
            totalVotingPower: 0,
            yesVotingPower: 0,
            noVotingPower: 0
        };

        this.proposals.set(proposalId, proposal);

        console.log(`Governance proposal created: ${proposalId} - ${title}`);
        return proposal;
    }

    castVote(proposalId, voterAddress, vote, votingPower) {
        const proposal = this.proposals.get(proposalId);
        
        if (!proposal) {
            throw new Error('Proposal not found');
        }

        if (proposal.status !== 'active') {
            throw new Error(`Proposal is ${proposal.status} and cannot accept votes`);
        }

        if (Date.now() > proposal.expiresAt) {
            throw new Error('Voting period has ended');
        }

        if (vote !== 'yes' && vote !== 'no') {
            throw new Error('Vote must be "yes" or "no"');
        }

        if (votingPower <= 0) {
            throw new Error('Voter has no KENO tokens (voting power is 0)');
        }

        if (proposal.votes.has(voterAddress)) {
            const previousVote = proposal.votes.get(voterAddress);
            if (previousVote.vote === 'yes') {
                proposal.yesVotingPower -= previousVote.votingPower;
            } else {
                proposal.noVotingPower -= previousVote.votingPower;
            }
            proposal.totalVotingPower -= previousVote.votingPower;
        }

        proposal.votes.set(voterAddress, {
            vote,
            votingPower,
            timestamp: Date.now()
        });

        proposal.totalVotingPower += votingPower;
        if (vote === 'yes') {
            proposal.yesVotingPower += votingPower;
        } else {
            proposal.noVotingPower += votingPower;
        }

        console.log(`Vote cast on ${proposalId}: ${vote} with ${votingPower} voting power`);
        return proposal;
    }

    checkProposalStatus(proposalId, totalSupply) {
        const proposal = this.proposals.get(proposalId);
        
        if (!proposal || proposal.status !== 'active') {
            return proposal;
        }

        if (Date.now() > proposal.expiresAt) {
            const participationRate = proposal.totalVotingPower / totalSupply;
            const approvalRate = proposal.yesVotingPower / proposal.totalVotingPower;

            if (participationRate >= this.minimumParticipation && approvalRate >= this.approvalThreshold) {
                proposal.status = 'approved';
                console.log(`Proposal ${proposalId} APPROVED (${(approvalRate * 100).toFixed(1)}% yes, ${(participationRate * 100).toFixed(1)}% participation)`);
            } else {
                proposal.status = 'rejected';
                const reason = participationRate < this.minimumParticipation 
                    ? 'insufficient participation' 
                    : 'insufficient approval';
                console.log(`Proposal ${proposalId} REJECTED (${reason})`);
            }
        }

        return proposal;
    }

    getAllProposals() {
        return Array.from(this.proposals.values()).sort((a, b) => b.createdAt - a.createdAt);
    }

    getProposal(proposalId) {
        return this.proposals.get(proposalId);
    }

    getActiveProposals() {
        return Array.from(this.proposals.values())
            .filter(p => p.status === 'active')
            .sort((a, b) => a.expiresAt - b.expiresAt);
    }

    getApprovedProposals() {
        return Array.from(this.proposals.values())
            .filter(p => p.status === 'approved' && !p.executed);
    }

    markProposalExecuted(proposalId) {
        const proposal = this.proposals.get(proposalId);
        if (proposal) {
            proposal.executed = true;
            proposal.executedAt = Date.now();
        }
        return proposal;
    }

    getProposalStats(proposalId) {
        const proposal = this.proposals.get(proposalId);
        if (!proposal) {
            return null;
        }

        return {
            id: proposal.id,
            title: proposal.title,
            status: proposal.status,
            totalVotes: proposal.votes.size,
            yesVotes: Array.from(proposal.votes.values()).filter(v => v.vote === 'yes').length,
            noVotes: Array.from(proposal.votes.values()).filter(v => v.vote === 'no').length,
            yesVotingPower: proposal.yesVotingPower,
            noVotingPower: proposal.noVotingPower,
            totalVotingPower: proposal.totalVotingPower,
            timeRemaining: Math.max(0, proposal.expiresAt - Date.now())
        };
    }
}

module.exports = Governance;
