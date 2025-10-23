const Transaction = require('./Transaction');

class ScheduledTransaction {
    constructor(fromAddress, toAddress, amount, fee, schedule) {
        this.id = this.generateId();
        this.fromAddress = fromAddress;
        this.toAddress = toAddress;
        this.amount = amount;
        this.fee = fee;
        this.schedule = {
            type: schedule.type,
            startTime: schedule.startTime || Date.now(),
            interval: schedule.interval || null,
            maxOccurrences: schedule.maxOccurrences || 1,
            endTime: schedule.endTime || null
        };
        this.executionCount = 0;
        this.status = 'active';
        this.createdAt = Date.now();
        this.lastExecuted = null;
        this.signature = null;
    }

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substring(2);
    }

    shouldExecute() {
        if (this.status !== 'active') return false;
        
        const now = Date.now();
        
        if (now < this.schedule.startTime) return false;
        
        if (this.schedule.endTime && now > this.schedule.endTime) {
            this.status = 'expired';
            return false;
        }
        
        if (this.executionCount >= this.schedule.maxOccurrences) {
            this.status = 'completed';
            return false;
        }
        
        if (this.schedule.type === 'once') {
            return this.executionCount === 0;
        }
        
        if (this.schedule.type === 'recurring') {
            if (!this.lastExecuted) return true;
            
            const timeSinceLastExecution = now - this.lastExecuted;
            return timeSinceLastExecution >= this.schedule.interval;
        }
        
        return false;
    }

    createTransaction() {
        const tx = new Transaction(this.fromAddress, this.toAddress, this.amount, this.fee);
        tx.timestamp = Date.now();
        return tx;
    }

    markExecuted() {
        this.executionCount++;
        this.lastExecuted = Date.now();
        
        if (this.executionCount >= this.schedule.maxOccurrences) {
            this.status = 'completed';
        }
    }

    cancel() {
        this.status = 'cancelled';
    }

    getNextExecutionTime() {
        if (this.status !== 'active') return null;
        
        const now = Date.now();
        
        if (now < this.schedule.startTime) {
            return this.schedule.startTime;
        }
        
        if (this.schedule.type === 'once') {
            return this.executionCount === 0 ? this.schedule.startTime : null;
        }
        
        if (this.schedule.type === 'recurring') {
            if (!this.lastExecuted) return now;
            return this.lastExecuted + this.schedule.interval;
        }
        
        return null;
    }

    toJSON() {
        return {
            id: this.id,
            fromAddress: this.fromAddress,
            toAddress: this.toAddress,
            amount: this.amount,
            fee: this.fee,
            schedule: this.schedule,
            executionCount: this.executionCount,
            status: this.status,
            createdAt: this.createdAt,
            lastExecuted: this.lastExecuted,
            nextExecution: this.getNextExecutionTime()
        };
    }
}

module.exports = ScheduledTransaction;
