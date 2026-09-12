export interface IUpdateProfilePayload {
    name?: string;
    image?: string;
    address?: string;
    location?: string;
}

export interface IRequestPhonePayload {
    phone: string;
}

export interface IVerifyPhonePayload {
    phone: string;
    code: string;
}