declare module 'nodemiko' {
	export class Nodemiko {
		constructor(options: any);
		connect(): Promise<void>;
		disconnect(): Promise<void>;
		sendCommand(command: string, options?: any): Promise<string>;
		sendConfigSet(commands: string[], options?: any): Promise<string>;
		findPrompt(): Promise<string>;
		commit(): Promise<string>;
		enable(): Promise<string>;
	}
} 