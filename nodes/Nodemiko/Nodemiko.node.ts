import {
	IExecuteFunctions,
	INodeType,
	INodeTypeDescription,
	IDataObject,
	INodeExecutionData,
	NodeConnectionType,
	LoggerProxy as Logger,
	NodeApiError,
} from 'n8n-workflow';

import { sshDispatcher } from './lib/ssh_dispatcher.js';
import { withConnection } from './lib/utils/withConnection.js';

export class Nodemiko implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Nodemiko',
		name: 'nodemiko',
		icon: 'file:nodemiko.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Interact with network devices using Nodemiko',
		defaults: {
			name: 'Nodemiko',
		},
		inputs: ['main' as NodeConnectionType],
		outputs: ['main' as NodeConnectionType],
		credentials: [
			{
				name: 'nodemikoApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Device',
						value: 'device',
					},
				],
				default: 'device',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: [
							'device',
						],
					},
				},
				options: [
					{
						name: 'Send Command',
						value: 'sendCommand',
						description: 'Send a command to the device',
						action: 'Send a command to the device',
					},
					{
						name: 'Send Config Set',
						value: 'sendConfig',
						description: 'Send a set of configuration commands to the device',
						action: 'Send a set of configuration commands to the device',
					},
				],
				default: 'sendCommand',
			},
			{
				displayName: 'Command',
				name: 'command',
				type: 'string',
				displayOptions: {
					show: {
						resource: ['device'],
						operation: ['sendCommand'],
					},
				},
				default: '',
				description: 'The command to send to the device',
			},
			{
				displayName: 'Commands',
				name: 'commands',
				type: 'string',
				typeOptions: {
					rows: 10,
					multiLine: true,
				},
				displayOptions: {
					show: {
						resource: ['device'],
						operation: ['sendConfig'],
					},
				},
				default: '',
				description: 'A set of configuration commands to send to the device, one per line',
			},
			{
				displayName: 'Additional Fields',
				name: 'additionalFields',
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				displayOptions: {
					show: {
						resource: ['device'],
						operation: ['sendCommand', 'sendConfig'],
					},
				},
				options: [
					{
						displayName: 'Expect String',
						name: 'expectString',
						type: 'string',
						default: '',
						description: 'A regex pattern to look for in the output to signify the command is done',
					},
					{
						displayName: 'Strip Prompt',
						name: 'stripPrompt',
						type: 'boolean',
						default: true,
						description: 'Whether to strip the prompt from the output',
					},
					{
						displayName: 'Strip Command',
						name: 'stripCommand',
						type: 'boolean',
						default: true,
						description: 'Whether to strip the command from the output',
					},
					{
						displayName: 'Delay Factor',
						name: 'delayFactor',
						type: 'number',
						default: 1,
						description: 'A factor to multiply the default delay by',
					},
					{
						displayName: 'Error Pattern',
						name: 'errorPattern',
						type: 'string',
						default: '',
						description: 'A regex pattern to detect an error in the command output. For sendConfig only.',
					},
					{
						displayName: 'Config Mode Command',
						name: 'configModeCommand',
						type: 'string',
						default: 'configure terminal',
						description: 'The command to enter configuration mode. For sendConfig only.',
					},
					{
						displayName: 'Enter Config Mode',
						name: 'enterConfigMode',
						type: 'boolean',
						default: true,
						description: 'Whether to enter configuration mode before sending commands. For sendConfig only.',
					},
					{
						displayName: 'Exit Config Mode',
						name: 'exitConfigMode',
						type: 'boolean',
						default: true,
						description: 'Whether to exit configuration mode after sending commands. For sendConfig only.',
					},
				],
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Debug',
						name: 'debug',
						type: 'boolean',
						default: false,
						description: 'Enable verbose logging for debugging purposes.',
					},
					{
						displayName: 'Connection Timeout',
						name: 'conn_timeout',
						type: 'number',
						default: 10000,
						description: 'The connection timeout in milliseconds.',
					},
				],
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				const options = this.getNodeParameter('options', itemIndex, {}) as any;

				const device: any = {
					host: this.getNodeParameter('host', itemIndex, '') as string,
					username: this.getNodeParameter('username', itemIndex, '') as string,
					password: this.getNodeParameter('password', itemIndex, '') as string,
					device_type: this.getNodeParameter('device_type', itemIndex, '') as string,
					port: this.getNodeParameter('port', itemIndex, 22) as number,
					secret: options.secret || '',
					use_keys: options.use_keys || false,
					key_file: options.key_file || '',
					passphrase: options.passphrase || '',
					global_delay_factor: options.global_delay_factor || 1,
					conn_timeout: options.conn_timeout || 20000,
					read_timeout: options.read_timeout || 10000,
					debug: options.debug || false,
				};

				const operation = this.getNodeParameter('operation', itemIndex, '');
				const commands = this.getNodeParameter('commands', itemIndex, '') as string;

				await withConnection(device, async (conn: any) => {
					let result;
					if (operation === 'send_command') {
						result = await conn.send_command(commands);
					} else if (operation === 'send_config') {
						result = await conn.send_config(commands.split('\n'));
					} else {
						throw new NodeApiError(this.getNode(), { message: `Unsupported operation: ${operation}` });
					}

					returnData.push({
						json: {
							device: device.host,
							result: result,
						},
						pairedItem: {
							item: itemIndex,
						},
					});
				}, { logger: Logger });

			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: {
							error: (error as Error).message,
						},
						pairedItem: {
							item: itemIndex,
						}
					});
					continue;
				}

				throw error;
			}
		}

		return [this.helpers.returnJsonArray(returnData)];
	}
} 