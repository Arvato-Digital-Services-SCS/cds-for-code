import * as vscode from 'vscode';
import * as FileSystem from '../core/io/FileSystem';
import Quickly from '../core/Quickly';
import DynamicsTerminal, { TerminalCommand } from '../views/DynamicsTerminal';
import * as path from 'path';
import ExtensionContext from '../core/ExtensionContext';
import { Utilities } from '../core/Utilities';

/**
 * This command can be invoked by the Explorer file viewer and builds a .Net Core project
 * @export run command function
 * @param {vscode.Uri} [file] that invoked the command
 * @returns void
 */
const incrementBuild = (build:string) => {
	const parts = build.split(".");
	
	if (parts.length < 4) {
		for (let i = parts.length; i <= 4; i++) {
			parts.push(i < 4 ? "0" : "1"); 
		}
	} else {
		parts[3] = (parseInt(parts[3]) + 1).toString();
	}

	return parts.join(".");
};

export default async function run(file?:vscode.Uri, updateVersionBuild:boolean = true, logFile?:string): Promise<any> {
	const workspaceFolder = vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0 ? vscode.workspace.workspaceFolders[0] : null;
	let defaultFolder = workspaceFolder ? workspaceFolder.uri : undefined;

	if (file) {
		if (FileSystem.stats(file.fsPath).isDirectory()) {
			defaultFolder = file;
			file = undefined;
		} else {
			// If we didn't specify a project file, return.
			if (!this.fileIsProject(file)) { file = undefined; } 
		}
	}

	file = file || await Quickly.pickWorkspaceFile(defaultFolder, "Choose a projet to build", undefined, false, this.projectFileTypes).then(r => vscode.Uri.file(r));
	if (!file) { return; }

	if (updateVersionBuild) {
		await this.updateVersionNumber(file, incrementBuild);
	}

	if (!logFile || logFile !== "!") {
		if ((await Quickly.pickBoolean("Do you want to review the log for this operation?", "Yes", "No"))) {
			//context.globalStoragePath, `/logs/build-
			logFile = path.join(ExtensionContext.Instance.globalStoragePath, `/logs/build-${path.basename(file.path)}-${Utilities.String.dateAsFilename()}`);
		}
	}

	if (logFile && logFile === "!") { logFile = undefined; }

	return DynamicsTerminal.showTerminal(path.parse(file.fsPath).dir)
		.then(async terminal => { 
			return await terminal.run(new TerminalCommand(`dotnet build "${file.fsPath}"`))
				.then(tc => {
					if (logFile) {
						const folder = path.dirname(logFile);

						if (!FileSystem.exists(folder)) {
							FileSystem.makeFolderSync(folder);
						}

						FileSystem.writeFileSync(logFile, tc.output);

						vscode.workspace.openTextDocument(logFile)
							.then(d => vscode.window.showTextDocument(d));	
					}
				});                      
		});
}