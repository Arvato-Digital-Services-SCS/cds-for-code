import Encryption from "./Encryption";
import { Utilities } from "../Utilities";

/**
 * @type represents an item that can be secured.
 */
export type Securable = Buffer | string;

/**
 * Represents the type of output to use when decrypting a secure value.
 * @export SecureOutput
 * @enum {number} representing a Buffer or String
 */
export enum SecureOutput {
    Buffer,
    String
}

/**
 * Represents an type that can perform symetric encryption/decryption.
 * @export ICryptography
 * @interface ICryptography
 */
export interface ICryptography {
    encrypt(value: Securable): ISecureItem;
    decrypt(value: ISecureItem): Securable;
}

/**
 * Represents an item that has been encrypted and can be decrypted by it's correspodnign 
 * private key (or private key store)
 *
 * @export
 * @interface ISecureItem
 */
export interface ISecureItem {
    readonly buffer: { iv: Buffer; data: Buffer; };
    readonly string: { iv: string; data: string; };
    
    decrypt(decryptStore:ICryptography): Securable;
}

/**
 * Represents a set of credentials that can be encrypted and decrypted.
 *
 * @export
 * @interface ICredential
 */
export interface ICredential {
    /**
     * Represents a public key that can be used to refer to this credential when in the credential store.
     * @type {string}
     * @memberof ICredential
     */
    readonly key?:string;

    username:Securable | ISecureItem;
    password:Securable | ISecureItem;

    readonly isSecure:boolean;

    decrypt<T extends ICredential>(store:ICredentialStore, key:string): T;
    store(store:ICredentialStore): string;
    toString(): string;
}

export interface ICredentialStore { 
    readonly cryptography: ICryptography;

    decrypt<T extends ICredential>(key:string, credential?:T): T;
    delete(key: string): void;
    retreive<T extends ICredential>(key:string, credential?:T): T;
    secure(securable:Securable): ISecureItem;
    store<T extends ICredential>(credential:T, key?:string): string;
}

/**
 * Represents a secure item (string or buffer) with the needed components
 * (minus key, of course) to decrypt them.
 *
 * @class SecureItem
 */
export class SecureItem implements ISecureItem {
    static from(iv: Securable, data: Securable, preferredOutput: SecureOutput = SecureOutput.Buffer): SecureItem {
        return new SecureItem(iv, data, preferredOutput);
    }

    static isSecure(item:any) {
        return item instanceof SecureItem || (item.data && item.iv);
    }

    static asSecureItem(item:any): SecureItem {
        if (item instanceof SecureItem) {
            return <SecureItem>item;
        }

        if (item.data && item.iv) {
            return Encryption.createSecureItem(item.iv, item.data);
        }
    }

    private constructor(readonly iv: Securable, readonly data: Securable, readonly preferredOutput: SecureOutput) {
        if (!Buffer.isBuffer(iv)) {
            this.iv = Buffer.from(iv);
        }
    
        if (!Buffer.isBuffer(data)) {
            this.data = Buffer.from(data);
        }
    }

    decrypt(decryptStore:ICryptography): Securable {
        const returnValue = decryptStore.decrypt(this);
    
        if (this.preferredOutput === SecureOutput.Buffer) {
            return returnValue;
        }
        else {
            return returnValue.toString();
        }
    }
    
    get buffer(): { iv: Buffer; data: Buffer; } {
        return { iv: <Buffer>this.iv, data: <Buffer>this.data };
    }
    
    get string(): { iv: string; data: string; } {
        return { iv: this.iv.toString('hex'), data: this.data.toString('hex') };
    }
}

export abstract class CredentialStore implements ICredentialStore {
    public abstract get cryptography(): ICryptography;
    protected abstract onStore(encrypted: any, key: string): void;
    protected abstract onRetreive(key: string): any;
    protected abstract onDelete(key: string): void;

    delete(key: string): void {
        const encrypteed = this.onRetreive(key);

        if (!encrypteed) { return null; }

        this.onDelete(key);
    }

    decrypt<T extends ICredential>(key: string, credential?:T): T {
        const encrypted = this.onRetreive(key);

        if (!encrypted) { return null; }

        if (!credential) { 
            credential = <T>{ key };
        }

        Object.keys(encrypted).forEach(k => {
            if (SecureItem.isSecure(encrypted[k])) {
                credential[k] = this.cryptography.decrypt(<ISecureItem>encrypted[k]);
            } else {
                credential[k] = encrypted[k];
            }
        });

        return credential;
    }

    retreive<T extends ICredential>(key: string, credential?:T): T {
        const encrypted = this.onRetreive(key);

        if (!encrypted) { return null; }

        if (!credential) { 
            credential = <T>{ key };
        }

        Object.keys(encrypted).forEach(k => {
            if (SecureItem.isSecure(encrypted[k])) {
                credential[k] = SecureItem.asSecureItem(encrypted[k]);
            } else {
                credential[k] = encrypted[k];
            }
        });

        return credential;
    }

    secure(securable:Securable): ISecureItem {
        return this.cryptography.encrypt(securable);
    }

    store<T extends ICredential>(credential: T, key?: string): string {        
        let storeObject:any = {};
        key = key || credential.key || Utilities.Guid.newGuid();

        Object.keys(credential).forEach(k => {
            if (Encryption.isSecurable(credential[k])) {
                const secured = this.cryptography.encrypt(credential[k]);

                storeObject[k] = secured.string;
            } else if (SecureItem.isSecure(credential[k])) {
                storeObject[k] = (<ISecureItem>credential[k]).string;
            }
        });
    
        this.onStore(storeObject, key);

        return key;
    }
}

export abstract class Credential implements ICredential {
    protected constructor(
        public username: ISecureItem | Securable,
        public password: ISecureItem | Securable, 
        public readonly key?:string) { 
    }

    static from(value:any): ICredential {
        if (this.isCdsOnlineUserCredential(value)) {
            return new CdsOnlineCredential(value.username, value.password, value.orgUrl, value.token);
        } else if (this.isAzureAdClientCredential(value)) {
            return new AzureAdClientCredential(value.clientId, value.clientSecret, value.authority, value.callbackUrl);
        } else if (this.isAzureAdUserCredential(value)) {
            return new AzureAdUserCredential(value.username, value.password, value.clientId, value.clientSecret, value.authority);
        } else if (this.isOauthCredential(value)) {
            return new OAuthCredential(value.username, value.password, value.token);
        } else if (this.isWindowsCredential(value)) {
            return new WindowsCredential(value.domain, value.username, value.password);
        }

        return null;
    }

    static isCredential(value:any): boolean {
        return value && (value instanceof Credential || (value.hasOwnProperty("username") && value.hasOwnProperty("password")));
    }

    static isWindowsCredential(value:ICredential): boolean {
        return value && this.isCredential(value) && value.hasOwnProperty("domain");
    }

    static isOauthCredential(value:ICredential): boolean {
        return value && this.isCredential(value) && value.hasOwnProperty("token");
    }

    static isAzureAdClientCredential(value:ICredential): boolean {
        return value && this.isCredential(value) && value.hasOwnProperty("clientId") && value.hasOwnProperty("clientSecret") && value.hasOwnProperty("authority") && value.hasOwnProperty("callback");
    }

    static isAzureAdUserCredential(value:ICredential): boolean {
        return value && this.isCredential(value) && value.hasOwnProperty("clientId") && value.hasOwnProperty("clientSecret") && value.hasOwnProperty("authority");
    }

    static isCdsOnlineUserCredential(value:ICredential): boolean {
        return value && this.isCredential(value) && value.hasOwnProperty("orgUrl");
    }

    static retreive<T extends Credential>(store:ICredentialStore, key: string): T {
        if (!store) { return; }

        return store.retreive(key, undefined);
    }

    get isSecure(): boolean {
        return SecureItem.isSecure(this.username) && SecureItem.isSecure(this.password);
    }

    decrypt<T extends ICredential>(store:ICredentialStore, key:string): T {
        if (!store) { return; }

        const decrypted = store.decrypt<T>(key);

        if (!Utilities.$Object.isNullOrEmpty(decrypted)) {
            Utilities.$Object.clone(decrypted, this);
        }
    }

    store(store:ICredentialStore): string {
        if (!store) { return; }

        return store.store(this);
    }

    toString():string {
        return (SecureItem.isSecure(this.username) ? "" : this.username.toString());
    }
}

export class WindowsCredential extends Credential {
    constructor(public domain: Securable, username: SecureItem | Securable, password: SecureItem | Securable) {
        super(username, password);
    }

    static from(credential:any) {
        if (!credential) {
            return null;
        }

        const domain: Securable | undefined = credential.domain;
        const username: Securable | undefined = credential.username;
        const password: Securable | undefined = credential.password;
        
        return new WindowsCredential(domain, username, password);
    }

    toString():string {
        return (this.domain && this.domain !== "" ? `${this.domain.toString()}\\` : "") + SecureItem.isSecure(this.username) ? "" : this.username.toString();
    }
}

export class OAuthCredential extends Credential {
    constructor(username: SecureItem | Securable, password: SecureItem | Securable, public token?:string) {
        super(username, password);
    }
}

export class AzureAdClientCredential extends Credential {
    constructor(public clientId: Securable | SecureItem, public clientSecret: Securable | SecureItem, public authority: string, public callbackUrl?: string) {
        super(clientId, clientSecret);
    }
}

export class AzureAdUserCredential extends Credential {
    constructor(username: SecureItem | Securable, password: SecureItem | Securable, public clientId: Securable | SecureItem, public clientSecret: Securable | SecureItem, public authority: string) {
        super(username, password);
    }
}

export class CdsOnlineCredential extends OAuthCredential {
    static readonly defaultClientId:string = "51f81489-12ee-4a9e-aaae-a2591f45987d";
    static readonly defaultAuthority:string = "https://login.microsoftonline.com/common/oauth2/authorize?resource=";

    constructor(username: SecureItem | Securable, password: SecureItem | Securable, public orgUrl?: string, token?: string) {
        super(username, password, token);
    }
}