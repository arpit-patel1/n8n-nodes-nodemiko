import { ICredentialType, INodeProperties } from 'n8n-workflow';

export class NodemikoApi implements ICredentialType {
	name = 'nodemikoApi';
	displayName = 'Nodemiko API';
	properties: INodeProperties[] = [
		{
			displayName: 'Host',
			name: 'host',
			type: 'string',
			default: '',
		},
		{
			displayName: 'Device Type',
			name: 'device_type',
			type: 'options',
			options: [
				{
					name: 'Cisco IOS',
					value: 'cisco_ios',
				},
				{
					name: 'Cisco XR',
					value: 'cisco_xr',
				},
				{
					name: 'Cisco NX-OS',
					value: 'cisco_nxos',
				},
				{
					name: 'Juniper Junos',
					value: 'juniper_junos',
				},
				{
					name: 'Linux',
					value: 'linux',
				},
			],
			default: 'cisco_ios',
		},
		{
			displayName: 'Username',
			name: 'username',
			type: 'string',
			default: '',
		},
		{
			displayName: 'Authentication Type',
			name: 'authType',
			type: 'options',
			options: [
				{
					name: 'Password',
					value: 'password',
				},
				{
					name: 'SSH Key',
					value: 'sshKey',
				},
			],
			default: 'password',
		},
		{
			displayName: 'Password',
			name: 'password',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: '',
			displayOptions: {
				show: {
					authType: [
						'password',
					],
				},
			},
		},
		{
			displayName: 'Private Key',
			name: 'privateKey',
			type: 'string',
			typeOptions: {
				multiLine: true,
			},
			default: '',
			displayOptions: {
				show: {
					authType: [
						'sshKey',
					],
				},
			},
			description: 'The private SSH key to use for authentication',
		},
		{
			displayName: 'Port',
			name: 'port',
			type: 'number',
			default: 22,
		},
		{
			displayName: 'Secret',
			name: 'secret',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: '',
			description: 'The enable secret.',
		},
	];
} 