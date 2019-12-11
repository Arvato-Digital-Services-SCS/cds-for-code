import * as cs from '../../cs';
import * as vscode from 'vscode';
import { DynamicsWebApi } from '../../api/cds-webapi/DynamicsWebApi';
import ExtensionContext from '../../core/ExtensionContext';
import GlobalStateCredentialStore from '../../core/security/GlobalStateCredentialStore';
import { Credential } from '../../core/security/Types';
import Dictionary from '../../core/types/Dictionary';
import TokenCache, { TokenType } from '../../core/security/TokenCache';

export default class GlobalState {
    private constructor() { }

    get DynamicsConnections(): DynamicsWebApi.Config[] {
        const connections = ExtensionContext.Instance.globalState.get<DynamicsWebApi.Config[]>(cs.dynamics.configuration.globalState.dynamicsConnections);

        connections.forEach(c => {
            const creds = GlobalStateCredentialStore.Instance.retreive(c.id);

            if (creds) {
                c.credentials = Credential.from(creds, c.id);
            }
        });

        return connections;
    }
    set DynamicsConnections(value: DynamicsWebApi.Config[]) {
        const keys = new Dictionary<number, string>();
        
        // Store each connection without creds.
        value.forEach((c, index) => {
            if (c.credentials) {
                const anyCreds = <any>c.credentials;

                if (c.type !== DynamicsWebApi.ConfigType.OnPremises) {
                    if (!anyCreds.refreshToken) {
                        anyCreds.refreshToken = TokenCache.Instance.getToken(TokenType.RefreshToken, 'https://disco.crm.dynamics.com/');
                    }
                }

                const key = GlobalStateCredentialStore.Instance.store(anyCreds, c.id, [ "accessToken", "refreshToken" ]);
                
                delete c.credentials;

                keys.add(index, key);
            }
        });

        ExtensionContext.Instance.globalState.update(cs.dynamics.configuration.globalState.dynamicsConnections, value);

        // Reload the creds (encrypted) for use in the session.
        value.forEach((c, index) => {
            if (keys.containsKey(index)) {
                c.credentials = GlobalStateCredentialStore.Instance.retreive(keys[index]);
            }
        });
    }

    get PowerShellScriptVersion(): number {
        return ExtensionContext.Instance.globalState.get<number>(cs.dynamics.configuration.globalState.powerShellScriptVersion);
    }
    set PowerShellScriptVersion(value: number) {
        ExtensionContext.Instance.globalState.update(cs.dynamics.configuration.globalState.powerShellScriptVersion, value);
    }
    
    static get Instance(): GlobalState {
        return new GlobalState();
    }
}