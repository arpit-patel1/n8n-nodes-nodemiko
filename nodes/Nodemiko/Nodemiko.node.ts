import {
	IExecuteFunctions,
	INodeType,
	INodeTypeDescription,
	IDataObject,
	INodeExecutionData,
	NodeConnectionType,
} from 'n8n-workflow';
import Nodemiko from 'nodemiko';

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
				displayName: 'Device Type',
				name: 'deviceType',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Arista EOS', value: 'arista_eos' },
					{ name: 'Cisco IOS', value: 'cisco_ios' },
					{ name: 'Cisco XE', value: 'cisco_xe' },
					{ name: 'Cisco XR', value: 'cisco_xr' },
					{ name: 'Cisco NX-OS', value: 'cisco_nxos' },
					{ name: 'Juniper Junos', value: 'juniper_junos' },
					{ name: 'Linux', value: 'linux' },
				],
				default: 'cisco_ios',
				description: 'The type of network device to connect to',
			},
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
						value: 'sendConfigSet',
						description: 'Send a set of configuration commands to the device',
						action: 'Send a set of configuration commands to the device',
					},
					{
						name: 'Find Prompt',
						value: 'findPrompt',
						description: 'Find the prompt on the device',
						action: 'Find the prompt on the device',
					},
					{
						name: 'Commit',
						value: 'commit',
						description: 'Commit changes on the device',
						action: 'Commit changes on the device',
					},
					{
						name: 'Enable',
						value: 'enable',
						description: 'Enable the device',
						action: 'Enable the device',
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
					multipleLines: true,
				},
				displayOptions: {
					show: {
						resource: ['device'],
						operation: ['sendConfigSet'],
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
						operation: ['sendCommand', 'sendConfigSet'],
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
				],
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: IDataObject[] = [];

		for (let i = 0; i < items.length; i++) {
			const deviceType = this.getNodeParameter('deviceType', i) as string;
			const credentials = await this.getCredentials('nodemikoApi');
			const { host, username, password, secret, authType, privateKey } = credentials;

			const connectionOptions: any = {
				host: host as string,
				username: username as string,
				secret: secret as string,
				deviceType: deviceType,
			};

			if (authType === 'sshKey') {
				connectionOptions.key = privateKey;
			} else {
				connectionOptions.password = password;
			}

			let net_connect;
			let output;

			try {
				net_connect = new Nodemiko(connectionOptions);
				await net_connect.connect();

				const operation = this.getNodeParameter('operation', i) as string;
				const command = this.getNodeParameter('command', i, '') as string;
				const additionalFields = this.getNodeParameter('additionalFields', i, {}) as IDataObject;

				switch (operation) {
					case 'sendCommand':
						output = await net_connect.sendCommand(command, additionalFields);
						break;
					case 'sendConfigSet':
						const commands = (this.getNodeParameter('commands', i, '') as string).split('\n');
						output = await net_connect.sendConfigSet(commands, additionalFields);
						break;
					case 'findPrompt':
						output = await net_connect.findPrompt();
						break;
					case 'commit':
						output = await net_connect.commit();
						break;
					case 'enable':
						output = await net_connect.enable();
						break;
					default:
						throw new Error(`The operation "${operation}" is not supported.`);
				}

				returnData.push({ result: output });
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({ error: (error as Error).message });
					continue;
				}
				throw error;
			} finally {
				if (net_connect) {
					await net_connect.disconnect();
				}
			}
		}

		return [this.helpers.returnJsonArray(returnData)];
	}
} 