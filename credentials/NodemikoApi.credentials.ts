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
			name: 'deviceType',
			type: 'options',
			default: 'cisco_ios',
			options: [
				{
					name: 'Cisco IOS',
					value: 'cisco_ios',
				},
				{
					name: 'Cisco NX-OS',
					value: 'cisco_nxos',
				},
				{
					name: 'Cisco XR',
					value: 'cisco_xr',
				},
				{
					name: 'Juniper Junos',
					value: 'juniper_junos',
				},
				{
					name: 'Linux SSH',
					value: 'linux_ssh',
				},
			]
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
			displayName: 'Secret',
			name: 'secret',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: '',
		},
	];
} 