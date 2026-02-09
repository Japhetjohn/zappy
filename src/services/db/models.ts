import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
    telegramId: number;
    username?: string;
    createdAt: Date;
}

const UserSchema: Schema = new Schema({
    telegramId: { type: Number, required: true, unique: true },
    username: { type: String },
    createdAt: { type: Date, default: Date.now },
});

export interface IBeneficiary extends Document {
    userId: number;
    holderName: string;
    bankCode: string;
    accountNumber: string;
    bankName: string;
    walletAddress?: string;
    createdAt: Date;
}

const BeneficiarySchema: Schema = new Schema({
    userId: { type: Number, required: true, index: true },
    holderName: { type: String, required: true },
    bankCode: { type: String, required: true },
    accountNumber: { type: String, required: true },
    bankName: { type: String, required: true },
    walletAddress: { type: String },
    createdAt: { type: Date, default: Date.now },
});

export interface ITransaction extends Document {
    userId: number;
    reference: string;
    type: string;
    asset: string;
    amount: number;
    status: string;
    createdAt: Date;
    updatedAt: Date;
}

const TransactionSchema: Schema = new Schema({
    userId: { type: Number, required: true, index: true },
    reference: { type: String, required: true, unique: true },
    type: { type: String, required: true },
    asset: { type: String, required: true },
    amount: { type: Number, required: true },
    status: { type: String, required: true, default: 'PENDING' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
}, { timestamps: true });

export const User = mongoose.model<IUser>('User', UserSchema);
export const Beneficiary = mongoose.model<IBeneficiary>('Beneficiary', BeneficiarySchema);
export const Transaction = mongoose.model<ITransaction>('Transaction', TransactionSchema);
