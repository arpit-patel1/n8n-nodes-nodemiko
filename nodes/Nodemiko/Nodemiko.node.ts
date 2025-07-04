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
		subtitle: '={{$parameter["operation"]}}',
		description: 'SSH into a network device and run commands',
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
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Send Command',
						value: 'send_command',
						action: 'Send a command',
					},
					{
						name: 'Send Config',
						value: 'send_config',
						action: 'Send a configuration command',
					},
				],
				default: 'send_command',
			},
			{
				displayName: 'Commands',
				name: 'commands',
				type: 'string',
				default: '',
				placeholder: 'show version',
				description: 'The command to run',
				required: true,
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
						default: 20000,
						description: 'The connection timeout in milliseconds.',
					},
					{
						displayName: 'Read Timeout',
						name: 'read_timeout',
						type: 'number',
						default: 10000,
						description: 'The read timeout in milliseconds.',
					},
					{
						displayName: 'Global Delay Factor',
						name: 'global_delay_factor',
						type: 'number',
						default: 1,
						description: 'A multiplier to adjust delays for slower devices.',
					},
					{
						displayName: 'Use Keys',
						name: 'use_keys',
						type: 'boolean',
						default: false,
						description: 'Whether to use SSH keys for authentication.',
					},
					{
						displayName: 'Key File',
						name: 'key_file',
						type: 'string',
						default: '',
						description: 'The path to the private key file.',
					},
					{
						displayName: 'Passphrase',
						name: 'passphrase',
						type: 'string',
						typeOptions: {
							password: true,
						},
						default: '',
						description: 'The passphrase for the private key.',
					},
				],
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();

		let item: INodeExecutionData;
		const returnData: INodeExecutionData[] = [];

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				const credentials = await this.getCredentials('nodemikoApi') as IDataObject;
				const options = this.getNodeParameter('options', itemIndex, {}) as any;

				const device: any = {
					host: credentials.host as string,
					username: credentials.username as string,
					password: credentials.password as string,
					device_type: credentials.device_type as string,
					port: credentials.port as number || 22,
					secret: credentials.secret as string || '',
					use_keys: options.use_keys || false,
					key_file: options.key_file || '',
					passphrase: options.passphrase || '',
					global_delay_factor: options.global_delay_factor || 1,
					conn_timeout: options.conn_timeout || 20000,
					read_timeout: options.read_timeout || 10000,
					debug: options.debug || false,
				};
				Logger.info('device', device);
				Logger.info('options', options);
				Logger.info('credentials', credentials);
				
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
				// This node should never fail but catch errors to prevent halting the workflow
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

		return [returnData];
	}
} 