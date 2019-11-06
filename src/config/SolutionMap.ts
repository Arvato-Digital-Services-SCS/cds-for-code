import * as vscode from "vscode";
import * as fs from 'fs';
import QuickPicker from "../helpers/QuickPicker";
import * as path from 'path';
import * as FileSystem from '../helpers/FileSystem';
import { TS } from "typescript-linq";
import { ExtensionContext } from "vscode";
import WorkspaceState from "./WorkspaceState";

export default class SolutionMap
{
    public mappings:SolutionWorkspaceMapping[] = [];

    public map(organizationId:string, solutionId:string, path:string): SolutionMap {
        const existing = this.getMapping(path);

        if (!existing.solutionId && !existing.organizationId) {
            existing.solutionId = solutionId;
            existing.organizationId = organizationId;

            this.mappings.push(new SolutionWorkspaceMapping(organizationId, solutionId, path));
        } else {
            existing.solutionId = solutionId;
            existing.organizationId = organizationId;
        }

        return this;
    }

    public getMapping(path:string): SolutionWorkspaceMapping {
        let items = new TS.Linq.Enumerator(this.mappings)
            .where(m => m.path && m.path === path)
            .toArray();

        if (items.length > 0) {
            return items[0];
        }
    
        return new SolutionWorkspaceMapping(undefined, undefined, path);
    }

    public getPath(organizationId:string, solutionId:string): SolutionWorkspaceMapping {
        let items = new TS.Linq.Enumerator(this.mappings)
            .where(m => m.organizationId && m.organizationId === organizationId && m.solutionId && m.solutionId === solutionId)
            .toArray();

        if (items.length > 0) {
            return items[0];
        }
        
        return new SolutionWorkspaceMapping(organizationId, solutionId, undefined);
    }

    public async load(filename?:string): Promise<SolutionMap>
    {
        return (SolutionMap.read(filename)
            .then(solutionMap => { this.mappings = solutionMap.mappings; return this; }));
    }

    public async save(filename?:string): Promise<SolutionMap>
    {
        return SolutionMap.write(this, filename);
    }

    public saveToWorkspace(context: ExtensionContext) : SolutionMap {
        WorkspaceState.Instance(context).SolutionMap = this;

        return this;
    }

    public static loadFromWorkspace(context: ExtensionContext) : SolutionMap {
        return WorkspaceState.Instance(context).SolutionMap;
    }
    
    public static async read(filename:string = ".dynamics/solutionMap.json"): Promise<SolutionMap> {
        const workspacePath = await QuickPicker.pickWorkspaceRoot(undefined, "Choose a location where your .dynamics folder will go.", true);
        const file  = path.join(workspacePath, filename);

        if (fs.existsSync(file)) {
            try {
                let returnObject = JSON.parse(fs.readFileSync(file, 'utf8'));

                if (returnObject && returnObject instanceof SolutionMap) {
                    return <SolutionMap>returnObject;
                }
            }
            catch (error) {
                vscode.window.showErrorMessage(`The file '${filename}' file was found but could not be parsed.  A new file will be created.${error ? '  The error returned was: ' + error : ''}`);
            }
        }

        return new SolutionMap();
    }

    public static async write(map:SolutionMap, filename:string = ".dynamics/solutionMap.json"): Promise<SolutionMap> {
        const workspacePath = await QuickPicker.pickWorkspaceRoot(undefined, "Choose a location where your .dynamics folder will go.", true);
        const folder  = path.join(workspacePath, path.dirname(filename));

        if (!fs.existsSync(folder)) {
            FileSystem.MakeFolderSync(folder);
        }

        const file = path.join(workspacePath, filename);

        try {
            fs.writeFileSync(file, JSON.stringify(map), 'utf8');
        }
        catch (error) {
            vscode.window.showErrorMessage(`The file '${filename}' could not be saved to the workspace.${error ? '  The error returned was: ' + error : ''}`);
        }

        return map;
    }
}

export class SolutionWorkspaceMapping
{
    constructor(organizationId?:string, solutionId?:string, path?:string)
    {
        this.organizationId = organizationId;
        this.solutionId = solutionId;
        this.path = path;
    }

    public solutionId:string;
    public organizationId:string;
    public path:string;
}