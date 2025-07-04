declare module 'nodemiko' {
	export function ConnectHandler(connection_args: any): Promise<any>;
}

declare module '*/lib/ssh_dispatcher.js';
declare module '*/lib/utils/withConnection.js'; 