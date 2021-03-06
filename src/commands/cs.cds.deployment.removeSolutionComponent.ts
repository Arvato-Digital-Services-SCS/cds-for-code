import * as cs from '../cs';
import * as vscode from 'vscode';
import { CdsWebApi } from '../api/cds-webapi/CdsWebApi';
import { CdsSolutions } from '../api/CdsSolutions';
import ApiRepository from '../repositories/apiRepository';
import Quickly from '../core/Quickly';
import { Utilities } from '../core/Utilities';
import ExtensionContext from "../core/ExtensionContext";
import logger from '../core/framework/Logger';
import SolutionManager from '../components/Solutions/SolutionManager';

/**
 * This command can be invoked by the Command Palette or the Dynamics TreeView and removes a solution component from a solution.
 * @export run command function
 * @param {vscode.Uri} [file] that invoked the command
 * @returns void
 */
export default async function run(this: SolutionManager, config?:CdsWebApi.Config, solution?:any, componentId?:string, componentType?:CdsSolutions.SolutionComponent): Promise<any> {
	config = config || await Quickly.pickCdsOrganization(ExtensionContext.Instance, "Choose a CDS Organization", true);
	if (!config) {
		logger.warn(`Command: ${cs.cds.deployment.removeSolutionComponent} Organization not chosen, command cancelled`);
		return; 
	}

	solution = solution || await Quickly.pickCdsSolution(config, "Choose a solution", true);
	if (!solution) {
		logger.warn(`Command: ${cs.cds.deployment.removeSolutionComponent} Solution not chosen, command cancelled`);
		return; 
	}

	if (Utilities.$Object.isNullOrEmpty(componentType)) {
		componentType = await Quickly.pickCdsSolutionComponentType("Choose a component to remove", [
			CdsSolutions.SolutionComponent.Entity,
			CdsSolutions.SolutionComponent.OptionSet,
			CdsSolutions.SolutionComponent.PluginAssembly,
			CdsSolutions.SolutionComponent.WebResource,
			CdsSolutions.SolutionComponent.Workflow
		]);

		if (Utilities.$Object.isNullOrEmpty(componentType)) { 
			logger.warn(`Command: ${cs.cds.deployment.removeSolutionComponent} Component type not chosen, command cancelled`);
			return; 
		}
	}
	
	if (Utilities.$Object.isNullOrEmpty(componentId)) { 
		const pickResponse = await Quickly.pickCdsSolutionComponent(config, solution, componentType, "Choose a component to remove");
		if (!pickResponse) { 
			logger.warn(`Command: ${cs.cds.deployment.removeSolutionComponent} Component not chosen, command cancelled`);
			return; 
		}

		componentId = pickResponse.componentId;
	}

	const api = new ApiRepository(config);

	logger.info(`Command: ${cs.cds.deployment.removeSolutionComponent} Removing ${componentId} from ${solution.uniquename}`);

	return await api.removeSolutionComponent(solution, componentId, componentType)
		.then(() => solution)
		.catch(async error => await Quickly.error(`Could not remove ${componentType.toString()} from solution.  The error returned was: ${error && error.message ? error.message : error}`));
}