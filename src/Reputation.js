const SHA256 = require('crypto-js/sha256');

class Rating {
    constructor(fromAddress, toAddress, score, comment, transactionHash) {
        this.id = SHA256(fromAddress + toAddress + Date.now()).toString().substring(0, 16);
        this.fromAddress = fromAddress;
        this.toAddress = toAddress;
        this.score = score;
        this.comment = comment || '';
        this.transactionHash = transactionHash;
        this.timestamp = Date.now();
    }
}

class ReputationSystem {
    constructor() {
        this.ratings = [];
        this.reputationScores = new Map();
        this.transactionRatings = new Map();
    }

    addRating(fromAddress, toAddress, score, comment, transactionHash) {
        if (score < 1 || score > 5) {
            throw new Error('Rating score must be between 1 and 5');
        }

        if (fromAddress === toAddress) {
            throw new Error('Cannot rate yourself');
        }

        if (transactionHash && this.transactionRatings.has(transactionHash)) {
            throw new Error('This transaction has already been rated');
        }

        const rating = new Rating(fromAddress, toAddress, score, comment, transactionHash);
        this.ratings.push(rating);
        
        if (transactionHash) {
            this.transactionRatings.set(transactionHash, rating);
        }

        this.updateReputationScore(toAddress);

        console.log(`New rating: ${fromAddress.substring(0, 10)}... rated ${toAddress.substring(0, 10)}... with ${score} stars`);
        return rating;
    }

    updateReputationScore(address) {
        const receivedRatings = this.ratings.filter(r => r.toAddress === address);
        
        if (receivedRatings.length === 0) {
            this.reputationScores.set(address, {
                address,
                averageScore: 0,
                totalRatings: 0,
                breakdown: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
            });
            return;
        }

        const totalScore = receivedRatings.reduce((sum, r) => sum + r.score, 0);
        const averageScore = totalScore / receivedRatings.length;

        const breakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
        receivedRatings.forEach(r => {
            breakdown[r.score]++;
        });

        this.reputationScores.set(address, {
            address,
            averageScore: Math.round(averageScore * 100) / 100,
            totalRatings: receivedRatings.length,
            breakdown
        });
    }

    getReputationScore(address) {
        if (!this.reputationScores.has(address)) {
            this.updateReputationScore(address);
        }
        return this.reputationScores.get(address);
    }

    getRatingsForAddress(address) {
        return this.ratings
            .filter(r => r.toAddress === address || r.fromAddress === address)
            .map(r => ({
                id: r.id,
                from: r.fromAddress === address ? 'You' : r.fromAddress.substring(0, 20) + '...',
                to: r.toAddress === address ? 'You' : r.toAddress.substring(0, 20) + '...',
                score: r.score,
                comment: r.comment,
                timestamp: r.timestamp,
                transactionHash: r.transactionHash
            }));
    }

    getTopRatedAddresses(limit = 10) {
        const addresses = Array.from(this.reputationScores.values())
            .filter(rep => rep.totalRatings >= 3)
            .sort((a, b) => {
                if (b.averageScore === a.averageScore) {
                    return b.totalRatings - a.totalRatings;
                }
                return b.averageScore - a.averageScore;
            })
            .slice(0, limit);

        return addresses.map(rep => ({
            address: rep.address.substring(0, 30) + '...',
            fullAddress: rep.address,
            averageScore: rep.averageScore,
            totalRatings: rep.totalRatings
        }));
    }

    getTrustScore(address) {
        const rep = this.getReputationScore(address);
        
        if (rep.totalRatings === 0) return 'Unrated';
        if (rep.averageScore >= 4.5) return 'Excellent';
        if (rep.averageScore >= 4.0) return 'Very Good';
        if (rep.averageScore >= 3.5) return 'Good';
        if (rep.averageScore >= 3.0) return 'Fair';
        if (rep.averageScore >= 2.0) return 'Below Average';
        return 'Poor';
    }
}

module.exports = { ReputationSystem, Rating };
